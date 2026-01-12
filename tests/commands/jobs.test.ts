import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Ref } from "effect"
import { FileSystem } from "@effect/platform"
import { Config, ResumeRepo, JobAnalyzer } from "../../src/services/index.ts"
import { mockResume } from "../helpers/fixtures.ts"

interface SavedJob {
  name: string
  source: string
  addedAt: string
  content: string
  keywords: readonly string[]
  matchScore: number
}

// Track filesystem operations
const createFsTracker = () => {
  const filesRef = Ref.unsafeMake<Map<string, string>>(new Map())
  const removedRef = Ref.unsafeMake<Set<string>>(new Set())

  const setFile = (path: string, content: string) =>
    Ref.update(filesRef, (files) => {
      const newFiles = new Map(files)
      newFiles.set(path, content)
      return newFiles
    })

  const removeFile = (path: string) =>
    Effect.all([
      Ref.update(filesRef, (files) => {
        const newFiles = new Map(files)
        newFiles.delete(path)
        return newFiles
      }),
      Ref.update(removedRef, (removed) => {
        const newRemoved = new Set(removed)
        newRemoved.add(path)
        return newRemoved
      }),
    ])

  const getFiles = () => Ref.get(filesRef)
  const getRemoved = () => Ref.get(removedRef)

  const reset = (initialFiles: Map<string, string> = new Map()) =>
    Effect.all([Ref.set(filesRef, initialFiles), Ref.set(removedRef, new Set())])

  return { setFile, removeFile, getFiles, getRemoved, reset }
}

const fsTracker = createFsTracker()

// Create mock filesystem with tracked operations
const createMockFileSystem = (initialFiles: Record<string, string>) => {
  const filesMap = new Map(Object.entries(initialFiles))

  // Check if a path is a directory (has files under it)
  const isDirectory = (path: string, allPaths: string[]) =>
    allPaths.some((p) => p.startsWith(path + "/"))

  return Layer.succeed(FileSystem.FileSystem, {
    exists: (path: string) =>
      Effect.gen(function* () {
        const trackedFiles = yield* fsTracker.getFiles()
        const allPaths = [...filesMap.keys(), ...trackedFiles.keys()]
        // Check if path is a file or a directory
        return allPaths.includes(path) || isDirectory(path, allPaths)
      }),
    readDirectory: (path: string) =>
      Effect.gen(function* () {
        const trackedFiles = yield* fsTracker.getFiles()
        const allPaths = [...filesMap.keys(), ...trackedFiles.keys()]
        const entries = new Set<string>()
        for (const p of allPaths) {
          if (p.startsWith(path + "/")) {
            const rest = p.slice(path.length + 1)
            const entry = rest.split("/")[0]
            if (entry) entries.add(entry)
          }
        }
        return Array.from(entries)
      }),
    readFile: (path: string) =>
      Effect.gen(function* () {
        const trackedFiles = yield* fsTracker.getFiles()
        const content = trackedFiles.get(path) ?? filesMap.get(path)
        return new TextEncoder().encode(content ?? "")
      }),
    readFileString: (path: string) =>
      Effect.gen(function* () {
        const trackedFiles = yield* fsTracker.getFiles()
        return trackedFiles.get(path) ?? filesMap.get(path) ?? ""
      }),
    writeFileString: (path: string, content: string) => fsTracker.setFile(path, content),
    remove: (path: string) => fsTracker.removeFile(path).pipe(Effect.asVoid),
    makeDirectory: () => Effect.void,
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
    readLink: () => Effect.succeed(""),
    realPath: () => Effect.succeed(""),
    rename: () => Effect.void,
    sink: () => Effect.die("not implemented"),
    stat: () => Effect.die("not implemented"),
    stream: () => Effect.die("not implemented"),
    symlink: () => Effect.void,
    truncate: () => Effect.void,
    utimes: () => Effect.void,
    watch: () => Effect.die("not implemented"),
    writeFile: () => Effect.void,
  } as FileSystem.FileSystem)
}

// Simulate jobs add logic
const runJobsAdd = (args: { name: string; source: string; isUrl: boolean; content: string }) =>
  Effect.gen(function* () {
    const config = yield* Config
    const fs = yield* FileSystem.FileSystem
    const analyzer = yield* JobAnalyzer
    const repo = yield* ResumeRepo

    const content = args.content

    const jobDesc = yield* analyzer.parseJobDescription(content)
    const resume = yield* repo.load(config.defaultResumePath)
    const analysis = yield* analyzer.analyzeMatch(resume, jobDesc)

    const jobsDir = config.defaultResumePath.replace("/resume.md", "/jobs")
    const exists = yield* fs.exists(jobsDir)
    if (!exists) {
      yield* fs.makeDirectory(jobsDir, { recursive: true })
    }

    const savedJob: SavedJob = {
      name: args.name,
      source: args.source,
      addedAt: new Date().toISOString().split("T")[0] ?? "",
      content,
      keywords: jobDesc.keywords,
      matchScore: analysis.matchScore,
    }

    const jobPath = `${jobsDir}/${args.name}.json`
    yield* fs.writeFileString(jobPath, JSON.stringify(savedJob, null, 2))

    return {
      success: true,
      name: args.name,
      matchScore: analysis.matchScore,
      keywords: jobDesc.keywords,
    }
  })

// Simulate jobs list logic
const runJobsList = () =>
  Effect.gen(function* () {
    const config = yield* Config
    const fs = yield* FileSystem.FileSystem

    const jobsDir = config.defaultResumePath.replace("/resume.md", "/jobs")
    const exists = yield* fs.exists(jobsDir)

    if (!exists) {
      return { jobs: [], empty: true }
    }

    const entries = yield* fs.readDirectory(jobsDir)
    const jobFiles = entries.filter((e) => e.endsWith(".json"))

    if (jobFiles.length === 0) {
      return { jobs: [], empty: true }
    }

    const jobs: SavedJob[] = []
    for (const file of jobFiles) {
      const content = yield* fs.readFileString(`${jobsDir}/${file}`)
      jobs.push(JSON.parse(content) as SavedJob)
    }

    return { jobs, empty: false }
  })

// Simulate jobs remove logic
const runJobsRemove = (args: { name: string }) =>
  Effect.gen(function* () {
    const config = yield* Config
    const fs = yield* FileSystem.FileSystem

    const jobPath = `${config.defaultResumePath.replace("/resume.md", "/jobs")}/${args.name}.json`
    const exists = yield* fs.exists(jobPath)

    if (!exists) {
      return { success: false, reason: "not found" }
    }

    yield* fs.remove(jobPath)
    return { success: true }
  })

const baseTestLayer = Layer.mergeAll(
  Config.test(),
  ResumeRepo.test({ resume: mockResume }),
  JobAnalyzer.test({ score: 75 })
)

describe("jobs add command", () => {
  it.effect("adds job from file content", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()

      const result = yield* runJobsAdd({
        name: "acme-swe",
        source: "./job.txt",
        isUrl: false,
        content: "Looking for a TypeScript developer with React experience",
      })

      expect(result.success).toBe(true)
      expect(result.name).toBe("acme-swe")
      expect(result.matchScore).toBe(75)

      const files = yield* fsTracker.getFiles()
      expect(files.has("./data/jobs/acme-swe.json")).toBe(true)
    }).pipe(Effect.provide(Layer.merge(baseTestLayer, createMockFileSystem({}))))
  )

  it.effect("saves job with correct structure", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()

      yield* runJobsAdd({
        name: "startup-eng",
        source: "https://example.com/job",
        isUrl: true,
        content: "Senior Engineer needed",
      })

      const files = yield* fsTracker.getFiles()
      const jobContent = files.get("./data/jobs/startup-eng.json")
      expect(jobContent).toBeDefined()

      const savedJob = JSON.parse(jobContent!) as SavedJob
      expect(savedJob.name).toBe("startup-eng")
      expect(savedJob.source).toBe("https://example.com/job")
      expect(savedJob.content).toBe("Senior Engineer needed")
      expect(savedJob.matchScore).toBe(75)
      expect(savedJob.addedAt).toBeDefined()
    }).pipe(Effect.provide(Layer.merge(baseTestLayer, createMockFileSystem({}))))
  )
})

describe("jobs list command", () => {
  it.effect("returns empty when no jobs directory", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()

      const result = yield* runJobsList()

      expect(result.empty).toBe(true)
      expect(result.jobs.length).toBe(0)
    }).pipe(Effect.provide(Layer.merge(baseTestLayer, createMockFileSystem({}))))
  )

  it.effect("lists saved jobs", () =>
    Effect.gen(function* () {
      // Don't reset - use the initial files from createMockFileSystem

      const result = yield* runJobsList()

      expect(result.empty).toBe(false)
      expect(result.jobs.length).toBe(2)
      expect(result.jobs.map((j) => j.name).sort()).toEqual(["job1", "job2"])
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockFileSystem({
            "./data/jobs/job1.json": JSON.stringify({
              name: "job1",
              source: "url1",
              addedAt: "2024-01-01",
              content: "content1",
              keywords: ["ts"],
              matchScore: 80,
            }),
            "./data/jobs/job2.json": JSON.stringify({
              name: "job2",
              source: "url2",
              addedAt: "2024-01-02",
              content: "content2",
              keywords: ["react"],
              matchScore: 70,
            }),
          })
        )
      )
    )
  )

  it.effect("returns match scores", () =>
    Effect.gen(function* () {
      // Don't reset - use the initial files from createMockFileSystem

      const result = yield* runJobsList()

      expect(result.jobs[0]?.matchScore).toBe(85)
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockFileSystem({
            "./data/jobs/test-job.json": JSON.stringify({
              name: "test-job",
              source: "test",
              addedAt: "2024-01-01",
              content: "test",
              keywords: [],
              matchScore: 85,
            }),
          })
        )
      )
    )
  )
})

describe("jobs remove command", () => {
  it.effect("removes existing job", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset(
        new Map([["./data/jobs/to-remove.json", JSON.stringify({ name: "to-remove" })]])
      )

      const result = yield* runJobsRemove({ name: "to-remove" })

      expect(result.success).toBe(true)

      const removed = yield* fsTracker.getRemoved()
      expect(removed.has("./data/jobs/to-remove.json")).toBe(true)
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockFileSystem({
            "./data/jobs/to-remove.json": JSON.stringify({ name: "to-remove" }),
          })
        )
      )
    )
  )

  it.effect("returns error for non-existent job", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()

      const result = yield* runJobsRemove({ name: "does-not-exist" })

      expect(result.success).toBe(false)
      expect(result.reason).toBe("not found")
    }).pipe(Effect.provide(Layer.merge(baseTestLayer, createMockFileSystem({}))))
  )
})
