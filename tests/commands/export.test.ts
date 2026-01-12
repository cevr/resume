import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option, Ref } from "effect"
import { FileSystem } from "@effect/platform"
import { Config, ResumeRepo, Exporter, PdfRenderer, DocxRenderer } from "../../src/services/index.ts"
import type { ExportFormat } from "../../src/services/Exporter.ts"
import { mockResume } from "../helpers/fixtures.ts"

// Use a shared Ref to track calls across mock services
const createCallTracker = () => {
  const callsRef = Ref.unsafeMake<Array<{ renderer: string; path: string }>>([])

  const recordCall = (renderer: string, path: string) =>
    Ref.update(callsRef, (calls) => [...calls, { renderer, path }])

  const getCalls = () => Ref.get(callsRef)

  const reset = () => Ref.set(callsRef, [])

  return { recordCall, getCalls, reset }
}

// Create a tracker instance for each test
const tracker = createCallTracker()

// Mock renderers that track their calls
const mockPdfRenderer = Layer.succeed(
  PdfRenderer,
  PdfRenderer.of({
    render: () => Effect.succeed(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
    renderToFile: (_, path) => tracker.recordCall("pdf", path),
    getAvailableTemplates: () => Effect.succeed([]),
  })
)

const mockDocxRenderer = Layer.succeed(
  DocxRenderer,
  DocxRenderer.of({
    render: () => Effect.succeed(new Uint8Array([0x50, 0x4b])),
    renderToFile: (_, path) => tracker.recordCall("docx", path),
  })
)

const mockExporter = Layer.succeed(
  Exporter,
  Exporter.of({
    toJson: () => Effect.succeed("{}"),
    toText: () => Effect.succeed("text"),
    export: (_, options) => tracker.recordCall(options.format, options.outputPath),
  })
)

// Mock FileSystem
const mockFileSystem = Layer.succeed(FileSystem.FileSystem, {
  exists: () => Effect.succeed(true),
  readDirectory: () => Effect.succeed([]),
  access: () => Effect.void,
  copy: () => Effect.void,
  copyFile: () => Effect.void,
  chmod: () => Effect.void,
  chown: () => Effect.void,
  link: () => Effect.void,
  makeDirectory: () => Effect.void,
  makeTempDirectory: () => Effect.succeed("/tmp/test"),
  makeTempDirectoryScoped: () => Effect.succeed("/tmp/test"),
  makeTempFile: () => Effect.succeed("/tmp/test.txt"),
  makeTempFileScoped: () => Effect.succeed("/tmp/test.txt"),
  open: () => Effect.die("not implemented"),
  readFile: () => Effect.succeed(new Uint8Array()),
  readFileString: () => Effect.succeed(""),
  readLink: () => Effect.succeed(""),
  realPath: () => Effect.succeed(""),
  remove: () => Effect.void,
  rename: () => Effect.void,
  sink: () => Effect.die("not implemented"),
  stat: () => Effect.die("not implemented"),
  stream: () => Effect.die("not implemented"),
  symlink: () => Effect.void,
  truncate: () => Effect.void,
  utimes: () => Effect.void,
  watch: () => Effect.die("not implemented"),
  writeFile: () => Effect.void,
  writeFileString: () => Effect.void,
} as FileSystem.FileSystem)

// Simulate export command logic
const runExport = (args: {
  format: Option.Option<string>
  output: Option.Option<string>
  template: Option.Option<string>
  all: boolean
  resumePath: Option.Option<string>
}) =>
  Effect.gen(function* () {
    const config = yield* Config
    const repo = yield* ResumeRepo
    const exporter = yield* Exporter
    const pdfRenderer = yield* PdfRenderer
    const docxRenderer = yield* DocxRenderer

    const path = Option.getOrElse(args.resumePath, () => config.defaultResumePath)
    const resume = yield* repo.load(path)

    if (args.all) {
      const formats: ExportFormat[] = ["pdf", "docx", "txt", "json"]
      for (const fmt of formats) {
        const outputPath = `${config.outputDirectory}/resume.${fmt}`
        switch (fmt) {
          case "pdf": {
            const templateName = Option.getOrUndefined(args.template)
            yield* pdfRenderer.renderToFile(resume, outputPath, templateName)
            break
          }
          case "docx": {
            yield* docxRenderer.renderToFile(resume, outputPath)
            break
          }
          case "txt":
          case "json": {
            yield* exporter.export(resume, { format: fmt, outputPath })
            break
          }
        }
      }
      return { success: true, message: "All formats exported" }
    }

    if (Option.isNone(args.format)) {
      return { success: false, message: "--format is required (or use --all)" }
    }

    const fmt = args.format.value as ExportFormat
    const outputPath = Option.getOrElse(args.output, () => {
      return `${config.outputDirectory}/resume.${fmt}`
    })

    switch (fmt) {
      case "pdf": {
        const templateName = Option.getOrUndefined(args.template)
        yield* pdfRenderer.renderToFile(resume, outputPath, templateName)
        break
      }
      case "docx": {
        yield* docxRenderer.renderToFile(resume, outputPath)
        break
      }
      case "txt":
      case "json": {
        yield* exporter.export(resume, { format: fmt, outputPath })
        break
      }
    }

    return { success: true, message: `Exported to ${outputPath}` }
  })

const TestLayer = Layer.mergeAll(
  Config.test(),
  ResumeRepo.test({ resume: mockResume }),
  mockFileSystem,
  mockPdfRenderer,
  mockDocxRenderer,
  mockExporter
)

describe("export command", () => {
  // Reset tracker before each test
  it.effect("exports to PDF with default path", () =>
    Effect.gen(function* () {
      yield* tracker.reset()

      yield* runExport({
        format: Option.some("pdf"),
        output: Option.none(),
        template: Option.none(),
        all: false,
        resumePath: Option.none(),
      })

      const calls = yield* tracker.getCalls()
      expect(calls.length).toBe(1)
      expect(calls[0].renderer).toBe("pdf")
      expect(calls[0].path).toBe("./output/resume.pdf")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("exports to PDF with custom path", () =>
    Effect.gen(function* () {
      yield* tracker.reset()

      yield* runExport({
        format: Option.some("pdf"),
        output: Option.some("./custom/path.pdf"),
        template: Option.none(),
        all: false,
        resumePath: Option.none(),
      })

      const calls = yield* tracker.getCalls()
      expect(calls.length).toBe(1)
      expect(calls[0].path).toBe("./custom/path.pdf")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("exports to DOCX", () =>
    Effect.gen(function* () {
      yield* tracker.reset()

      yield* runExport({
        format: Option.some("docx"),
        output: Option.none(),
        template: Option.none(),
        all: false,
        resumePath: Option.none(),
      })

      const calls = yield* tracker.getCalls()
      expect(calls.length).toBe(1)
      expect(calls[0].renderer).toBe("docx")
      expect(calls[0].path).toBe("./output/resume.docx")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("exports to TXT", () =>
    Effect.gen(function* () {
      yield* tracker.reset()

      yield* runExport({
        format: Option.some("txt"),
        output: Option.none(),
        template: Option.none(),
        all: false,
        resumePath: Option.none(),
      })

      const calls = yield* tracker.getCalls()
      expect(calls.length).toBe(1)
      expect(calls[0].renderer).toBe("txt")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("exports to JSON", () =>
    Effect.gen(function* () {
      yield* tracker.reset()

      yield* runExport({
        format: Option.some("json"),
        output: Option.none(),
        template: Option.none(),
        all: false,
        resumePath: Option.none(),
      })

      const calls = yield* tracker.getCalls()
      expect(calls.length).toBe(1)
      expect(calls[0].renderer).toBe("json")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("exports all formats with --all flag", () =>
    Effect.gen(function* () {
      yield* tracker.reset()

      yield* runExport({
        format: Option.none(),
        output: Option.none(),
        template: Option.none(),
        all: true,
        resumePath: Option.none(),
      })

      const calls = yield* tracker.getCalls()
      expect(calls.length).toBe(4)
      expect(calls.map((c) => c.renderer).sort()).toEqual(["docx", "json", "pdf", "txt"])
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("requires format when not using --all", () =>
    Effect.gen(function* () {
      yield* tracker.reset()

      const result = yield* runExport({
        format: Option.none(),
        output: Option.none(),
        template: Option.none(),
        all: false,
        resumePath: Option.none(),
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain("--format is required")
    }).pipe(Effect.provide(TestLayer))
  )
})
