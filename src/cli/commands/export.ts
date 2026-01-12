import { Command, Options, Args } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { Config, ResumeRepo, Exporter, PdfRenderer, DocxRenderer } from "../../services/index.ts"
import type { ExportFormat } from "../../services/Exporter.ts"

const format = Options.choice("format", ["pdf", "docx", "txt", "json"]).pipe(
  Options.withAlias("f"),
  Options.withDescription("Output format")
)

const output = Options.text("output").pipe(
  Options.withAlias("o"),
  Options.optional,
  Options.withDescription("Output file path")
)

const template = Options.text("template").pipe(
  Options.withAlias("t"),
  Options.optional,
  Options.withDescription("PDF template name (for PDF export)")
)

const resumePath = Args.file({ name: "resume" }).pipe(
  Args.optional,
  Args.withDescription("Path to resume markdown file")
)

export const exportCommand = Command.make(
  "export",
  { format, output, template, resumePath },
  ({ format, output, template, resumePath }) =>
    Effect.gen(function* () {
      const config = yield* Config
      const repo = yield* ResumeRepo
      const exporter = yield* Exporter

      const path = Option.getOrElse(resumePath, () => config.defaultResumePath)
      const resume = yield* repo.load(path)

      const outputPath = Option.getOrElse(output, () => {
        const ext = format as ExportFormat
        return `${config.outputDirectory}/resume.${ext}`
      })

      yield* Console.log(`Exporting resume to ${outputPath}...`)

      switch (format as ExportFormat) {
        case "pdf": {
          const renderer = yield* PdfRenderer
          const templateName = Option.getOrUndefined(template)
          yield* renderer.renderToFile(resume, outputPath, templateName)
          break
        }
        case "docx": {
          const renderer = yield* DocxRenderer
          yield* renderer.renderToFile(resume, outputPath)
          break
        }
        case "txt":
        case "json": {
          yield* exporter.export(resume, { format: format as ExportFormat, outputPath })
          break
        }
      }

      yield* Console.log(`Successfully exported to ${outputPath}`)
    })
).pipe(Command.withDescription("Export resume to PDF, DOCX, TXT, or JSON"))
