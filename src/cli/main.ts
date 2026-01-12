import { Command } from "@effect/cli"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect, Layer } from "effect"
import {
  exportCommand,
  analyzeCommand,
  previewCommand,
  validateCommand,
  improveCommand,
  tailorCommand,
  initCommand,
} from "./commands/index.ts"
import { AppLive } from "../layers/App.ts"

// Root command
const resume = Command.make("resume", {}, () =>
  Console.log(`Resume CLI - ATS-optimized resume management

Commands:
  export    Export resume to PDF, DOCX, TXT, or JSON
  analyze   Analyze resume against a job description
  tailor    Generate a job-tailored resume variant
  improve   AI-powered resume improvement suggestions
  preview   Preview resume in terminal or browser
  validate  Validate resume structure
  init      Initialize a new resume from template

Use "resume <command> --help" for more information.`)
)

// Compose with subcommands
const command = resume.pipe(
  Command.withSubcommands([
    exportCommand,
    analyzeCommand,
    tailorCommand,
    improveCommand,
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
