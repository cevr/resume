import { Command, Args } from "@effect/cli"
import { Console, Effect } from "effect"
import { FileSystem } from "@effect/platform"
import { Config, ResumeRepo } from "../../services/index.ts"

// variants list
const listCommand = Command.make("list", {}, () =>
  Effect.gen(function* () {
    const config = yield* Config
    const fs = yield* FileSystem.FileSystem

    const variantsDir = config.defaultResumePath.replace("/resume.md", "/variants")
    const exists = yield* fs.exists(variantsDir)

    if (!exists) {
      yield* Console.log("No variants saved yet.")
      yield* Console.log("\nUse: resume tailor --job <name> --name <variant-name>")
      return
    }

    const entries = yield* fs.readDirectory(variantsDir)
    const variantFiles = entries.filter((e) => e.endsWith(".md"))

    if (variantFiles.length === 0) {
      yield* Console.log("No variants saved yet.")
      yield* Console.log("\nUse: resume tailor --job <name> --name <variant-name>")
      return
    }

    yield* Console.log("Saved Variants:")
    yield* Console.log("-".repeat(50))

    for (const file of variantFiles) {
      const name = file.replace(".md", "")
      const stat = yield* fs.stat(`${variantsDir}/${file}`)
      const modified = stat.mtime._tag === "Some"
        ? new Date(Number(stat.mtime.value)).toISOString().split("T")[0]
        : "unknown"

      yield* Console.log(`  ${name.padEnd(25)} ${modified}`)
    }

    yield* Console.log("\nUse: resume variants diff <name>")
  })
).pipe(Command.withDescription("List saved resume variants"))

// variants diff <name>
const diffNameArg = Args.text({ name: "name" }).pipe(
  Args.withDescription("Name of variant to compare")
)

const diffCommand = Command.make("diff", { name: diffNameArg }, ({ name }) =>
  Effect.gen(function* () {
    const config = yield* Config
    const repo = yield* ResumeRepo
    const fs = yield* FileSystem.FileSystem

    const variantPath = `${config.defaultResumePath.replace("/resume.md", "/variants")}/${name}.md`
    const exists = yield* fs.exists(variantPath)

    if (!exists) {
      yield* Console.log(`Variant "${name}" not found.`)
      yield* Console.log("\nUse: resume variants list")
      return
    }

    // Load both resumes
    const master = yield* repo.load(config.defaultResumePath)
    const variant = yield* repo.load(variantPath)

    yield* Console.log(`Comparing "${name}" to master resume\n`)
    yield* Console.log("=".repeat(50))

    // Compare summaries
    const masterSummary = master.summary._tag === "Some" ? master.summary.value.default : ""
    const variantSummary = variant.summary._tag === "Some" ? variant.summary.value.default : ""

    if (masterSummary !== variantSummary) {
      yield* Console.log("\nSummary:")
      yield* Console.log(`  Master:  ${masterSummary.slice(0, 60).replace(/\n/g, " ")}...`)
      yield* Console.log(`  Variant: ${variantSummary.slice(0, 60).replace(/\n/g, " ")}...`)
    } else {
      yield* Console.log("\nSummary: No changes")
    }

    // Compare highlight counts per job
    yield* Console.log("\nExperience highlights:")
    for (let i = 0; i < master.experience.length; i++) {
      const masterExp = master.experience[i]
      const variantExp = variant.experience[i]

      if (!variantExp || !masterExp) continue

      const masterCount = masterExp.highlights.length
      const variantCount = variantExp.highlights.length

      if (masterCount !== variantCount) {
        yield* Console.log(`  ${masterExp.company}: ${masterCount} → ${variantCount} highlights`)
      }
    }

    // Compare skills
    const masterSkillCount = countSkills(master.skills)
    const variantSkillCount = countSkills(variant.skills)

    if (masterSkillCount !== variantSkillCount) {
      yield* Console.log(`\nSkills: ${masterSkillCount} → ${variantSkillCount}`)
    }

    yield* Console.log("\n" + "=".repeat(50))
    yield* Console.log(`\nExport variant: resume export -f pdf ${variantPath}`)
  })
).pipe(Command.withDescription("Compare a variant to the master resume"))

function countSkills(skills: any): number {
  let count = 0
  for (const cat of ['frontend', 'backend', 'infrastructure', 'languages', 'leadership', 'tools']) {
    if (skills[cat]?._tag === "Some") {
      count += skills[cat].value.length
    }
  }
  return count
}

// variants remove <name>
const removeNameArg = Args.text({ name: "name" }).pipe(
  Args.withDescription("Name of variant to remove")
)

const removeCommand = Command.make("remove", { name: removeNameArg }, ({ name }) =>
  Effect.gen(function* () {
    const config = yield* Config
    const fs = yield* FileSystem.FileSystem

    const variantPath = `${config.defaultResumePath.replace("/resume.md", "/variants")}/${name}.md`
    const exists = yield* fs.exists(variantPath)

    if (!exists) {
      yield* Console.log(`Variant "${name}" not found.`)
      return
    }

    yield* fs.remove(variantPath)
    yield* Console.log(`✓ Removed variant "${name}"`)
  })
).pipe(Command.withDescription("Remove a saved variant"))

// Parent command
export const variantsCommand = Command.make("variants", {}, () =>
  Console.log(`Variant management commands

Usage:
  resume variants list           List all saved variants
  resume variants diff <name>    Compare variant to master
  resume variants remove <name>  Remove a saved variant

Examples:
  resume variants list
  resume variants diff company-swe
  resume variants remove old-variant`)
).pipe(
  Command.withSubcommands([listCommand, diffCommand, removeCommand]),
  Command.withDescription("Manage resume variants")
)
