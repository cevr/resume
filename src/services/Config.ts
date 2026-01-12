import { Config as EffectConfig, Context, Effect, Layer, Option } from "effect"

export interface AppConfig {
  readonly anthropicApiKey: Option.Option<string>
  readonly defaultResumePath: string
  readonly outputDirectory: string
  readonly defaultTemplate: string
}

export class Config extends Context.Tag("@app/Config")<Config, AppConfig>() {
  static readonly layer = Layer.effect(
    Config,
    Effect.gen(function* () {
      const anthropicApiKey = yield* EffectConfig.string("ANTHROPIC_API_KEY").pipe(
        EffectConfig.option
      )
      const defaultResumePath = yield* EffectConfig.string("RESUME_PATH").pipe(
        EffectConfig.withDefault("./data/resume.md")
      )
      const outputDirectory = yield* EffectConfig.string("OUTPUT_DIR").pipe(
        EffectConfig.withDefault("./output")
      )
      const defaultTemplate = yield* EffectConfig.string("DEFAULT_TEMPLATE").pipe(
        EffectConfig.withDefault("professional")
      )

      return Config.of({
        anthropicApiKey,
        defaultResumePath,
        outputDirectory,
        defaultTemplate,
      })
    })
  )

  static readonly test = (overrides: Partial<AppConfig> = {}) =>
    Layer.succeed(
      Config,
      Config.of({
        anthropicApiKey: Option.none(),
        defaultResumePath: "./data/resume.md",
        outputDirectory: "./output",
        defaultTemplate: "professional",
        ...overrides,
      })
    )
}
