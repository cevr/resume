import { Context, Effect, Layer, Schema } from "effect"
import { FileSystem } from "@effect/platform"
import { Resume } from "../schema/Resume.ts"
import { ExportError } from "./errors.ts"

export type ExportFormat = "pdf" | "docx" | "txt" | "json"

export interface ExportOptions {
  readonly format: ExportFormat
  readonly outputPath: string
  readonly template?: string
}

export interface ExporterService {
  readonly toJson: (resume: Resume) => Effect.Effect<string, never>
  readonly toText: (resume: Resume) => Effect.Effect<string, never>
  readonly export: (resume: Resume, options: ExportOptions) => Effect.Effect<void, ExportError, FileSystem.FileSystem>
}

export class Exporter extends Context.Tag("@app/Exporter")<
  Exporter,
  ExporterService
>() {
  static readonly layer = Layer.succeed(Exporter, Exporter.of({
    toJson: (resume) =>
      Effect.sync(() => JSON.stringify(Schema.encodeSync(Resume)(resume), null, 2)),

    toText: (resume) =>
      Effect.sync(() => {
        const lines: string[] = []

        // Header
        lines.push(resume.contact.name.toUpperCase())
        lines.push("")

        // Contact info
        const contactParts: string[] = [resume.contact.email]
        if (resume.contact.phone._tag === "Some") contactParts.push(resume.contact.phone.value)
        if (resume.contact.location._tag === "Some") contactParts.push(resume.contact.location.value)
        if (resume.contact.website._tag === "Some") contactParts.push(resume.contact.website.value)
        if (resume.contact.linkedin._tag === "Some") contactParts.push(resume.contact.linkedin.value)
        if (resume.contact.github._tag === "Some") contactParts.push(resume.contact.github.value)
        lines.push(contactParts.join(" | "))
        lines.push("")

        // Summary
        if (resume.summary._tag === "Some") {
          lines.push("SUMMARY")
          lines.push("-".repeat(40))
          lines.push(resume.summary.value.default)
          lines.push("")
        }

        // Skills
        lines.push("SKILLS")
        lines.push("-".repeat(40))
        if (resume.skills.frontend._tag === "Some") {
          lines.push(`Frontend: ${resume.skills.frontend.value.join(", ")}`)
        }
        if (resume.skills.backend._tag === "Some") {
          lines.push(`Backend: ${resume.skills.backend.value.join(", ")}`)
        }
        if (resume.skills.infrastructure._tag === "Some") {
          lines.push(`Infrastructure: ${resume.skills.infrastructure.value.join(", ")}`)
        }
        if (resume.skills.languages._tag === "Some") {
          lines.push(`Languages: ${resume.skills.languages.value.join(", ")}`)
        }
        if (resume.skills.leadership._tag === "Some") {
          lines.push(`Leadership: ${resume.skills.leadership.value.join(", ")}`)
        }
        if (resume.skills.tools._tag === "Some") {
          lines.push(`Tools: ${resume.skills.tools.value.join(", ")}`)
        }
        lines.push("")

        // Experience
        lines.push("EXPERIENCE")
        lines.push("-".repeat(40))
        for (const exp of resume.experience) {
          lines.push(`${exp.title} | ${exp.company}`)
          const location = exp.location._tag === "Some" ? ` | ${exp.location.value}` : ""
          lines.push(`${exp.startDate} - ${exp.endDate}${location}`)
          for (const highlight of exp.highlights) {
            lines.push(`  - ${highlight.text}`)
          }
          lines.push("")
        }

        // Education
        if (resume.education._tag === "Some" && resume.education.value.length > 0) {
          lines.push("EDUCATION")
          lines.push("-".repeat(40))
          for (const edu of resume.education.value) {
            lines.push(`${edu.degree} - ${edu.institution}`)
            if (edu.graduationDate._tag === "Some") {
              lines.push(edu.graduationDate.value)
            }
            if (edu.honors._tag === "Some") {
              lines.push(edu.honors.value)
            }
            lines.push("")
          }
        }

        // Projects
        if (resume.projects._tag === "Some" && resume.projects.value.length > 0) {
          lines.push("PROJECTS")
          lines.push("-".repeat(40))
          for (const proj of resume.projects.value) {
            lines.push(proj.name)
            lines.push(proj.description)
            if (proj.url._tag === "Some") {
              lines.push(proj.url.value)
            }
            if (proj.highlights._tag === "Some") {
              for (const h of proj.highlights.value) {
                lines.push(`  - ${h}`)
              }
            }
            lines.push("")
          }
        }

        return lines.join("\n")
      }),

    export: (resume, options) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const exporter = yield* Exporter

        let content: string | Uint8Array

        switch (options.format) {
          case "json":
            content = yield* exporter.toJson(resume)
            break
          case "txt":
            content = yield* exporter.toText(resume)
            break
          case "pdf":
          case "docx":
            // These will be implemented via PdfRenderer and DocxRenderer
            return yield* Effect.fail(new ExportError({
              format: options.format,
              cause: `${options.format} export not yet implemented`,
            }))
          default:
            return yield* Effect.fail(new ExportError({
              format: options.format,
              cause: `Unknown format: ${options.format}`,
            }))
        }

        yield* fs.writeFileString(options.outputPath, content).pipe(
          Effect.mapError((cause) => new ExportError({ format: options.format, cause }))
        )
      }),
  }))

  static readonly test = () =>
    Layer.succeed(Exporter, Exporter.of({
      toJson: (resume) => Effect.succeed(JSON.stringify(resume)),
      toText: (resume) => Effect.succeed(resume.contact.name),
      export: () => Effect.void,
    }))
}
