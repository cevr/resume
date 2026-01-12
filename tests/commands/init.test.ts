import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Ref } from "effect"
import { FileSystem } from "@effect/platform"

// Track filesystem operations
const createFsTracker = () => {
  const operationsRef = Ref.unsafeMake<Array<{ op: string; path: string; content?: string }>>([])
  const filesRef = Ref.unsafeMake<Map<string, string>>(new Map())

  const recordOp = (op: string, path: string, content?: string) =>
    Ref.update(operationsRef, (ops) => [...ops, { op, path, content }])

  const setFile = (path: string, content: string) =>
    Ref.update(filesRef, (files) => {
      const newFiles = new Map(files)
      newFiles.set(path, content)
      return newFiles
    })

  const getOps = () => Ref.get(operationsRef)
  const getFiles = () => Ref.get(filesRef)
  const reset = () =>
    Effect.all([
      Ref.set(operationsRef, []),
      Ref.set(filesRef, new Map()),
    ])

  return { recordOp, setFile, getOps, getFiles, reset }
}

const fsTracker = createFsTracker()

// Mock FileSystem that tracks writes
const createMockFileSystem = (existingFiles: Set<string>) =>
  Layer.succeed(FileSystem.FileSystem, {
    exists: (path: string) => Effect.succeed(existingFiles.has(path)),
    readDirectory: () => Effect.succeed([]),
    access: () => Effect.void,
    copy: () => Effect.void,
    copyFile: () => Effect.void,
    chmod: () => Effect.void,
    chown: () => Effect.void,
    link: () => Effect.void,
    makeDirectory: (path: string) =>
      Effect.gen(function* () {
        yield* fsTracker.recordOp("makeDirectory", path)
      }),
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
    writeFileString: (path: string, content: string) =>
      Effect.gen(function* () {
        yield* fsTracker.recordOp("writeFileString", path, content)
        yield* fsTracker.setFile(path, content)
      }),
  } as FileSystem.FileSystem)

// Simulate init command logic without the interactive prompt
const runInit = (args: { confirmOverwrite: boolean }) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const exists = yield* fs.exists("./data/resume.md")

    if (exists) {
      if (!args.confirmOverwrite) {
        return { success: false, action: "aborted", reason: "user declined overwrite" }
      }
    }

    // Create data directory
    yield* fs.makeDirectory("./data", { recursive: true }).pipe(
      Effect.catchAll(() => Effect.void)
    )

    // Write template
    const template = `---
meta:
  version: "1.0"
  lastUpdated: "2024-01-01"
  target: "Staff Product Engineering"

contact:
  name: "Your Name"
  email: "email@example.com"
---
`
    yield* fs.writeFileString("./data/resume.md", template)

    return { success: true, action: "created", path: "./data/resume.md" }
  })

describe("init command", () => {
  it.effect("creates resume when none exists", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()

      const result = yield* runInit({ confirmOverwrite: false })

      expect(result.success).toBe(true)
      expect(result.action).toBe("created")

      const ops = yield* fsTracker.getOps()
      expect(ops.some((op) => op.op === "writeFileString" && op.path === "./data/resume.md")).toBe(true)
    }).pipe(Effect.provide(createMockFileSystem(new Set())))
  )

  it.effect("creates data directory", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()

      yield* runInit({ confirmOverwrite: false })

      const ops = yield* fsTracker.getOps()
      expect(ops.some((op) => op.op === "makeDirectory" && op.path === "./data")).toBe(true)
    }).pipe(Effect.provide(createMockFileSystem(new Set())))
  )

  it.effect("writes template content", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()

      yield* runInit({ confirmOverwrite: false })

      const files = yield* fsTracker.getFiles()
      const content = files.get("./data/resume.md")

      expect(content).toBeDefined()
      expect(content).toContain("meta:")
      expect(content).toContain("contact:")
      expect(content).toContain("name:")
      expect(content).toContain("email:")
    }).pipe(Effect.provide(createMockFileSystem(new Set())))
  )

  it.effect("aborts when file exists and user declines", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()

      const result = yield* runInit({ confirmOverwrite: false })

      expect(result.success).toBe(false)
      expect(result.action).toBe("aborted")

      const ops = yield* fsTracker.getOps()
      // Should not write any files
      expect(ops.filter((op) => op.op === "writeFileString").length).toBe(0)
    }).pipe(Effect.provide(createMockFileSystem(new Set(["./data/resume.md"]))))
  )

  it.effect("overwrites when file exists and user confirms", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()

      const result = yield* runInit({ confirmOverwrite: true })

      expect(result.success).toBe(true)
      expect(result.action).toBe("created")

      const ops = yield* fsTracker.getOps()
      expect(ops.some((op) => op.op === "writeFileString" && op.path === "./data/resume.md")).toBe(true)
    }).pipe(Effect.provide(createMockFileSystem(new Set(["./data/resume.md"]))))
  )

  it.effect("returns created file path", () =>
    Effect.gen(function* () {
      yield* fsTracker.reset()

      const result = yield* runInit({ confirmOverwrite: false })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.path).toBe("./data/resume.md")
      }
    }).pipe(Effect.provide(createMockFileSystem(new Set())))
  )
})
