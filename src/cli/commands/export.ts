import { Command, Options, Args } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { Config, ResumeRepo, Exporter, PdfRenderer, DocxRenderer } from "../../services/index.ts"
import type { ExportFormat } from "../../services/Exporter.ts"

const format = Options.choice("format", ["pdf", "docx", "txt", "json"]).pipe(
  Options.withAlias("f"),
  Options.optional,
  Options.withDescription("Output format (required unless --all)")
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

const all = Options.boolean("all").pipe(
  Options.withAlias("a"),
  Options.withDefault(false),
  Options.withDescription("Export all formats (PDF, DOCX, TXT, JSON)")
)

const resumePath = Args.file({ name: "resume" }).pipe(
  Args.optional,
  Args.withDescription("Path to resume markdown file")
)

export const exportCommand = Command.make(
  "export",
  { format, output, template, all, resumePath },
  ({ format, output, template, all, resumePath }) =>
    Effect.gen(function* () {
      const config = yield* Config
      const repo = yield* ResumeRepo
      const exporter = yield* Exporter
      const pdfRenderer = yield* PdfRenderer
      const docxRenderer = yield* DocxRenderer

      const path = Option.getOrElse(resumePath, () => config.defaultResumePath)
      const resume = yield* repo.load(path)

      if (all) {
        // Export all formats
        const formats: ExportFormat[] = ["pdf", "docx", "txt", "json"]
        yield* Console.log("Exporting all formats...")

        for (const fmt of formats) {
          const outputPath = `${config.outputDirectory}/resume.${fmt}`
          yield* Console.log(`  → ${outputPath}`)

          switch (fmt) {
            case "pdf": {
              const templateName = Option.getOrUndefined(template)
              yield* pdfRenderer.renderToFile(resume, outputPath, templateName)
              break
            }
            case "docx": {
              yield* docxRenderer.renderToFile(resume, outputPath)
              break
            }
            case "txt":
            case "json": {
              yield* exporter.export(resume, { format: fmt, outputPath })
              break
            }
          }
        }

        yield* Console.log("\n✓ All formats exported successfully")
        return
      }

      // Single format export
      if (Option.isNone(format)) {
        yield* Console.log("Error: --format is required (or use --all)")
        return
      }

      const fmt = format.value as ExportFormat
      const outputPath = Option.getOrElse(output, () => {
        return `${config.outputDirectory}/resume.${fmt}`
      })

      yield* Console.log(`Exporting resume to ${outputPath}...`)

      switch (fmt) {
        case "pdf": {
          const templateName = Option.getOrUndefined(template)
          yield* pdfRenderer.renderToFile(resume, outputPath, templateName)
          break
        }
        case "docx": {
          yield* docxRenderer.renderToFile(resume, outputPath)
          break
        }
        case "txt":
        case "json": {
          yield* exporter.export(resume, { format: fmt, outputPath })
          break
        }
      }

      yield* Console.log(`Successfully exported to ${outputPath}`)
    })
).pipe(Command.withDescription("Export resume to PDF, DOCX, TXT, or JSON"))
