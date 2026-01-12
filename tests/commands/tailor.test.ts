import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option, Ref } from "effect"
import { FileSystem } from "@effect/platform"
import { Config, ResumeRepo, JobAnalyzer } from "../../src/services/index.ts"
import { mockResume } from "../helpers/fixtures.ts"
import { AnalysisResult, SectionValidation } from "../../src/schema/Analysis.ts"
import { JobDescription } from "../../src/schema/JobDescription.ts"

// Track filesystem operations
const createFsTracker = () => {
  const dirsCreatedRef = Ref.unsafeMake<Set<string>>(new Set())

  const recordDirCreated = (path: string) =>
    Ref.update(dirsCreatedRef, (dirs) => {
      const newDirs = new Set(dirs)
      newDirs.add(path)
      return newDirs
    })

  const getDirsCreated = () => Ref.get(dirsCreatedRef)
  const reset = () => Ref.set(dirsCreatedRef, new Set())

  return { recordDirCreated, getDirsCreated, reset }
}

const fsTracker = createFsTracker()

// Track saved resumes
const createSaveTracker = () => {
  const savedRef = Ref.unsafeMake<Array<{ path: string }>>([])

  const recordSave = (path: string) =>
    Ref.update(savedRef, (saved) => [...saved, { path }])

  const getSaved = () => Ref.get(savedRef)
  const reset = () => Ref.set(savedRef, [])

  return { recordSave, getSaved, reset }
}

const saveTracker = createSaveTracker()

// Mock FileSystem
const mockFileSystem = Layer.succeed(FileSystem.FileSystem, {
  exists: () => Effect.succeed(false),
  readDirectory: () => Effect.succeed([]),
  makeDirectory: (path: string) =>
    Effect.gen(function* () {
      yield* fsTracker.recordDirCreated(path)
    }),
  access: () => Effect.void,
  copy: () => Effect.void,
  copyFile: () => Effect.void,
  chmod: () => Effect.void,
  chown: () => Effect.void,
  link: () => Effect.void,
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

// Custom ResumeRepo that tracks saves
const createMockResumeRepo = () =>
  Layer.succeed(
    ResumeRepo,
    ResumeRepo.of({
      load: () => Effect.succeed(mockResume),
      save: (path) =>
        Effect.gen(function* () {
          yield* saveTracker.recordSave(path)
        }),
    })
  )

// Mock JobAnalyzer with configurable results
const createMockAnalyzer = (config: {
  matchScore: number
  missingKeywords: string[]
}) =>
  Layer.succeed(
    JobAnalyzer,
    JobAnalyzer.of({
      parseJobDescription: (text) =>
        Effect.succeed(
          new JobDescription({
            title: Option.none(),
            company: Option.none(),
            requirements: [],
            responsibilities: [],
            keywords: config.missingKeywords,
            rawText: text,
          })
        ),
      fetchJobDescription: () =>
        Effect.succeed(
          new JobDescription({
            title: Option.none(),
            company: Option.none(),
            requirements: [],
            responsibilities: [],
            keywords: config.missingKeywords,
            rawText: "Fetched job description",
          })
        ),
      analyzeMatch: () =>
        Effect.succeed(
          new AnalysisResult({
            matchScore: config.matchScore,
            matchedKeywords: ["typescript", "react"],
            missingKeywords: config.missingKeywords,
            suggestedHighlights: [],
            sectionValidation: new SectionValidation({
              hasContact: true,
              hasSummary: true,
              hasExperience: true,
              hasEducation: true,
              hasSkills: true,
            }),
            atsWarnings: [],
          })
        ),
      validateAtsCompatibility: () => Effect.succeed([]),
    })
  )

// Simulate tailor command logic
const runTailor = (args: {
  jobContent: Option.Option<string>
  name: Option.Option<string>
  output: Option.Option<string>
}) =>
  Effect.gen(function* () {
    const config = yield* Config
    const repo = yield* ResumeRepo
    const analyzer = yield* JobAnalyzer
    const fs = yield* FileSystem.FileSystem

    const resume = yield* repo.load(config.defaultResumePath)

    // Get job description
    let jobDescription: JobDescription
    if (Option.isSome(args.jobContent)) {
      jobDescription = yield* analyzer.parseJobDescription(args.jobContent.value)
    } else {
      return { success: false, reason: "No job description provided" }
    }

    const analysis = yield* analyzer.analyzeMatch(resume, jobDescription)

    // Determine variant name and output path
    const variant = Option.getOrElse(args.name, () => `tailored-test`)
    const finalPath = Option.getOrElse(args.output, () => `./data/variants/${variant}.md`)

    // Ensure variants directory exists
    yield* fs.makeDirectory("./data/variants", { recursive: true }).pipe(
      Effect.catchAll(() => Effect.void)
    )

    // Save tailored resume
    yield* repo.save(finalPath, resume)

    return {
      success: true,
      path: finalPath,
      variantName: variant,
      matchScore: analysis.matchScore,
      missingKeywords: analysis.missingKeywords,
    }
  })

const baseTestLayer = Layer.mergeAll(Config.test(), mockFileSystem, createMockResumeRepo())

describe("tailor command", () => {
  it.effect("creates tailored variant from job content", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()
      yield* saveTracker.reset()

      const result = yield* runTailor({
        jobContent: Option.some("Looking for TypeScript developer"),
        name: Option.some("company-role"),
        output: Option.none(),
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.variantName).toBe("company-role")
        expect(result.path).toBe("./data/variants/company-role.md")
      }
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockAnalyzer({ matchScore: 75, missingKeywords: ["kubernetes", "aws"] })
        )
      )
    )
  )

  it.effect("creates variants directory", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()
      yield* saveTracker.reset()

      yield* runTailor({
        jobContent: Option.some("Any job description"),
        name: Option.some("test"),
        output: Option.none(),
      })

      const dirs = yield* fsTracker.getDirsCreated()
      expect(dirs.has("./data/variants")).toBe(true)
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockAnalyzer({ matchScore: 80, missingKeywords: [] })
        )
      )
    )
  )

  it.effect("saves resume to variants directory", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()
      yield* saveTracker.reset()

      yield* runTailor({
        jobContent: Option.some("Job description"),
        name: Option.some("saved-variant"),
        output: Option.none(),
      })

      const saved = yield* saveTracker.getSaved()
      expect(saved.length).toBe(1)
      expect(saved[0].path).toBe("./data/variants/saved-variant.md")
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockAnalyzer({ matchScore: 70, missingKeywords: ["docker"] })
        )
      )
    )
  )

  it.effect("uses custom output path when provided", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()
      yield* saveTracker.reset()

      const result = yield* runTailor({
        jobContent: Option.some("Job description"),
        name: Option.none(),
        output: Option.some("./custom/output.md"),
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.path).toBe("./custom/output.md")
      }
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockAnalyzer({ matchScore: 85, missingKeywords: [] })
        )
      )
    )
  )

  it.effect("returns match score", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()
      yield* saveTracker.reset()

      const result = yield* runTailor({
        jobContent: Option.some("Job description"),
        name: Option.some("test"),
        output: Option.none(),
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.matchScore).toBe(65)
      }
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockAnalyzer({ matchScore: 65, missingKeywords: ["graphql"] })
        )
      )
    )
  )

  it.effect("returns missing keywords", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()
      yield* saveTracker.reset()

      const result = yield* runTailor({
        jobContent: Option.some("Need kubernetes and AWS experience"),
        name: Option.some("test"),
        output: Option.none(),
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.missingKeywords).toContain("kubernetes")
        expect(result.missingKeywords).toContain("aws")
      }
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockAnalyzer({ matchScore: 50, missingKeywords: ["kubernetes", "aws", "terraform"] })
        )
      )
    )
  )

  it.effect("generates default variant name when not provided", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()
      yield* saveTracker.reset()

      const result = yield* runTailor({
        jobContent: Option.some("Job description"),
        name: Option.none(),
        output: Option.none(),
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.variantName).toBe("tailored-test")
      }
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockAnalyzer({ matchScore: 75, missingKeywords: [] })
        )
      )
    )
  )

  it.effect("requires job content", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()
      yield* saveTracker.reset()

      const result = yield* runTailor({
        jobContent: Option.none(),
        name: Option.some("test"),
        output: Option.none(),
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.reason).toContain("No job description")
      }
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockAnalyzer({ matchScore: 75, missingKeywords: [] })
        )
      )
    )
  )
})
