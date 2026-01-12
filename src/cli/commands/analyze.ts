import { Command, Options, Prompt } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { Config, ResumeRepo, JobAnalyzer, AIAssistant } from "../../services/index.ts"

const jobUrl = Options.text("job-url").pipe(
  Options.optional,
  Options.withDescription("URL to fetch job description from")
)

const jobFile = Options.file("job-file").pipe(
  Options.optional,
  Options.withDescription("Path to job description file")
)

export const analyzeCommand = Command.make(
  "analyze",
  { jobUrl, jobFile },
  ({ jobUrl, jobFile }) =>
    Effect.gen(function* () {
      const config = yield* Config
      const repo = yield* ResumeRepo
      const analyzer = yield* JobAnalyzer
      const ai = yield* AIAssistant

      // Load resume
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
        // Interactive prompt
        const text = yield* Prompt.text({
          message: "Paste the job description (press Enter twice when done):",
        }).pipe(Effect.orDie)

        jobDescription = yield* analyzer.parseJobDescription(text)
      }

      // Analyze match
      yield* Console.log("\nAnalyzing resume against job description...")
      const analysis = yield* analyzer.analyzeMatch(resume, jobDescription)

      // Display results
      yield* Console.log("\n" + "=".repeat(60))
      yield* Console.log(`MATCH SCORE: ${analysis.matchScore}%`)
      yield* Console.log("=".repeat(60))

      yield* Console.log(`\nMatched Keywords (${analysis.matchedKeywords.length}):`)
      for (const keyword of analysis.matchedKeywords) {
        yield* Console.log(`  ✓ ${keyword}`)
      }

      yield* Console.log(`\nMissing Keywords (${analysis.missingKeywords.length}):`)
      for (const keyword of analysis.missingKeywords) {
        yield* Console.log(`  ✗ ${keyword}`)
      }

      // Section validation
      yield* Console.log("\nSection Validation:")
      yield* Console.log(`  ${analysis.sectionValidation.hasContact ? "✓" : "✗"} Contact Information`)
      yield* Console.log(`  ${analysis.sectionValidation.hasSummary ? "✓" : "✗"} Professional Summary`)
      yield* Console.log(`  ${analysis.sectionValidation.hasExperience ? "✓" : "✗"} Work Experience`)
      yield* Console.log(`  ${analysis.sectionValidation.hasSkills ? "✓" : "✗"} Skills Section`)
      yield* Console.log(`  ${analysis.sectionValidation.hasEducation ? "✓" : "✗"} Education`)

      // ATS Warnings
      if (analysis.atsWarnings.length > 0) {
        yield* Console.log("\nATS Warnings:")
        for (const warning of analysis.atsWarnings) {
          yield* Console.log(`  ⚠ ${warning}`)
        }
      }

      // AI-powered keyword suggestions
      if (config.anthropicApiKey._tag === "Some" && analysis.missingKeywords.length > 0) {
        yield* Console.log("\nAI Keyword Suggestions:")
        const suggestions = yield* ai.suggestKeywords(resume, jobDescription)
        for (const keyword of suggestions.slice(0, 5)) {
          yield* Console.log(`  → Consider adding: ${keyword}`)
        }
      }

      yield* Console.log("")
    })
).pipe(Command.withDescription("Analyze resume against a job description for ATS optimization"))
