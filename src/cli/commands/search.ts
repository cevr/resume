import { Command, Args } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { Config, ResumeRepo } from "../../services/index.ts"

const termArg = Args.text({ name: "term" }).pipe(
  Args.withDescription("Search term (case-insensitive)")
)

export const searchCommand = Command.make(
  "search",
  { term: termArg },
  ({ term }) =>
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

      // Output results
      if (results.length === 0) {
        yield* Console.log(`No matches found for "${term}"`)
      } else {
        yield* Console.log(`Found "${term}" in ${results.length} location(s):\n`)
        for (const result of results) {
          yield* Console.log(result)
          yield* Console.log("")
        }
      }
    })
).pipe(Command.withDescription("Search for a term in the resume"))

function highlightTerm(text: string, term: string): string {
  // Simple highlight by making the term uppercase
  const regex = new RegExp(`(${term})`, "gi")
  return text.replace(regex, "[$1]")
}
