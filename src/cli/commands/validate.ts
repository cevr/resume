import { Command, Options } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { Config, ResumeRepo, JobAnalyzer } from "../../services/index.ts"

const strict = Options.boolean("strict").pipe(
  Options.withAlias("s"),
  Options.withDefault(false),
  Options.withDescription("Enable strict validation mode")
)

export const validateCommand = Command.make(
  "validate",
  { strict },
  ({ strict }) =>
    Effect.gen(function* () {
      const config = yield* Config
      const repo = yield* ResumeRepo
      const analyzer = yield* JobAnalyzer

      yield* Console.log(`Validating resume at ${config.defaultResumePath}...`)

      // Try to load and parse the resume
      const resume = yield* repo.load(config.defaultResumePath)

      yield* Console.log("✓ Resume parsed successfully")

      // Check ATS compatibility
      const warnings = yield* analyzer.validateAtsCompatibility(resume)

      // Basic validation
      yield* Console.log("\nStructure Check:")
      yield* Console.log(`  ✓ Contact: ${resume.contact.name} <${resume.contact.email}>`)
      yield* Console.log(`  ${resume.summary._tag === "Some" ? "✓" : "✗"} Summary section`)
      yield* Console.log(`  ✓ Experience: ${resume.experience.length} positions`)

      // Count highlights
      const totalHighlights = resume.experience.reduce(
        (sum, exp) => sum + exp.highlights.length,
        0
      )
      yield* Console.log(`  ✓ Highlights: ${totalHighlights} bullet points`)

      // Skills
      let skillCount = 0
      if (resume.skills.frontend._tag === "Some") skillCount += resume.skills.frontend.value.length
      if (resume.skills.backend._tag === "Some") skillCount += resume.skills.backend.value.length
      if (resume.skills.infrastructure._tag === "Some") skillCount += resume.skills.infrastructure.value.length
      if (resume.skills.languages._tag === "Some") skillCount += resume.skills.languages.value.length
      yield* Console.log(`  ✓ Skills: ${skillCount} listed`)

      // Education
      if (resume.education._tag === "Some") {
        yield* Console.log(`  ✓ Education: ${resume.education.value.length} entries`)
      } else {
        yield* Console.log(`  - Education: none listed`)
      }

      // ATS warnings
      if (warnings.length > 0) {
        yield* Console.log("\nATS Compatibility Warnings:")
        for (const warning of warnings) {
          yield* Console.log(`  ⚠ ${warning}`)
        }
      } else {
        yield* Console.log("\n✓ No ATS compatibility issues detected")
      }

      // Strict mode additional checks
      if (strict) {
        yield* Console.log("\nStrict Mode Checks:")

        // Check for quantified achievements
        let unquantified = 0
        for (const exp of resume.experience) {
          for (const h of exp.highlights) {
            if (!/\d/.test(h.text)) unquantified++
          }
        }
        if (unquantified > 0) {
          yield* Console.log(`  ⚠ ${unquantified} highlights lack metrics`)
        } else {
          yield* Console.log(`  ✓ All highlights have metrics`)
        }

        // Check contact info completeness
        const contactFields = [
          ["phone", resume.contact.phone],
          ["linkedin", resume.contact.linkedin],
          ["github", resume.contact.github],
          ["website", resume.contact.website],
        ] as const

        for (const [field, value] of contactFields) {
          if (value._tag === "None") {
            yield* Console.log(`  - Missing optional: ${field}`)
          }
        }
      }

      yield* Console.log("\nValidation complete.")
    })
).pipe(Command.withDescription("Validate resume structure and ATS compatibility"))
