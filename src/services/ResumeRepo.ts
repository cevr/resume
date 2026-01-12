import { Context, Effect, Layer, Option, Schema } from "effect"
import { FileSystem } from "@effect/platform"
import matter from "gray-matter"
import { Resume, Highlight, Experience, Contact, Skills, Summary, Meta, Education, Certification, Project } from "../schema/Resume.ts"
import { ResumeLoadError, ResumeSaveError, ValidationError } from "./errors.ts"

export interface ResumeRepoService {
  readonly load: (path: string) => Effect.Effect<Resume, ResumeLoadError | ValidationError, FileSystem.FileSystem>
  readonly save: (path: string, resume: Resume) => Effect.Effect<void, ResumeSaveError, FileSystem.FileSystem>
  readonly loadRaw: (path: string) => Effect.Effect<{ frontmatter: unknown; content: string }, ResumeLoadError, FileSystem.FileSystem>
}

export class ResumeRepo extends Context.Tag("@app/ResumeRepo")<
  ResumeRepo,
  ResumeRepoService
>() {
  static readonly layer = Layer.succeed(ResumeRepo, ResumeRepo.of({
    load: (path) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const content = yield* fs.readFileString(path).pipe(
          Effect.mapError((cause) => new ResumeLoadError({ path, cause }))
        )

        const parsed = matter(content)
        const data = parsed.data as Record<string, unknown>

        // Transform the parsed data to match our schema
        const transformed = transformParsedData(data)

        const resume = yield* Schema.decodeUnknown(Resume)(transformed).pipe(
          Effect.mapError((cause) => new ValidationError({ errors: [String(cause)] }))
        )

        return resume
      }),

    save: (path, resume) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem

        // Convert resume to plain object for YAML
        const data = Schema.encodeSync(Resume)(resume)

        // Create frontmatter content
        const content = matter.stringify("", data)

        yield* fs.writeFileString(path, content).pipe(
          Effect.mapError((cause) => new ResumeSaveError({ path, cause }))
        )
      }),

    loadRaw: (path) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const content = yield* fs.readFileString(path).pipe(
          Effect.mapError((cause) => new ResumeLoadError({ path, cause }))
        )

        const parsed = matter(content)
        return {
          frontmatter: parsed.data,
          content: parsed.content,
        }
      }),
  }))

  static readonly test = (mockData: { resume?: Resume } = {}) =>
    Layer.sync(ResumeRepo, () => {
      const stored = new Map<string, Resume>()
      if (mockData.resume) {
        stored.set("default", mockData.resume)
        stored.set("./data/resume.md", mockData.resume)
      }

      return ResumeRepo.of({
        load: (path) =>
          Effect.fromNullable(stored.get(path)).pipe(
            Effect.mapError(() => new ResumeLoadError({ path, cause: "not found" }))
          ) as Effect.Effect<Resume, ResumeLoadError | ValidationError, FileSystem.FileSystem>,

        save: (path, resume) =>
          Effect.sync(() => {
            stored.set(path, resume)
          }) as Effect.Effect<void, ResumeSaveError, FileSystem.FileSystem>,

        loadRaw: (path) =>
          Effect.fail(new ResumeLoadError({ path, cause: "not implemented in test" })) as Effect.Effect<{ frontmatter: unknown; content: string }, ResumeLoadError, FileSystem.FileSystem>,
      })
    })
}

// Helper function to transform parsed YAML to match our schema
function transformParsedData(data: Record<string, unknown>): unknown {
  const transform = (obj: unknown): unknown => {
    if (obj === null || obj === undefined) return undefined
    if (Array.isArray(obj)) return obj.map(transform)
    if (typeof obj !== "object") return obj

    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== null && value !== undefined) {
        result[key] = transform(value)
      }
    }
    return result
  }

  return transform(data)
}
