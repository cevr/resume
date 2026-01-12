import { Command, Options } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { Config, ResumeRepo, Preview } from "../../services/index.ts"

const browser = Options.boolean("browser").pipe(
  Options.withAlias("b"),
  Options.withDefault(false),
  Options.withDescription("Open preview in browser instead of terminal")
)

export const previewCommand = Command.make(
  "preview",
  { browser },
  ({ browser }) =>
    Effect.gen(function* () {
      const config = yield* Config
      const repo = yield* ResumeRepo
      const preview = yield* Preview

      const resume = yield* repo.load(config.defaultResumePath)

      if (browser) {
        yield* Console.log("Opening preview in browser...")
        yield* preview.browserPreview(resume)
      } else {
        const output = yield* preview.terminalPreview(resume)
        yield* Console.log(output)
      }
    })
).pipe(Command.withDescription("Preview resume in terminal or browser"))
