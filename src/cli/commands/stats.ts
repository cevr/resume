import { Command } from "@effect/cli"
import { Console, Effect } from "effect"
import { FileSystem } from "@effect/platform"
import { Config, ResumeRepo } from "../../services/index.ts"

export const statsCommand = Command.make(
  "stats",
  {},
  () =>
    Effect.gen(function* () {
      const config = yield* Config
      const repo = yield* ResumeRepo
      const fs = yield* FileSystem.FileSystem

      const resume = yield* repo.load(config.defaultResumePath)

      // Basic counts
      const totalHighlights = resume.experience.reduce(
        (acc, exp) => acc + exp.highlights.length,
        0
      )
      const quantifiedHighlights = resume.experience.reduce(
        (acc, exp) =>
          acc +
          exp.highlights.filter(
            (h) => h.quantified._tag === "Some" && h.quantified.value
          ).length,
        0
      )

      // Skills count
      const skillsCount = [
        resume.skills.frontend,
        resume.skills.backend,
        resume.skills.infrastructure,
        resume.skills.languages,
        resume.skills.leadership,
        resume.skills.tools,
      ].reduce((acc, cat) => {
        if (cat._tag === "Some") return acc + cat.value.length
        return acc
      }, 0)

      // Open source count
      const ossCount =
        resume.openSource._tag === "Some" ? resume.openSource.value.length : 0

      // Keyword frequency from highlights
      const keywordCounts = new Map<string, number>()
      for (const exp of resume.experience) {
        for (const h of exp.highlights) {
          if (h.keywords._tag === "Some") {
            for (const kw of h.keywords.value) {
              keywordCounts.set(kw, (keywordCounts.get(kw) || 0) + 1)
            }
          }
        }
      }

      // Top keywords
      const topKeywords = [...keywordCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([kw, count]) => `${kw} (${count})`)
        .join(", ")

      // Count variants
      let variantCount = 0
      try {
        const variantsDir = `${config.defaultResumePath.replace("/resume.md", "/variants")}`
        const exists = yield* fs.exists(variantsDir)
        if (exists) {
          const entries = yield* fs.readDirectory(variantsDir)
          variantCount = entries.filter((e) => e.endsWith(".md")).length
        }
      } catch {
        // variants dir doesn't exist
      }

      // Count jobs
      let jobCount = 0
      try {
        const jobsDir = `${config.defaultResumePath.replace("/resume.md", "/jobs")}`
        const exists = yield* fs.exists(jobsDir)
        if (exists) {
          const entries = yield* fs.readDirectory(jobsDir)
          jobCount = entries.filter((e) => e.endsWith(".json")).length
        }
      } catch {
        // jobs dir doesn't exist
      }

      // Meta info
      const lastUpdated =
        resume.meta._tag === "Some" && resume.meta.value.lastUpdated._tag === "Some"
          ? resume.meta.value.lastUpdated.value
          : "unknown"
      const targetRole =
        resume.meta._tag === "Some" && resume.meta.value.target._tag === "Some"
          ? resume.meta.value.target.value
          : "not specified"

      // Calculate years of experience
      const oldestDate = resume.experience.reduce((oldest, exp) => {
        const date = new Date(exp.startDate)
        return date < oldest ? date : oldest
      }, new Date())
      const yearsExp = Math.floor(
        (Date.now() - oldestDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      )

      // Unquantified count
      const unquantified = totalHighlights - quantifiedHighlights

      // Output
      const output = `
Resume Stats for ${resume.contact.name}
${"=".repeat(32 + resume.contact.name.length)}
Last Updated: ${lastUpdated}
Target Role:  ${targetRole}

Content:
  Experience:    ${resume.experience.length} positions (${yearsExp}+ years)
  Highlights:    ${totalHighlights} bullet points
  Quantified:    ${quantifiedHighlights}/${totalHighlights} (${Math.round((quantifiedHighlights / totalHighlights) * 100)}%)
  Skills:        ${skillsCount} listed
  Open Source:   ${ossCount} projects

ATS Readiness:
  Summary:       ${resume.summary._tag === "Some" ? "✓ Present" : "✗ Missing"}
  Top Keywords:  ${topKeywords || "none tagged"}
  Warnings:      ${unquantified > 0 ? `${unquantified} unquantified achievements` : "none"}

Variants:       ${variantCount} saved
Jobs Tracked:   ${jobCount} saved
`.trim()

      yield* Console.log(output)
    })
).pipe(Command.withDescription("Show resume statistics and health metrics"))
