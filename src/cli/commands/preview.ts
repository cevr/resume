import { Command, Options } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { Config, ResumeRepo, Preview, PdfRenderer } from "../../services/index.ts"

const browser = Options.boolean("browser").pipe(
  Options.withAlias("b"),
  Options.withDefault(false),
  Options.withDescription("Open preview in browser (HTML)")
)

const pdf = Options.boolean("pdf").pipe(
  Options.withAlias("p"),
  Options.withDefault(false),
  Options.withDescription("Open preview as PDF")
)

export const previewCommand = Command.make(
  "preview",
  { browser, pdf },
  ({ browser, pdf }) =>
    Effect.gen(function* () {
      const config = yield* Config
      const repo = yield* ResumeRepo
      const preview = yield* Preview

      const resume = yield* repo.load(config.defaultResumePath)

      if (pdf) {
        const pdfRenderer = yield* PdfRenderer
        const tempPath = `/tmp/resume-preview-${Date.now()}.pdf`
        yield* Console.log("Generating PDF preview...")
        yield* pdfRenderer.renderToFile(resume, tempPath)
        const proc = Bun.spawn(["open", tempPath])
        yield* Effect.promise(() => proc.exited)
      } else if (browser) {
        yield* Console.log("Opening preview in browser...")
        yield* preview.browserPreview(resume)
      } else {
        const output = yield* preview.terminalPreview(resume)
        yield* Console.log(output)
      }
    })
).pipe(Command.withDescription("Preview resume in terminal, browser, or PDF"))
