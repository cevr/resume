import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"
import { Config, ResumeRepo } from "../../src/services/index.ts"
import { mockResume, minimalResume } from "../helpers/fixtures.ts"

// Helper to highlight term (same as in search.ts)
const highlightTerm = (text: string, term: string): string => {
  const regex = new RegExp(`(${term})`, "gi")
  return text.replace(regex, "[$1]")
}

// Extract search logic for testing
const getSearchResults = (term: string) =>
  Effect.gen(function* () {
    const config = yield* Config
    const repo = yield* ResumeRepo

    const resume = yield* repo.load(config.defaultResumePath)
    const searchTerm = term.toLowerCase()
    const results: string[] = []

    // Search contact
    const contactFields = [
      { field: "name", value: resume.contact.name },
      { field: "email", value: resume.contact.email },
    ]
    for (const { field, value } of contactFields) {
      if (value.toLowerCase().includes(searchTerm)) {
        results.push(`Contact > ${field}:\n  - ${value}`)
      }
    }

    // Search summary
    if (resume.summary._tag === "Some") {
      if (resume.summary.value.default.toLowerCase().includes(searchTerm)) {
        results.push(`Summary:\n  - "${highlightTerm(resume.summary.value.default.slice(0, 100), term)}..."`)
      }
    }

    // Search skills
    const skillCategories = [
      { name: "Frontend", skills: resume.skills.frontend },
      { name: "Backend", skills: resume.skills.backend },
      { name: "Infrastructure", skills: resume.skills.infrastructure },
      { name: "Languages", skills: resume.skills.languages },
      { name: "Leadership", skills: resume.skills.leadership },
      { name: "Tools", skills: resume.skills.tools },
    ]

    for (const { name, skills } of skillCategories) {
      if (skills._tag === "Some") {
        const matches = skills.value.filter((s) =>
          s.toLowerCase().includes(searchTerm)
        )
        if (matches.length > 0) {
          results.push(`Skills > ${name}:\n  - ${matches.join(", ")}`)
        }
      }
    }

    // Search experience
    for (const exp of resume.experience) {
      // Company/title
      if (
        exp.company.toLowerCase().includes(searchTerm) ||
        exp.title.toLowerCase().includes(searchTerm)
      ) {
        results.push(`Experience > ${exp.company}:\n  - ${exp.title}`)
      }

      // Highlights
      for (let i = 0; i < exp.highlights.length; i++) {
        const h = exp.highlights[i]
        if (!h) continue
        if (h.text.toLowerCase().includes(searchTerm)) {
          results.push(
            `Experience > ${exp.company} > Highlight #${i + 1}:\n  - "${highlightTerm(h.text, term)}"`
          )
        }

        // Keywords
        Option.match(h.keywords, {
          onNone: () => {},
          onSome: (keywords) => {
            const kwMatches = keywords.filter((kw) =>
              kw.toLowerCase().includes(searchTerm)
            )
            if (kwMatches.length > 0) {
              results.push(
                `Experience > ${exp.company} > Highlight #${i + 1} keywords:\n  - [${kwMatches.join(", ")}]`
              )
            }
          },
        })
      }

      // Technologies
      Option.match(exp.technologies, {
        onNone: () => {},
        onSome: (techs) => {
          const techMatches = techs.filter((t) =>
            t.toLowerCase().includes(searchTerm)
          )
          if (techMatches.length > 0) {
            results.push(
              `Experience > ${exp.company} > Technologies:\n  - ${techMatches.join(", ")}`
            )
          }
        },
      })
    }

    // Search open source
    Option.match(resume.openSource, {
      onNone: () => {},
      onSome: (projects) => {
        for (const project of projects) {
          if (
            project.name.toLowerCase().includes(searchTerm) ||
            project.description.toLowerCase().includes(searchTerm)
          ) {
            results.push(
              `Open Source > ${project.name}:\n  - ${project.description}`
            )
          }
        }
      },
    })

    return results
  })

const TestLayer = Layer.mergeAll(
  Config.test(),
  ResumeRepo.test({ resume: mockResume })
)

const MinimalTestLayer = Layer.mergeAll(
  Config.test(),
  ResumeRepo.test({ resume: minimalResume })
)

describe("search command", () => {
  it.effect("finds term in skills", () =>
    Effect.gen(function* () {
      const results = yield* getSearchResults("TypeScript")
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.includes("Skills > Frontend"))).toBe(true)
      expect(results.some((r) => r.includes("Skills > Languages"))).toBe(true)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("finds term in experience company name", () =>
    Effect.gen(function* () {
      const results = yield* getSearchResults("TechCorp")
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.includes("Experience > TechCorp"))).toBe(true)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("finds term in job title", () =>
    Effect.gen(function* () {
      const results = yield* getSearchResults("Senior")
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.includes("Senior Software Engineer"))).toBe(true)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("finds term in highlight text", () =>
    Effect.gen(function* () {
      const results = yield* getSearchResults("microservices")
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.includes("Highlight #1"))).toBe(true)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("finds term in technologies", () =>
    Effect.gen(function* () {
      const results = yield* getSearchResults("PostgreSQL")
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.includes("Technologies"))).toBe(true)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("finds term in open source projects", () =>
    Effect.gen(function* () {
      const results = yield* getSearchResults("library")
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.includes("Open Source"))).toBe(true)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("searches case-insensitively", () =>
    Effect.gen(function* () {
      const results = yield* getSearchResults("react")
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.includes("React"))).toBe(true)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("returns empty for non-matching term", () =>
    Effect.gen(function* () {
      const results = yield* getSearchResults("zzzznonexistent")
      expect(results.length).toBe(0)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("finds term in contact name", () =>
    Effect.gen(function* () {
      const results = yield* getSearchResults("Test User")
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.includes("Contact > name"))).toBe(true)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("finds term in summary", () =>
    Effect.gen(function* () {
      const results = yield* getSearchResults("scalable")
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.includes("Summary"))).toBe(true)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("handles minimal resume gracefully", () =>
    Effect.gen(function* () {
      const results = yield* getSearchResults("anything")
      expect(results.length).toBe(0)
    }).pipe(Effect.provide(MinimalTestLayer))
  )
})
