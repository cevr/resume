import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"
import { Config, ResumeRepo, JobAnalyzer } from "../../src/services/index.ts"
import { mockResume, minimalResume } from "../helpers/fixtures.ts"

// Extract validation logic for testing - returns validation results
const runValidate = (args: { strict: boolean }) =>
  Effect.gen(function* () {
    const config = yield* Config
    const repo = yield* ResumeRepo
    const analyzer = yield* JobAnalyzer

    const resume = yield* repo.load(config.defaultResumePath)
    const warnings = yield* analyzer.validateAtsCompatibility(resume)

    // Basic structure info
    const hasSummary = Option.isSome(resume.summary)
    const experienceCount = resume.experience.length
    const totalHighlights = resume.experience.reduce(
      (sum, exp) => sum + exp.highlights.length,
      0
    )

    // Skills count
    let skillCount = 0
    Option.match(resume.skills.frontend, {
      onNone: () => {},
      onSome: (s) => (skillCount += s.length),
    })
    Option.match(resume.skills.backend, {
      onNone: () => {},
      onSome: (s) => (skillCount += s.length),
    })
    Option.match(resume.skills.infrastructure, {
      onNone: () => {},
      onSome: (s) => (skillCount += s.length),
    })
    Option.match(resume.skills.languages, {
      onNone: () => {},
      onSome: (s) => (skillCount += s.length),
    })
    Option.match(resume.skills.leadership, {
      onNone: () => {},
      onSome: (s) => (skillCount += s.length),
    })
    Option.match(resume.skills.tools, {
      onNone: () => {},
      onSome: (s) => (skillCount += s.length),
    })

    // Education
    const hasEducation = Option.isSome(resume.education)
    const educationCount = Option.match(resume.education, {
      onNone: () => 0,
      onSome: (e) => e.length,
    })

    // Strict mode checks
    let unquantifiedHighlights = 0
    const missingContactFields: string[] = []

    if (args.strict) {
      for (const exp of resume.experience) {
        for (const h of exp.highlights) {
          if (!/\d/.test(h.text)) unquantifiedHighlights++
        }
      }

      if (Option.isNone(resume.contact.phone)) missingContactFields.push("phone")
      if (Option.isNone(resume.contact.linkedin)) missingContactFields.push("linkedin")
      if (Option.isNone(resume.contact.github)) missingContactFields.push("github")
      if (Option.isNone(resume.contact.website)) missingContactFields.push("website")
    }

    return {
      valid: true,
      contact: {
        name: resume.contact.name,
        email: resume.contact.email,
      },
      hasSummary,
      experienceCount,
      totalHighlights,
      skillCount,
      hasEducation,
      educationCount,
      atsWarnings: warnings,
      strictMode: args.strict
        ? {
            unquantifiedHighlights,
            missingContactFields,
          }
        : null,
    }
  })

const TestLayer = Layer.mergeAll(
  Config.test(),
  ResumeRepo.test({ resume: mockResume }),
  JobAnalyzer.test({ atsWarnings: [] })
)

const MinimalTestLayer = Layer.mergeAll(
  Config.test(),
  ResumeRepo.test({ resume: minimalResume }),
  JobAnalyzer.test({ atsWarnings: ["Missing summary", "No experience"] })
)

describe("validate command", () => {
  it.effect("validates resume successfully", () =>
    Effect.gen(function* () {
      const result = yield* runValidate({ strict: false })

      expect(result.valid).toBe(true)
      expect(result.contact.name).toBe("Test User")
      expect(result.contact.email).toBe("test@example.com")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("reports summary present", () =>
    Effect.gen(function* () {
      const result = yield* runValidate({ strict: false })

      expect(result.hasSummary).toBe(true)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("reports summary missing for minimal resume", () =>
    Effect.gen(function* () {
      const result = yield* runValidate({ strict: false })

      expect(result.hasSummary).toBe(false)
    }).pipe(Effect.provide(MinimalTestLayer))
  )

  it.effect("counts experience positions", () =>
    Effect.gen(function* () {
      const result = yield* runValidate({ strict: false })

      // mockResume has 2 experience entries
      expect(result.experienceCount).toBe(2)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("counts highlights", () =>
    Effect.gen(function* () {
      const result = yield* runValidate({ strict: false })

      // mockResume has 5 total highlights (3 + 2)
      expect(result.totalHighlights).toBe(5)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("counts skills", () =>
    Effect.gen(function* () {
      const result = yield* runValidate({ strict: false })

      // mockResume has 3+3+3+3+2+2 = 16 skills
      expect(result.skillCount).toBe(16)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("reports education when present", () =>
    Effect.gen(function* () {
      const result = yield* runValidate({ strict: false })

      expect(result.hasEducation).toBe(true)
      expect(result.educationCount).toBe(1)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("reports no education for minimal resume", () =>
    Effect.gen(function* () {
      const result = yield* runValidate({ strict: false })

      expect(result.hasEducation).toBe(false)
      expect(result.educationCount).toBe(0)
    }).pipe(Effect.provide(MinimalTestLayer))
  )

  it.effect("returns ATS warnings when present", () =>
    Effect.gen(function* () {
      const result = yield* runValidate({ strict: false })

      expect(result.atsWarnings).toContain("Missing summary")
      expect(result.atsWarnings).toContain("No experience")
    }).pipe(Effect.provide(MinimalTestLayer))
  )

  it.effect("returns no ATS warnings when none", () =>
    Effect.gen(function* () {
      const result = yield* runValidate({ strict: false })

      expect(result.atsWarnings.length).toBe(0)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("strict mode checks unquantified highlights", () =>
    Effect.gen(function* () {
      const result = yield* runValidate({ strict: true })

      expect(result.strictMode).not.toBeNull()
      // Our mockResume has 1 unquantified highlight
      expect(result.strictMode!.unquantifiedHighlights).toBe(1)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("strict mode lists missing contact fields", () =>
    Effect.gen(function* () {
      const result = yield* runValidate({ strict: true })

      expect(result.strictMode).not.toBeNull()
      // mockResume has phone and linkedin but no github, website
      expect(result.strictMode!.missingContactFields).not.toContain("phone")
      expect(result.strictMode!.missingContactFields).not.toContain("linkedin")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("non-strict mode does not include strict checks", () =>
    Effect.gen(function* () {
      const result = yield* runValidate({ strict: false })

      expect(result.strictMode).toBeNull()
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("handles minimal resume with zero experience", () =>
    Effect.gen(function* () {
      const result = yield* runValidate({ strict: false })

      expect(result.experienceCount).toBe(0)
      expect(result.totalHighlights).toBe(0)
    }).pipe(Effect.provide(MinimalTestLayer))
  )
})
