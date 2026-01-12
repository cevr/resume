import { Context, Effect, Layer, Ref } from "effect"
import { FileSystem } from "@effect/platform"
import {
  Config,
  ResumeRepo,
  Exporter,
  PdfRenderer,
  DocxRenderer,
  JobAnalyzer,
  Preview,
} from "../../src/services/index.ts"
import { mockResume } from "./fixtures.ts"

/**
 * Test console that captures log output for assertions
 */
export interface TestConsoleService {
  readonly log: (message: string) => Effect.Effect<void>
  readonly logs: Effect.Effect<ReadonlyArray<string>>
  readonly clear: Effect.Effect<void>
}

export class TestConsole extends Context.Tag("TestConsole")<
  TestConsole,
  TestConsoleService
>() {
  static readonly layer = Layer.effect(
    TestConsole,
    Effect.gen(function* () {
      const ref = yield* Ref.make<Array<string>>([])
      return TestConsole.of({
        log: (msg) => Ref.update(ref, (logs) => [...logs, msg]),
        logs: Ref.get(ref),
        clear: Ref.set(ref, []),
      })
    })
  )
}

/**
 * In-memory filesystem for testing
 */
export interface TestFileSystemService {
  readonly files: Effect.Effect<ReadonlyMap<string, string>>
  readonly setFile: (path: string, content: string) => Effect.Effect<void>
  readonly deleteFile: (path: string) => Effect.Effect<void>
}

export class TestFileSystem extends Context.Tag("TestFileSystem")<
  TestFileSystem,
  TestFileSystemService
>() {
  static readonly layer = Layer.effect(
    TestFileSystem,
    Effect.gen(function* () {
      const ref = yield* Ref.make<Map<string, string>>(new Map())
      return TestFileSystem.of({
        files: Ref.get(ref),
        setFile: (path, content) =>
          Ref.update(ref, (files) => {
            const newFiles = new Map(files)
            newFiles.set(path, content)
            return newFiles
          }),
        deleteFile: (path) =>
          Ref.update(ref, (files) => {
            const newFiles = new Map(files)
            newFiles.delete(path)
            return newFiles
          }),
      })
    })
  )
}

/**
 * Creates the base test layer with all service mocks
 */
export const createTestLayer = (options: {
  resume?: typeof mockResume
  files?: Record<string, string>
} = {}) => {
  const resume = options.resume ?? mockResume

  return Layer.mergeAll(
    Config.test(),
    ResumeRepo.test({ resume }),
    Exporter.test(),
    PdfRenderer.test(),
    DocxRenderer.test(),
    JobAnalyzer.test(),
    Preview.test(),
    TestConsole.layer,
    TestFileSystem.layer
  )
}

/**
 * Default test layer with mock resume
 */
export const TestLayer = createTestLayer()
