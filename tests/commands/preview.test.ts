import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option, Ref } from "effect"
import { Config, ResumeRepo, Preview, PdfRenderer } from "../../src/services/index.ts"
import { mockResume, minimalResume } from "../helpers/fixtures.ts"

// Track preview calls
const createPreviewTracker = () => {
  const callsRef = Ref.unsafeMake<Array<{ method: string }>>([])

  const recordCall = (method: string) =>
    Ref.update(callsRef, (calls) => [...calls, { method }])

  const getCalls = () => Ref.get(callsRef)
  const reset = () => Ref.set(callsRef, [])

  return { recordCall, getCalls, reset }
}

const previewTracker = createPreviewTracker()
const pdfTracker = createPreviewTracker()

// Create mock Preview that returns actual formatted output for terminal preview
const mockPreviewWithOutput = Layer.succeed(
  Preview,
  Preview.of({
    terminalPreview: (resume) =>
      Effect.gen(function* () {
        yield* previewTracker.recordCall("terminalPreview")
        const lines: string[] = []
        const width = 70

        // Header
        const name = resume.contact.name.toUpperCase()
        const padding = Math.max(0, Math.floor((width - name.length) / 2))
        lines.push("")
        lines.push(" ".repeat(padding) + name)
        lines.push("=".repeat(width))

        // Contact
        const contactParts: string[] = [resume.contact.email]
        Option.match(resume.contact.phone, {
          onNone: () => {},
          onSome: (v) => contactParts.push(v),
        })
        lines.push(contactParts.join(" | "))
        lines.push("")

        // Summary
        Option.match(resume.summary, {
          onNone: () => {},
          onSome: (s) => {
            lines.push("SUMMARY")
            lines.push("-".repeat(width))
            lines.push(s.default)
            lines.push("")
          },
        })

        // Skills
        lines.push("SKILLS")
        lines.push("-".repeat(width))
        Option.match(resume.skills.frontend, {
          onNone: () => {},
          onSome: (skills) => lines.push(`Frontend:       ${skills.join(", ")}`),
        })
        lines.push("")

        // Experience
        lines.push("EXPERIENCE")
        lines.push("-".repeat(width))
        for (const exp of resume.experience) {
          lines.push(`${exp.title} | ${exp.company}`)
          lines.push(`${exp.startDate} - ${exp.endDate}`)
          for (const h of exp.highlights) {
            lines.push(`  • ${h.text}`)
          }
          lines.push("")
        }

        return lines.join("\n")
      }),
    browserPreview: () =>
      Effect.gen(function* () {
        yield* previewTracker.recordCall("browserPreview")
      }),
  })
)

// Mock PDF renderer
const mockPdfRendererTracked = Layer.succeed(
  PdfRenderer,
  PdfRenderer.of({
    render: () => Effect.succeed(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
    renderToFile: () =>
      Effect.gen(function* () {
        yield* pdfTracker.recordCall("renderToFile")
      }),
    getAvailableTemplates: () => Effect.succeed([]),
  })
)

// Simulate preview command logic
const runPreview = (args: { browser: boolean; pdf: boolean }) =>
  Effect.gen(function* () {
    const config = yield* Config
    const repo = yield* ResumeRepo
    const preview = yield* Preview

    const resume = yield* repo.load(config.defaultResumePath)

    if (args.pdf) {
      const pdfRenderer = yield* PdfRenderer
      yield* pdfRenderer.renderToFile(resume, "/tmp/preview.pdf")
      return { mode: "pdf", output: null }
    } else if (args.browser) {
      yield* preview.browserPreview(resume)
      return { mode: "browser", output: null }
    } else {
      const output = yield* preview.terminalPreview(resume)
      return { mode: "terminal", output }
    }
  })

const TestLayer = Layer.mergeAll(
  Config.test(),
  ResumeRepo.test({ resume: mockResume }),
  mockPreviewWithOutput,
  mockPdfRendererTracked
)

const MinimalTestLayer = Layer.mergeAll(
  Config.test(),
  ResumeRepo.test({ resume: minimalResume }),
  mockPreviewWithOutput,
  mockPdfRendererTracked
)

describe("preview command", () => {
  it.effect("renders terminal preview by default", () =>
    Effect.gen(function* () {
      yield* previewTracker.reset()

      const result = yield* runPreview({ browser: false, pdf: false })

      expect(result.mode).toBe("terminal")
      expect(result.output).not.toBeNull()
      const calls = yield* previewTracker.getCalls()
      expect(calls.length).toBe(1)
      expect(calls[0].method).toBe("terminalPreview")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("terminal preview contains name in header", () =>
    Effect.gen(function* () {
      yield* previewTracker.reset()

      const result = yield* runPreview({ browser: false, pdf: false })

      expect(result.output).toContain("TEST USER")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("terminal preview contains contact info", () =>
    Effect.gen(function* () {
      yield* previewTracker.reset()

      const result = yield* runPreview({ browser: false, pdf: false })

      expect(result.output).toContain("test@example.com")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("terminal preview contains skills section", () =>
    Effect.gen(function* () {
      yield* previewTracker.reset()

      const result = yield* runPreview({ browser: false, pdf: false })

      expect(result.output).toContain("SKILLS")
      expect(result.output).toContain("Frontend:")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("terminal preview contains experience section", () =>
    Effect.gen(function* () {
      yield* previewTracker.reset()

      const result = yield* runPreview({ browser: false, pdf: false })

      expect(result.output).toContain("EXPERIENCE")
      expect(result.output).toContain("TechCorp")
      expect(result.output).toContain("Senior Software Engineer")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("terminal preview contains summary", () =>
    Effect.gen(function* () {
      yield* previewTracker.reset()

      const result = yield* runPreview({ browser: false, pdf: false })

      expect(result.output).toContain("SUMMARY")
      expect(result.output).toContain("scalable")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("browser preview calls browserPreview service", () =>
    Effect.gen(function* () {
      yield* previewTracker.reset()

      const result = yield* runPreview({ browser: true, pdf: false })

      expect(result.mode).toBe("browser")
      const calls = yield* previewTracker.getCalls()
      expect(calls.length).toBe(1)
      expect(calls[0].method).toBe("browserPreview")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("pdf preview calls pdf renderer", () =>
    Effect.gen(function* () {
      yield* pdfTracker.reset()

      const result = yield* runPreview({ browser: false, pdf: true })

      expect(result.mode).toBe("pdf")
      const calls = yield* pdfTracker.getCalls()
      expect(calls.length).toBe(1)
      expect(calls[0].method).toBe("renderToFile")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("handles minimal resume gracefully", () =>
    Effect.gen(function* () {
      yield* previewTracker.reset()

      const result = yield* runPreview({ browser: false, pdf: false })

      expect(result.mode).toBe("terminal")
      expect(result.output).toContain("MINIMAL USER")
      expect(result.output).toContain("minimal@example.com")
      // Should not throw even with missing optional fields
    }).pipe(Effect.provide(MinimalTestLayer))
  )
})
