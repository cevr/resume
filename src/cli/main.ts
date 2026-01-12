import { Command } from "@effect/cli"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect, Layer } from "effect"
import {
  exportCommand,
  analyzeCommand,
  previewCommand,
  validateCommand,
  tailorCommand,
  initCommand,
  statsCommand,
  jobsCommand,
  variantsCommand,
  searchCommand,
} from "./commands/index.ts"
import { AppLive } from "../layers/App.ts"

// Root command
const resume = Command.make("resume", {}, () =>
  Console.log(`Resume CLI - ATS-optimized resume management

Commands:
  stats     Show resume statistics and health metrics
  search    Search for a term in the resume
  jobs      Manage tracked job descriptions
  variants  Manage resume variants
  export    Export resume to PDF, DOCX, TXT, or JSON
  analyze   Analyze resume against a job description
  tailor    Generate a job-tailored resume variant
  preview   Preview resume in terminal or browser
  validate  Validate resume structure
  init      Initialize a new resume from template

Use "resume <command> --help" for more information.`)
)

// Compose with subcommands
const command = resume.pipe(
  Command.withSubcommands([
    statsCommand,
    searchCommand,
    jobsCommand,
    variantsCommand,
    exportCommand,
    analyzeCommand,
    tailorCommand,
    previewCommand,
    validateCommand,
    initCommand,
  ])
)

// Run CLI
const cli = Command.run(command, {
  name: "resume",
  version: "1.0.0",
})

Effect.suspend(() => cli(process.argv)).pipe(
  Effect.provide(AppLive),
  BunRuntime.runMain
)
