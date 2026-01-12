import { Command, Args, Prompt } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { Config, ResumeRepo, AIAssistant } from "../../services/index.ts"

// Subcommand: quantify
const quantifyCommand = Command.make(
  "quantify",
  {},
  () =>
    Effect.gen(function* () {
      const config = yield* Config
      const repo = yield* ResumeRepo
      const ai = yield* AIAssistant

      if (config.anthropicApiKey._tag === "None") {
        yield* Console.log("Error: ANTHROPIC_API_KEY not set. AI features require an API key.")
        return
      }

      const resume = yield* repo.load(config.defaultResumePath)

      yield* Console.log("Analyzing achievements for quantification opportunities...\n")

      // Find highlights without numbers
      const unquantified: { exp: string; highlight: string; index: number }[] = []

      for (const exp of resume.experience) {
        for (let i = 0; i < exp.highlights.length; i++) {
          const h = exp.highlights[i]!
          if (!/\d/.test(h.text)) {
            unquantified.push({
              exp: `${exp.title} at ${exp.company}`,
              highlight: h.text,
              index: i,
            })
          }
        }
      }

      if (unquantified.length === 0) {
        yield* Console.log("All achievements already have metrics. Great job!")
        return
      }

      yield* Console.log(`Found ${unquantified.length} achievements that could use metrics:\n`)

      // Process up to 5 highlights
      for (const item of unquantified.slice(0, 5)) {
        yield* Console.log(`From: ${item.exp}`)
        yield* Console.log(`Original: "${item.highlight}"`)

        const suggestions = yield* ai.quantifyAchievement(item.highlight, item.exp)

        yield* Console.log("Suggestions:")
        for (const suggestion of suggestions) {
          yield* Console.log(`  → ${suggestion}`)
        }
        yield* Console.log("")
      }

      if (unquantified.length > 5) {
        yield* Console.log(`... and ${unquantified.length - 5} more. Run again to see more.`)
      }
    })
).pipe(Command.withDescription("Suggest metrics for unquantified achievements"))

// Subcommand: verbs
const verbsCommand = Command.make(
  "verbs",
  {},
  () =>
    Effect.gen(function* () {
      const config = yield* Config
      const repo = yield* ResumeRepo
      const ai = yield* AIAssistant

      if (config.anthropicApiKey._tag === "None") {
        yield* Console.log("Error: ANTHROPIC_API_KEY not set. AI features require an API key.")
        return
      }

      const resume = yield* repo.load(config.defaultResumePath)

      yield* Console.log("Analyzing action verbs in your achievements...\n")

      // Collect all highlights
      const highlights = resume.experience.flatMap((exp) =>
        exp.highlights.map((h) => h.text)
      )

      const suggestions = yield* ai.improveVerbs(highlights.slice(0, 10))

      if (suggestions.length === 0) {
        yield* Console.log("Your action verbs look strong! No improvements suggested.")
        return
      }

      yield* Console.log("Suggested verb improvements:\n")
      for (const suggestion of suggestions) {
        yield* Console.log(`Original: "${suggestion.original}"`)
        yield* Console.log(`Improved: "${suggestion.improved}"`)
        if (suggestion.context._tag === "Some") {
          yield* Console.log(`Why: ${suggestion.context.value}`)
        }
        yield* Console.log("")
      }
    })
).pipe(Command.withDescription("Improve action verbs in achievements"))

// Subcommand: keywords
const keywordsCommand = Command.make(
  "keywords",
  {},
  () =>
    Effect.gen(function* () {
      const config = yield* Config
      const repo = yield* ResumeRepo
      const ai = yield* AIAssistant

      const resume = yield* repo.load(config.defaultResumePath)

      // Common important keywords for tech roles
      const targetKeywords = [
        "leadership", "architecture", "scalable", "performance",
        "mentorship", "agile", "cross-functional", "stakeholder",
        "strategy", "optimization", "microservices", "distributed",
      ]

      yield* Console.log("Analyzing keyword density for important terms...\n")

      const report = yield* ai.analyzeKeywordDensity(resume, targetKeywords)

      yield* Console.log("Keyword Density Report:\n")
      for (const item of report) {
        const icon = item.status === "good" ? "✓" : item.status === "low" ? "✗" : "~"
        yield* Console.log(`  ${icon} ${item.keyword}: ${item.count} occurrences (recommended: ${item.recommended}+)`)
      }

      const lowKeywords = report.filter((r) => r.status === "low")
      if (lowKeywords.length > 0) {
        yield* Console.log("\nConsider adding more mentions of:")
        for (const k of lowKeywords) {
          yield* Console.log(`  → ${k.keyword}`)
        }
      }
    })
).pipe(Command.withDescription("Analyze keyword density for important terms"))

// Parent improve command
export const improveCommand = Command.make("improve", {}, () =>
  Console.log("Use a subcommand: quantify, verbs, or keywords")
).pipe(
  Command.withSubcommands([quantifyCommand, verbsCommand, keywordsCommand]),
  Command.withDescription("AI-powered resume improvement suggestions")
)
