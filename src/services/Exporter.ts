import { Context, Effect, Layer, Option, Schema } from "effect"
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

// Implementation functions - called directly within the service
const toJsonImpl = (resume: Resume): string =>
  JSON.stringify(Schema.encodeSync(Resume)(resume), null, 2)

// Helper to format skill line
const formatSkillLine = (label: string, skills: Option.Option<readonly string[]>): Option.Option<string> =>
  Option.map(skills, (s) => `${label}: ${s.join(", ")}`)

const toTextImpl = (resume: Resume): string => {
  const lines: string[] = []

  // Header
  lines.push(resume.contact.name.toUpperCase())
  lines.push("")

  // Contact info - collect all present optional fields
  const contactParts = [
    resume.contact.email,
    ...Option.getOrElse(Option.map(resume.contact.phone, (v) => [v]), () => []),
    ...Option.getOrElse(Option.map(resume.contact.location, (v) => [v]), () => []),
    ...Option.getOrElse(Option.map(resume.contact.website, (v) => [v]), () => []),
    ...Option.getOrElse(Option.map(resume.contact.linkedin, (v) => [v]), () => []),
    ...Option.getOrElse(Option.map(resume.contact.github, (v) => [v]), () => []),
  ]
  lines.push(contactParts.join(" | "))
  lines.push("")

  // Summary
  Option.match(resume.summary, {
    onNone: () => {},
    onSome: (summary) => {
      lines.push("SUMMARY")
      lines.push("-".repeat(40))
      lines.push(summary.default)
      lines.push("")
    },
  })

  // Skills - collect all present skill categories
  const skillLines = [
    formatSkillLine("Frontend", resume.skills.frontend),
    formatSkillLine("Backend", resume.skills.backend),
    formatSkillLine("Infrastructure", resume.skills.infrastructure),
    formatSkillLine("Languages", resume.skills.languages),
    formatSkillLine("Leadership", resume.skills.leadership),
    formatSkillLine("Tools", resume.skills.tools),
  ].filter(Option.isSome).map((o) => o.value)

  if (skillLines.length > 0) {
    lines.push("SKILLS")
    lines.push("-".repeat(40))
    lines.push(...skillLines)
    lines.push("")
  }

  // Experience
  lines.push("EXPERIENCE")
  lines.push("-".repeat(40))
  for (const exp of resume.experience) {
    lines.push(`${exp.title} | ${exp.company}`)
    const location = Option.getOrElse(Option.map(exp.location, (l) => ` | ${l}`), () => "")
    lines.push(`${exp.startDate} - ${exp.endDate}${location}`)
    for (const highlight of exp.highlights) {
      lines.push(`  - ${highlight.text}`)
    }
    lines.push("")
  }

  // Education
  Option.match(resume.education, {
    onNone: () => {},
    onSome: (education) => {
      if (education.length > 0) {
        lines.push("EDUCATION")
        lines.push("-".repeat(40))
        for (const edu of education) {
          lines.push(`${edu.degree} - ${edu.institution}`)
          Option.map(edu.graduationDate, (d) => lines.push(d))
          Option.map(edu.honors, (h) => lines.push(h))
          lines.push("")
        }
      }
    },
  })

  // Projects
  Option.match(resume.projects, {
    onNone: () => {},
    onSome: (projects) => {
      if (projects.length > 0) {
        lines.push("PROJECTS")
        lines.push("-".repeat(40))
        for (const proj of projects) {
          lines.push(proj.name)
          lines.push(proj.description)
          Option.map(proj.url, (u) => lines.push(u))
          Option.match(proj.highlights, {
            onNone: () => {},
            onSome: (highlights) => {
              for (const h of highlights) {
                lines.push(`  - ${h}`)
              }
            },
          })
          lines.push("")
        }
      }
    },
  })

  return lines.join("\n")
}

export class Exporter extends Context.Tag("@app/Exporter")<
  Exporter,
  ExporterService
>() {
  static readonly layer = Layer.succeed(Exporter, Exporter.of({
    toJson: (resume) => Effect.sync(() => toJsonImpl(resume)),

    toText: (resume) => Effect.sync(() => toTextImpl(resume)),

    export: (resume, options) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem

        let content: string | Uint8Array

        switch (options.format) {
          case "json":
            content = toJsonImpl(resume)
            break
          case "txt":
            content = toTextImpl(resume)
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
