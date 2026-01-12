import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { FileSystem } from "@effect/platform"
import { Config, ResumeRepo } from "../../src/services/index.ts"
import { mockResume, minimalResume } from "../helpers/fixtures.ts"

// Mock FileSystem that returns empty directories
const mockFileSystem = Layer.succeed(FileSystem.FileSystem, {
  exists: () => Effect.succeed(false),
  readDirectory: () => Effect.succeed([]),
  access: () => Effect.void,
  copy: () => Effect.void,
  copyFile: () => Effect.void,
  chmod: () => Effect.void,
  chown: () => Effect.void,
  link: () => Effect.void,
  makeDirectory: () => Effect.void,
  makeTempDirectory: () => Effect.succeed("/tmp/test"),
  makeTempDirectoryScoped: () => Effect.succeed("/tmp/test"),
  makeTempFile: () => Effect.succeed("/tmp/test.txt"),
  makeTempFileScoped: () => Effect.succeed("/tmp/test.txt"),
  open: () => Effect.die("not implemented"),
  readFile: () => Effect.succeed(new Uint8Array()),
  readFileString: () => Effect.succeed(""),
  readLink: () => Effect.succeed(""),
  realPath: () => Effect.succeed(""),
  remove: () => Effect.void,
  rename: () => Effect.void,
  sink: () => Effect.die("not implemented"),
  stat: () => Effect.die("not implemented"),
  stream: () => Effect.die("not implemented"),
  symlink: () => Effect.void,
  truncate: () => Effect.void,
  utimes: () => Effect.void,
  watch: () => Effect.die("not implemented"),
  writeFile: () => Effect.void,
  writeFileString: () => Effect.void,
} as FileSystem.FileSystem)

// Extract the stats logic to return the output string for testing
const getStatsOutput = Effect.gen(function* () {
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
  const variantsDir = `${config.defaultResumePath.replace("/resume.md", "/variants")}`
  const variantsExist = yield* fs.exists(variantsDir)
  if (variantsExist) {
    const entries = yield* fs.readDirectory(variantsDir)
    variantCount = entries.filter((e) => e.endsWith(".md")).length
  }

  // Count jobs
  let jobCount = 0
  const jobsDir = `${config.defaultResumePath.replace("/resume.md", "/jobs")}`
  const jobsExist = yield* fs.exists(jobsDir)
  if (jobsExist) {
    const entries = yield* fs.readDirectory(jobsDir)
    jobCount = entries.filter((e) => e.endsWith(".json")).length
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
  const oldestDate = resume.experience.length > 0
    ? resume.experience.reduce((oldest, exp) => {
        const date = new Date(exp.startDate)
        return date < oldest ? date : oldest
      }, new Date())
    : new Date()
  const yearsExp = Math.floor(
    (Date.now() - oldestDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  )

  // Unquantified count
  const unquantified = totalHighlights - quantifiedHighlights

  // Output
  return `
Resume Stats for ${resume.contact.name}
${"=".repeat(32 + resume.contact.name.length)}
Last Updated: ${lastUpdated}
Target Role:  ${targetRole}

Content:
  Experience:    ${resume.experience.length} positions (${yearsExp}+ years)
  Highlights:    ${totalHighlights} bullet points
  Quantified:    ${quantifiedHighlights}/${totalHighlights} (${totalHighlights > 0 ? Math.round((quantifiedHighlights / totalHighlights) * 100) : 0}%)
  Skills:        ${skillsCount} listed
  Open Source:   ${ossCount} projects

ATS Readiness:
  Summary:       ${resume.summary._tag === "Some" ? "✓ Present" : "✗ Missing"}
  Top Keywords:  ${topKeywords || "none tagged"}
  Warnings:      ${unquantified > 0 ? `${unquantified} unquantified achievements` : "none"}

Variants:       ${variantCount} saved
Jobs Tracked:   ${jobCount} saved
`.trim()
})

const TestLayer = Layer.mergeAll(
  Config.test(),
  ResumeRepo.test({ resume: mockResume }),
  mockFileSystem
)

const MinimalTestLayer = Layer.mergeAll(
  Config.test(),
  ResumeRepo.test({ resume: minimalResume }),
  mockFileSystem
)

describe("stats command", () => {
  it.effect("displays resume name in header", () =>
    Effect.gen(function* () {
      const output = yield* getStatsOutput
      expect(output).toContain("Resume Stats for Test User")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("shows correct experience count", () =>
    Effect.gen(function* () {
      const output = yield* getStatsOutput
      // mockResume has 2 experience entries
      expect(output).toContain("Experience:    2 positions")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("shows correct highlight count", () =>
    Effect.gen(function* () {
      const output = yield* getStatsOutput
      // mockResume has 5 total highlights (3 + 2)
      expect(output).toContain("Highlights:    5 bullet points")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("shows quantified percentage", () =>
    Effect.gen(function* () {
      const output = yield* getStatsOutput
      // 4 out of 5 highlights are quantified = 80%
      expect(output).toContain("Quantified:    4/5 (80%)")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("shows skills count", () =>
    Effect.gen(function* () {
      const output = yield* getStatsOutput
      // 3+3+3+3+2+2 = 16 skills
      expect(output).toContain("Skills:        16 listed")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("shows summary present indicator", () =>
    Effect.gen(function* () {
      const output = yield* getStatsOutput
      expect(output).toContain("Summary:       ✓ Present")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("shows summary missing for minimal resume", () =>
    Effect.gen(function* () {
      const output = yield* getStatsOutput
      expect(output).toContain("Summary:       ✗ Missing")
    }).pipe(Effect.provide(MinimalTestLayer))
  )

  it.effect("shows open source project count", () =>
    Effect.gen(function* () {
      const output = yield* getStatsOutput
      expect(output).toContain("Open Source:   1 projects")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("shows target role from meta", () =>
    Effect.gen(function* () {
      const output = yield* getStatsOutput
      expect(output).toContain("Target Role:  Senior Software Engineer")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("handles resume with no experience", () =>
    Effect.gen(function* () {
      const output = yield* getStatsOutput
      expect(output).toContain("Experience:    0 positions")
      expect(output).toContain("Highlights:    0 bullet points")
    }).pipe(Effect.provide(MinimalTestLayer))
  )
})
