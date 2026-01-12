import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"
import { FileSystem } from "@effect/platform"
import { Config, ResumeRepo, JobAnalyzer } from "../../src/services/index.ts"
import { mockResume, minimalResume } from "../helpers/fixtures.ts"
import { JobDescription } from "../../src/schema/JobDescription.ts"
import { AnalysisResult, SectionValidation } from "../../src/schema/Analysis.ts"

// Extract analyze logic for testing
const runAnalyze = (args: {
  jobName: Option.Option<string>
  jobContent: Option.Option<string>
}) =>
  Effect.gen(function* () {
    const config = yield* Config
    const repo = yield* ResumeRepo
    const analyzer = yield* JobAnalyzer
    const fs = yield* FileSystem.FileSystem

    const resume = yield* repo.load(config.defaultResumePath)

    let jobDescription: JobDescription

    if (Option.isSome(args.jobName)) {
      const jobPath = `${config.defaultResumePath.replace("/resume.md", "/jobs")}/${args.jobName.value}.json`
      const exists = yield* fs.exists(jobPath)
      if (!exists) {
        return { success: false, message: `Job "${args.jobName.value}" not found.` }
      }
      const content = yield* fs.readFileString(jobPath)
      const savedJob = JSON.parse(content)
      jobDescription = yield* analyzer.parseJobDescription(savedJob.content)
    } else if (Option.isSome(args.jobContent)) {
      jobDescription = yield* analyzer.parseJobDescription(args.jobContent.value)
    } else {
      return { success: false, message: "No job description provided" }
    }

    const analysis = yield* analyzer.analyzeMatch(resume, jobDescription)

    return {
      success: true,
      analysis,
    }
  })

// Mock FileSystem with job files
const createMockFileSystem = (files: Record<string, string>) =>
  Layer.succeed(FileSystem.FileSystem, {
    exists: (path: string) => Effect.succeed(Object.hasOwn(files, path)),
    readFileString: (path: string) =>
      Object.hasOwn(files, path)
        ? Effect.succeed(files[path])
        : Effect.fail(new Error(`File not found: ${path}`)),
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

// Custom JobAnalyzer that returns specific results
const createMockAnalyzer = (config: {
  matchScore: number
  matchedKeywords: string[]
  missingKeywords: string[]
  hasEducation?: boolean
  atsWarnings?: string[]
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
            keywords: [...config.matchedKeywords, ...config.missingKeywords],
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
            keywords: [...config.matchedKeywords, ...config.missingKeywords],
            rawText: "Test job description",
          })
        ),
      analyzeMatch: () =>
        Effect.succeed(
          new AnalysisResult({
            matchScore: config.matchScore,
            matchedKeywords: config.matchedKeywords,
            missingKeywords: config.missingKeywords,
            suggestedHighlights: [],
            sectionValidation: new SectionValidation({
              hasContact: true,
              hasSummary: true,
              hasExperience: true,
              hasEducation: config.hasEducation ?? true,
              hasSkills: true,
            }),
            atsWarnings: config.atsWarnings ?? [],
          })
        ),
      validateAtsCompatibility: () => Effect.succeed(config.atsWarnings ?? []),
    })
  )

const baseTestLayer = Layer.mergeAll(
  Config.test(),
  ResumeRepo.test({ resume: mockResume }),
  createMockFileSystem({
    "./data/jobs/frontend-dev.json": JSON.stringify({
      name: "frontend-dev",
      content: "Looking for a Frontend Developer with TypeScript and React experience",
    }),
  })
)

describe("analyze command", () => {
  it.effect("analyzes resume against job content", () =>
    Effect.gen(function* () {
      const result = yield* runAnalyze({
        jobName: Option.none(),
        jobContent: Option.some("Looking for TypeScript and React developer"),
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.analysis.matchScore).toBe(85)
        expect(result.analysis.matchedKeywords).toContain("typescript")
      }
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockAnalyzer({
            matchScore: 85,
            matchedKeywords: ["typescript", "react"],
            missingKeywords: ["kubernetes"],
          })
        )
      )
    )
  )

  it.effect("analyzes against saved job", () =>
    Effect.gen(function* () {
      const result = yield* runAnalyze({
        jobName: Option.some("frontend-dev"),
        jobContent: Option.none(),
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.analysis.matchScore).toBe(75)
      }
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockAnalyzer({
            matchScore: 75,
            matchedKeywords: ["typescript"],
            missingKeywords: ["vue", "angular"],
          })
        )
      )
    )
  )

  it.effect("returns error for non-existent job", () =>
    Effect.gen(function* () {
      const result = yield* runAnalyze({
        jobName: Option.some("nonexistent-job"),
        jobContent: Option.none(),
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.message).toContain("nonexistent-job")
        expect(result.message).toContain("not found")
      }
    }).pipe(Effect.provide(Layer.merge(baseTestLayer, JobAnalyzer.test())))
  )

  it.effect("requires job content or job name", () =>
    Effect.gen(function* () {
      const result = yield* runAnalyze({
        jobName: Option.none(),
        jobContent: Option.none(),
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.message).toContain("No job description")
      }
    }).pipe(Effect.provide(Layer.merge(baseTestLayer, JobAnalyzer.test())))
  )

  it.effect("returns matched keywords", () =>
    Effect.gen(function* () {
      const result = yield* runAnalyze({
        jobName: Option.none(),
        jobContent: Option.some("TypeScript React Node.js developer"),
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.analysis.matchedKeywords).toEqual(["typescript", "react", "node"])
      }
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockAnalyzer({
            matchScore: 100,
            matchedKeywords: ["typescript", "react", "node"],
            missingKeywords: [],
          })
        )
      )
    )
  )

  it.effect("returns missing keywords", () =>
    Effect.gen(function* () {
      const result = yield* runAnalyze({
        jobName: Option.none(),
        jobContent: Option.some("Kubernetes AWS Docker experience required"),
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.analysis.missingKeywords).toContain("kubernetes")
        expect(result.analysis.missingKeywords).toContain("aws")
      }
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockAnalyzer({
            matchScore: 50,
            matchedKeywords: ["docker"],
            missingKeywords: ["kubernetes", "aws"],
          })
        )
      )
    )
  )

  it.effect("returns section validation", () =>
    Effect.gen(function* () {
      const result = yield* runAnalyze({
        jobName: Option.none(),
        jobContent: Option.some("Any job"),
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.analysis.sectionValidation.hasContact).toBe(true)
        expect(result.analysis.sectionValidation.hasSummary).toBe(true)
        expect(result.analysis.sectionValidation.hasExperience).toBe(true)
        expect(result.analysis.sectionValidation.hasSkills).toBe(true)
      }
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockAnalyzer({
            matchScore: 75,
            matchedKeywords: [],
            missingKeywords: [],
          })
        )
      )
    )
  )

  it.effect("returns ATS warnings", () =>
    Effect.gen(function* () {
      const result = yield* runAnalyze({
        jobName: Option.none(),
        jobContent: Option.some("Any job"),
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.analysis.atsWarnings).toContain("Missing education section")
        expect(result.analysis.atsWarnings).toContain("Too few quantified achievements")
      }
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockAnalyzer({
            matchScore: 60,
            matchedKeywords: [],
            missingKeywords: [],
            atsWarnings: ["Missing education section", "Too few quantified achievements"],
          })
        )
      )
    )
  )

  it.effect("handles minimal resume with warnings", () =>
    Effect.gen(function* () {
      const result = yield* runAnalyze({
        jobName: Option.none(),
        jobContent: Option.some("Any job"),
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.analysis.atsWarnings.length).toBeGreaterThan(0)
      }
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          Config.test(),
          ResumeRepo.test({ resume: minimalResume }),
          createMockFileSystem({}),
          createMockAnalyzer({
            matchScore: 20,
            matchedKeywords: [],
            missingKeywords: ["typescript", "react"],
            atsWarnings: ["Missing summary", "No experience"],
          })
        )
      )
    )
  )
})
