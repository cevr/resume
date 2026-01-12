import { Command, Prompt } from "@effect/cli"
import { Console, Effect } from "effect"
import { FileSystem } from "@effect/platform"

const TEMPLATE = `---
meta:
  version: "1.0"
  lastUpdated: "${new Date().toISOString().split("T")[0]}"
  target: "Staff Product Engineering"

contact:
  name: "Your Name"
  email: "email@example.com"
  phone: "+1-555-555-5555"
  location: "City, State"
  linkedin: "your-linkedin"
  github: "your-github"
  website: "yoursite.com"

summary:
  default: |
    Staff-level product engineer with X+ years of experience building scalable
    web applications. Proven track record in technical leadership, system
    architecture, and delivering impactful products.

skills:
  frontend:
    - TypeScript
    - React
    - Next.js
  backend:
    - Node.js
    - PostgreSQL
    - GraphQL
  infrastructure:
    - AWS
    - Docker
    - CI/CD
  languages:
    - TypeScript
    - JavaScript
    - Python

experience:
  - company: "Current Company"
    title: "Senior Software Engineer"
    location: "Remote"
    startDate: "2022-01"
    endDate: "present"
    highlights:
      - text: "Led architecture redesign reducing latency by X%"
        keywords:
          - architecture
          - performance
          - leadership
        quantified: true
      - text: "Mentored X engineers across Y teams"
        keywords:
          - mentorship
          - leadership
        quantified: true
    technologies:
      - TypeScript
      - React
      - Node.js

  - company: "Previous Company"
    title: "Software Engineer"
    location: "Remote"
    startDate: "2020-01"
    endDate: "2021-12"
    highlights:
      - text: "Built feature X that improved user engagement by Y%"
        keywords:
          - product
          - engagement
        quantified: true
    technologies:
      - JavaScript
      - React

education:
  - institution: "University Name"
    degree: "B.S. Computer Science"
    graduationDate: "2019-05"
---
`

export const initCommand = Command.make(
  "init",
  {},
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem

      // Check if resume already exists
      const exists = yield* fs.exists("./data/resume.md")

      if (exists) {
        const overwrite = yield* Prompt.confirm({
          message: "Resume already exists at ./data/resume.md. Overwrite?",
        }).pipe(Effect.orDie)

        if (!overwrite) {
          yield* Console.log("Aborted.")
          return
        }
      }

      // Create data directory
      yield* fs.makeDirectory("./data", { recursive: true }).pipe(
        Effect.catchAll(() => Effect.void)
      )

      // Write template
      yield* fs.writeFileString("./data/resume.md", TEMPLATE)

      yield* Console.log("Created resume template at ./data/resume.md")
      yield* Console.log("")
      yield* Console.log("Next steps:")
      yield* Console.log("  1. Edit ./data/resume.md with your information")
      yield* Console.log("  2. Validate: resume validate")
      yield* Console.log("  3. Preview:  resume preview")
      yield* Console.log("  4. Export:   resume export -f pdf")
    })
).pipe(Command.withDescription("Initialize a new resume from template"))
