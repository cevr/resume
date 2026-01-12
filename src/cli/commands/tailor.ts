import { Command, Options, Prompt } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { FileSystem } from "@effect/platform"
import { Config, ResumeRepo, JobAnalyzer } from "../../services/index.ts"

const jobUrl = Options.text("job-url").pipe(
  Options.optional,
  Options.withDescription("URL to fetch job description from")
)

const jobFile = Options.file("job-file").pipe(
  Options.optional,
  Options.withDescription("Path to job description file")
)

const name = Options.text("name").pipe(
  Options.withAlias("n"),
  Options.optional,
  Options.withDescription("Name for the tailored variant")
)

const output = Options.text("output").pipe(
  Options.withAlias("o"),
  Options.optional,
  Options.withDescription("Output path for tailored resume")
)

export const tailorCommand = Command.make(
  "tailor",
  { jobUrl, jobFile, name, output },
  ({ jobUrl, jobFile, name: variantName, output: outputPath }) =>
    Effect.gen(function* () {
      const config = yield* Config
      const repo = yield* ResumeRepo
      const analyzer = yield* JobAnalyzer
      const fs = yield* FileSystem.FileSystem

      // Load master resume
      const resume = yield* repo.load(config.defaultResumePath)

      // Get job description
      let jobDescription
      if (Option.isSome(jobUrl)) {
        yield* Console.log(`Fetching job description from ${jobUrl.value}...`)
        jobDescription = yield* analyzer.fetchJobDescription(jobUrl.value)
      } else if (Option.isSome(jobFile)) {
        const content = yield* Effect.tryPromise({
          try: () => Bun.file(jobFile.value).text(),
          catch: (e) => new Error(`Failed to read file: ${e}`),
        })
        jobDescription = yield* analyzer.parseJobDescription(content)
      } else {
        const text = yield* Prompt.text({
          message: "Paste the job description (press Enter twice when done):",
        }).pipe(Effect.orDie)

        jobDescription = yield* analyzer.parseJobDescription(text)
      }

      yield* Console.log("\nAnalyzing job requirements...")

      // Analyze match to find missing keywords
      const analysis = yield* analyzer.analyzeMatch(resume, jobDescription)

      yield* Console.log(`Current match score: ${analysis.matchScore}%`)
      yield* Console.log(`Missing keywords: ${analysis.missingKeywords.length}`)

      // Create copy of resume for tailoring
      const tailored = resume

      // Determine output path
      const variant = Option.getOrElse(variantName, () =>
        `tailored-${Date.now()}`
      )
      const finalPath = Option.getOrElse(outputPath, () =>
        `./data/variants/${variant}.md`
      )

      // Ensure variants directory exists
      yield* fs.makeDirectory("./data/variants", { recursive: true }).pipe(
        Effect.catchAll(() => Effect.void)
      )

      // Save tailored resume
      yield* repo.save(finalPath, tailored as typeof resume)

      yield* Console.log(`\nTailored resume saved to: ${finalPath}`)

      // Show improvement suggestions
      yield* Console.log("\nRecommendations for this role:")
      yield* Console.log("  • Missing keywords to incorporate:")
      for (const keyword of analysis.missingKeywords.slice(0, 10)) {
        yield* Console.log(`    - ${keyword}`)
      }

      yield* Console.log("\n  • Consider reordering highlights to emphasize relevant experience")
      yield* Console.log("  • Update summary to target this specific role")
      yield* Console.log(`\nEdit variant: data/variants/${variant}.md`)
      yield* Console.log("Export with: resume export -f pdf")
    })
).pipe(Command.withDescription("Generate a job-tailored resume variant"))
