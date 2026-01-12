import { Command, Options, Args } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { FileSystem } from "@effect/platform"
import { Config, ResumeRepo, JobAnalyzer } from "../../services/index.ts"

// Schema for saved job
interface SavedJob {
  name: string
  source: string
  addedAt: string
  content: string
  keywords: readonly string[]
  matchScore: number
}

const nameOption = Options.text("name").pipe(
  Options.withAlias("n"),
  Options.withDescription("Name for the job (e.g., company-role)")
)

const sourceArg = Args.text({ name: "source" }).pipe(
  Args.withDescription("URL or file path to job description")
)

// jobs add <source> --name <name>
const addCommand = Command.make(
  "add",
  { name: nameOption, source: sourceArg },
  ({ name, source }) =>
    Effect.gen(function* () {
      const config = yield* Config
      const fs = yield* FileSystem.FileSystem
      const analyzer = yield* JobAnalyzer
      const repo = yield* ResumeRepo

      // Determine if source is URL or file
      const isUrl = source.startsWith("http://") || source.startsWith("https://")

      let content: string
      if (isUrl) {
        yield* Console.log(`Fetching job description from ${source}...`)
        const jobDesc = yield* analyzer.fetchJobDescription(source)
        content = jobDesc.rawText
      } else {
        yield* Console.log(`Reading job description from ${source}...`)
        const bytes = yield* fs.readFile(source)
        content = new TextDecoder().decode(bytes)
      }

      // Parse and analyze
      const jobDesc = yield* analyzer.parseJobDescription(content)
      const resume = yield* repo.load(config.defaultResumePath)
      const analysis = yield* analyzer.analyzeMatch(resume, jobDesc)

      // Create jobs directory if needed
      const jobsDir = config.defaultResumePath.replace("/resume.md", "/jobs")
      const exists = yield* fs.exists(jobsDir)
      if (!exists) {
        yield* fs.makeDirectory(jobsDir, { recursive: true })
      }

      // Save job
      const savedJob: SavedJob = {
        name,
        source,
        addedAt: new Date().toISOString().split("T")[0] ?? "",
        content,
        keywords: jobDesc.keywords,
        matchScore: analysis.matchScore,
      }

      const jobPath = `${jobsDir}/${name}.json`
      yield* fs.writeFileString(jobPath, JSON.stringify(savedJob, null, 2))

      yield* Console.log(`\n✓ Job saved as "${name}"`)
      yield* Console.log(`  Match score: ${analysis.matchScore}%`)
      yield* Console.log(`  Keywords: ${jobDesc.keywords.slice(0, 5).join(", ")}...`)
      yield* Console.log(`\nUse: resume analyze --job ${name}`)
    })
).pipe(Command.withDescription("Add a job description to track"))

// jobs list
const listCommand = Command.make("list", {}, () =>
  Effect.gen(function* () {
    const config = yield* Config
    const fs = yield* FileSystem.FileSystem

    const jobsDir = config.defaultResumePath.replace("/resume.md", "/jobs")
    const exists = yield* fs.exists(jobsDir)

    if (!exists) {
      yield* Console.log("No jobs tracked yet.")
      yield* Console.log("\nUse: resume jobs add <url|file> --name <name>")
      return
    }

    const entries = yield* fs.readDirectory(jobsDir)
    const jobFiles = entries.filter((e) => e.endsWith(".json"))

    if (jobFiles.length === 0) {
      yield* Console.log("No jobs tracked yet.")
      yield* Console.log("\nUse: resume jobs add <url|file> --name <name>")
      return
    }

    yield* Console.log("Saved Jobs:")
    yield* Console.log("-".repeat(50))

    for (const file of jobFiles) {
      const content = yield* fs.readFileString(`${jobsDir}/${file}`)
      const job = JSON.parse(content) as SavedJob
      const padding = " ".repeat(Math.max(0, 20 - job.name.length))
      yield* Console.log(
        `  ${job.name}${padding}${job.matchScore}% match  Added ${job.addedAt}`
      )
    }

    yield* Console.log("\nUse: resume analyze --job <name>")
  })
).pipe(Command.withDescription("List tracked jobs"))

// jobs remove <name>
const removeNameArg = Args.text({ name: "name" }).pipe(
  Args.withDescription("Name of job to remove")
)

const removeCommand = Command.make("remove", { name: removeNameArg }, ({ name }) =>
  Effect.gen(function* () {
    const config = yield* Config
    const fs = yield* FileSystem.FileSystem

    const jobPath = `${config.defaultResumePath.replace("/resume.md", "/jobs")}/${name}.json`
    const exists = yield* fs.exists(jobPath)

    if (!exists) {
      yield* Console.log(`Job "${name}" not found.`)
      return
    }

    yield* fs.remove(jobPath)
    yield* Console.log(`✓ Removed job "${name}"`)
  })
).pipe(Command.withDescription("Remove a tracked job"))

// Parent command
export const jobsCommand = Command.make("jobs", {}, () =>
  Console.log(`Job tracking commands

Usage:
  resume jobs add <url|file> --name <name>  Add a job to track
  resume jobs list                          List all tracked jobs
  resume jobs remove <name>                 Remove a tracked job

Examples:
  resume jobs add https://example.com/job --name acme-swe
  resume jobs add ./job-posting.txt --name startup-lead
  resume jobs list
  resume jobs remove acme-swe`)
).pipe(
  Command.withSubcommands([addCommand, listCommand, removeCommand]),
  Command.withDescription("Manage tracked job descriptions")
)
