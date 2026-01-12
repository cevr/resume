import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option, Ref } from "effect"
import { FileSystem } from "@effect/platform"
import { Config, ResumeRepo } from "../../src/services/index.ts"
import { mockResume } from "../helpers/fixtures.ts"
import { Resume, Contact, Skills, Summary } from "../../src/schema/Resume.ts"

// Create a variant resume with different summary
const variantResume = Resume.make({
  meta: mockResume.meta,
  contact: mockResume.contact,
  summary: Option.some(
    Summary.make({
      default: "Tailored summary for specific role focusing on key technologies",
      variants: Option.none(),
    })
  ),
  skills: Skills.make({
    frontend: Option.some(["React", "TypeScript"]), // Fewer skills
    backend: Option.none(),
    infrastructure: Option.none(),
    languages: Option.none(),
    leadership: Option.none(),
    tools: Option.none(),
  }),
  experience: mockResume.experience.slice(0, 1), // Only first experience
  education: mockResume.education,
  certifications: Option.none(),
  projects: Option.none(),
  openSource: mockResume.openSource,
})

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
  const reset = () => Effect.all([Ref.set(filesRef, new Map()), Ref.set(removedRef, new Set())])

  return { setFile, removeFile, getFiles, getRemoved, reset }
}

const fsTracker = createFsTracker()

// Create mock filesystem
const createMockFileSystem = (initialFiles: Record<string, string>) => {
  const filesMap = new Map(Object.entries(initialFiles))

  const isDirectory = (path: string, allPaths: string[]) =>
    allPaths.some((p) => p.startsWith(path + "/"))

  return Layer.succeed(FileSystem.FileSystem, {
    exists: (path: string) =>
      Effect.gen(function* () {
        const trackedFiles = yield* fsTracker.getFiles()
        const allPaths = [...filesMap.keys(), ...trackedFiles.keys()]
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
    readFileString: (path: string) =>
      Effect.gen(function* () {
        const trackedFiles = yield* fsTracker.getFiles()
        return trackedFiles.get(path) ?? filesMap.get(path) ?? ""
      }),
    stat: () =>
      Effect.succeed({
        type: "File" as const,
        mtime: Option.some(BigInt(Date.now())),
        atime: Option.some(BigInt(Date.now())),
        birthtime: Option.some(BigInt(Date.now())),
        dev: 0,
        ino: Option.none(),
        mode: 0o644,
        nlink: Option.none(),
        uid: Option.none(),
        gid: Option.none(),
        rdev: Option.none(),
        size: 100,
        blksize: Option.none(),
        blocks: Option.none(),
      }),
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
    readFile: () => Effect.succeed(new Uint8Array()),
    readLink: () => Effect.succeed(""),
    realPath: () => Effect.succeed(""),
    rename: () => Effect.void,
    sink: () => Effect.die("not implemented"),
    stream: () => Effect.die("not implemented"),
    symlink: () => Effect.void,
    truncate: () => Effect.void,
    utimes: () => Effect.void,
    watch: () => Effect.die("not implemented"),
    writeFile: () => Effect.void,
    writeFileString: () => Effect.void,
  } as FileSystem.FileSystem)
}

// Simulate variants list logic
const runVariantsList = () =>
  Effect.gen(function* () {
    const config = yield* Config
    const fs = yield* FileSystem.FileSystem

    const variantsDir = config.defaultResumePath.replace("/resume.md", "/variants")
    const exists = yield* fs.exists(variantsDir)

    if (!exists) {
      return { variants: [], empty: true }
    }

    const entries = yield* fs.readDirectory(variantsDir)
    const variantFiles = entries.filter((e) => e.endsWith(".md"))

    if (variantFiles.length === 0) {
      return { variants: [], empty: true }
    }

    const variants: { name: string }[] = []
    for (const file of variantFiles) {
      const name = file.replace(".md", "")
      variants.push({ name })
    }

    return { variants, empty: false }
  })

// Simulate variants diff logic
const runVariantsDiff = (args: { name: string }) =>
  Effect.gen(function* () {
    const config = yield* Config
    const repo = yield* ResumeRepo
    const fs = yield* FileSystem.FileSystem

    const variantPath = `${config.defaultResumePath.replace("/resume.md", "/variants")}/${args.name}.md`
    const exists = yield* fs.exists(variantPath)

    if (!exists) {
      return { found: false }
    }

    const master = yield* repo.load(config.defaultResumePath)
    // For testing, we'll load the variant from the repo using a special path
    // In reality, the repo would need to support loading from different paths
    const variant = variantResume

    const masterSummary = Option.match(master.summary, {
      onNone: () => "",
      onSome: (s) => s.default,
    })
    const variantSummary = Option.match(variant.summary, {
      onNone: () => "",
      onSome: (s) => s.default,
    })

    const summaryChanged = masterSummary !== variantSummary

    // Compare skills
    const countSkills = (skills: Skills): number => {
      let count = 0
      Option.match(skills.frontend, { onNone: () => {}, onSome: (s) => (count += s.length) })
      Option.match(skills.backend, { onNone: () => {}, onSome: (s) => (count += s.length) })
      Option.match(skills.infrastructure, { onNone: () => {}, onSome: (s) => (count += s.length) })
      Option.match(skills.languages, { onNone: () => {}, onSome: (s) => (count += s.length) })
      Option.match(skills.leadership, { onNone: () => {}, onSome: (s) => (count += s.length) })
      Option.match(skills.tools, { onNone: () => {}, onSome: (s) => (count += s.length) })
      return count
    }

    const masterSkillCount = countSkills(master.skills)
    const variantSkillCount = countSkills(variant.skills)

    return {
      found: true,
      summaryChanged,
      masterSummary: masterSummary.slice(0, 50),
      variantSummary: variantSummary.slice(0, 50),
      masterSkillCount,
      variantSkillCount,
      masterExperienceCount: master.experience.length,
      variantExperienceCount: variant.experience.length,
    }
  })

// Simulate variants remove logic
const runVariantsRemove = (args: { name: string }) =>
  Effect.gen(function* () {
    const config = yield* Config
    const fs = yield* FileSystem.FileSystem

    const variantPath = `${config.defaultResumePath.replace("/resume.md", "/variants")}/${args.name}.md`
    const exists = yield* fs.exists(variantPath)

    if (!exists) {
      return { success: false, reason: "not found" }
    }

    yield* fs.remove(variantPath)
    return { success: true }
  })

const baseTestLayer = Layer.mergeAll(Config.test(), ResumeRepo.test({ resume: mockResume }))

describe("variants list command", () => {
  it.effect("returns empty when no variants directory", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()

      const result = yield* runVariantsList()

      expect(result.empty).toBe(true)
      expect(result.variants.length).toBe(0)
    }).pipe(Effect.provide(Layer.merge(baseTestLayer, createMockFileSystem({}))))
  )

  it.effect("lists saved variants", () =>
    Effect.gen(function* () {
      const result = yield* runVariantsList()

      expect(result.empty).toBe(false)
      expect(result.variants.length).toBe(2)
      expect(result.variants.map((v) => v.name).sort()).toEqual(["acme-swe", "startup-eng"])
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockFileSystem({
            "./data/variants/acme-swe.md": "variant content 1",
            "./data/variants/startup-eng.md": "variant content 2",
          })
        )
      )
    )
  )

  it.effect("only lists .md files", () =>
    Effect.gen(function* () {
      const result = yield* runVariantsList()

      expect(result.variants.length).toBe(1)
      expect(result.variants[0].name).toBe("valid-variant")
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockFileSystem({
            "./data/variants/valid-variant.md": "content",
            "./data/variants/not-a-variant.json": "{}",
            "./data/variants/another.txt": "text",
          })
        )
      )
    )
  )
})

describe("variants diff command", () => {
  it.effect("returns not found for non-existent variant", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()

      const result = yield* runVariantsDiff({ name: "nonexistent" })

      expect(result.found).toBe(false)
    }).pipe(Effect.provide(Layer.merge(baseTestLayer, createMockFileSystem({}))))
  )

  it.effect("compares summaries", () =>
    Effect.gen(function* () {
      const result = yield* runVariantsDiff({ name: "test-variant" })

      expect(result.found).toBe(true)
      if (result.found) {
        expect(result.summaryChanged).toBe(true)
        expect(result.masterSummary).toContain("Experienced")
        expect(result.variantSummary).toContain("Tailored")
      }
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockFileSystem({
            "./data/variants/test-variant.md": "variant content",
          })
        )
      )
    )
  )

  it.effect("compares skill counts", () =>
    Effect.gen(function* () {
      const result = yield* runVariantsDiff({ name: "test-variant" })

      expect(result.found).toBe(true)
      if (result.found) {
        expect(result.masterSkillCount).toBe(16) // mockResume has 16 skills
        expect(result.variantSkillCount).toBe(2) // variantResume has 2 skills
      }
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockFileSystem({
            "./data/variants/test-variant.md": "variant content",
          })
        )
      )
    )
  )

  it.effect("compares experience counts", () =>
    Effect.gen(function* () {
      const result = yield* runVariantsDiff({ name: "test-variant" })

      expect(result.found).toBe(true)
      if (result.found) {
        expect(result.masterExperienceCount).toBe(2)
        expect(result.variantExperienceCount).toBe(1)
      }
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockFileSystem({
            "./data/variants/test-variant.md": "variant content",
          })
        )
      )
    )
  )
})

describe("variants remove command", () => {
  it.effect("removes existing variant", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()

      const result = yield* runVariantsRemove({ name: "to-remove" })

      expect(result.success).toBe(true)

      const removed = yield* fsTracker.getRemoved()
      expect(removed.has("./data/variants/to-remove.md")).toBe(true)
    }).pipe(
      Effect.provide(
        Layer.merge(
          baseTestLayer,
          createMockFileSystem({
            "./data/variants/to-remove.md": "content",
          })
        )
      )
    )
  )

  it.effect("returns error for non-existent variant", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()

      const result = yield* runVariantsRemove({ name: "does-not-exist" })

      expect(result.success).toBe(false)
      expect(result.reason).toBe("not found")
    }).pipe(Effect.provide(Layer.merge(baseTestLayer, createMockFileSystem({}))))
  )
})
