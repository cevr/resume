import { Context, Effect, Layer, Option } from "effect"
import { anthropic } from "@ai-sdk/anthropic"
import { generateText, generateObject } from "ai"
import { z } from "zod"
import type { Resume } from "../schema/Resume.ts"
import type { JobDescription } from "../schema/JobDescription.ts"
import type { VerbSuggestion, KeywordDensityReport } from "../schema/Analysis.ts"
import { AIError } from "./errors.ts"
import { Config } from "./Config.ts"

export interface AIAssistantService {
  readonly suggestKeywords: (
    resume: Resume,
    job: JobDescription
  ) => Effect.Effect<string[], AIError>

  readonly quantifyAchievement: (
    highlight: string,
    context: string
  ) => Effect.Effect<string[], AIError>

  readonly improveVerbs: (
    highlights: string[]
  ) => Effect.Effect<VerbSuggestion[], AIError>

  readonly generateSummary: (
    resume: Resume,
    job: JobDescription
  ) => Effect.Effect<string, AIError>

  readonly analyzeKeywordDensity: (
    resume: Resume,
    targetKeywords: string[]
  ) => Effect.Effect<KeywordDensityReport[], AIError>
}

export class AIAssistant extends Context.Tag("@app/AIAssistant")<
  AIAssistant,
  AIAssistantService
>() {
  static readonly layer = Layer.effect(
    AIAssistant,
    Effect.gen(function* () {
      const config = yield* Config

      if (config.anthropicApiKey._tag === "None") {
        // Return a no-op implementation if no API key
        return AIAssistant.of({
          suggestKeywords: () => Effect.succeed([]),
          quantifyAchievement: () => Effect.succeed([]),
          improveVerbs: () => Effect.succeed([]),
          generateSummary: () => Effect.succeed(""),
          analyzeKeywordDensity: () => Effect.succeed([]),
        })
      }

      const model = anthropic("claude-sonnet-4-20250514")

      return AIAssistant.of({
        suggestKeywords: (resume, job) =>
          Effect.tryPromise({
            try: async () => {
              const resumeText = formatResumeForPrompt(resume)
              const { object } = await generateObject({
                model,
                schema: z.object({
                  keywords: z.array(z.string()).describe("Missing keywords from the resume that appear in the job description"),
                }),
                prompt: `Analyze this resume against the job description and identify important keywords from the job posting that are missing from the resume.

Job Description:
${job.rawText}

Resume:
${resumeText}

Return keywords that would improve ATS matching.`,
              })
              return object.keywords
            },
            catch: (e) => new AIError({ operation: "suggestKeywords", cause: e }),
          }),

        quantifyAchievement: (highlight, context) =>
          Effect.tryPromise({
            try: async () => {
              const { object } = await generateObject({
                model,
                schema: z.object({
                  suggestions: z.array(z.string()).describe("Quantified versions of the achievement"),
                }),
                prompt: `Rewrite this resume bullet point to include specific metrics and quantifiable results.

Original: "${highlight}"
Context: ${context}

Provide 2-3 alternative versions with estimated metrics. If you don't have exact numbers, use reasonable estimates based on typical outcomes.`,
              })
              return object.suggestions
            },
            catch: (e) => new AIError({ operation: "quantifyAchievement", cause: e }),
          }),

        improveVerbs: (highlights) =>
          Effect.tryPromise({
            try: async () => {
              const { object } = await generateObject({
                model,
                schema: z.object({
                  suggestions: z.array(z.object({
                    original: z.string(),
                    improved: z.string(),
                    context: z.string().optional(),
                  })),
                }),
                prompt: `Review these resume bullet points and suggest stronger action verbs.

Bullet points:
${highlights.map((h, i) => `${i + 1}. ${h}`).join("\n")}

For each bullet point that could use a stronger verb, provide the original text and an improved version.`,
              })
              return object.suggestions.map((s) => ({
                original: s.original,
                improved: s.improved,
                context: Option.fromNullable(s.context),
              })) as VerbSuggestion[]
            },
            catch: (e) => new AIError({ operation: "improveVerbs", cause: e }),
          }),

        generateSummary: (resume, job) =>
          Effect.tryPromise({
            try: async () => {
              const resumeText = formatResumeForPrompt(resume)
              const { text } = await generateText({
                model,
                prompt: `Write a compelling 2-3 sentence professional summary for this candidate, tailored to the following job.

Job Description:
${job.rawText}

Resume:
${resumeText}

Write in first person, highlighting the most relevant experience and skills for this specific role. Be concise and impactful.`,
              })
              return text
            },
            catch: (e) => new AIError({ operation: "generateSummary", cause: e }),
          }),

        analyzeKeywordDensity: (resume, targetKeywords) =>
          Effect.tryPromise({
            try: async () => {
              const resumeText = formatResumeForPrompt(resume).toLowerCase()

              return targetKeywords.map((keyword) => {
                const regex = new RegExp(keyword.toLowerCase(), "gi")
                const matches = resumeText.match(regex)
                const count = matches ? matches.length : 0
                const recommended = 2 // Ideally appear 2+ times

                return {
                  keyword,
                  count,
                  recommended,
                  status: count === 0 ? "low" : count >= recommended ? "good" : "low",
                } as KeywordDensityReport
              })
            },
            catch: (e) => new AIError({ operation: "analyzeKeywordDensity", cause: e }),
          }),
      })
    })
  )

  static readonly test = (responses: {
    keywords?: string[]
    summary?: string
    quantified?: string[]
    verbs?: VerbSuggestion[]
  } = {}) =>
    Layer.succeed(
      AIAssistant,
      AIAssistant.of({
        suggestKeywords: () =>
          Effect.succeed(responses.keywords ?? ["typescript", "react", "leadership"]),
        quantifyAchievement: () =>
          Effect.succeed(responses.quantified ?? ["Improved performance by 50%"]),
        improveVerbs: () =>
          Effect.succeed(responses.verbs ?? []),
        generateSummary: () =>
          Effect.succeed(responses.summary ?? "Experienced engineer with strong technical skills."),
        analyzeKeywordDensity: () =>
          Effect.succeed([]),
      })
    )
}

function formatResumeForPrompt(resume: Resume): string {
  const lines: string[] = []

  lines.push(`Name: ${resume.contact.name}`)
  lines.push("")

  if (resume.summary._tag === "Some") {
    lines.push(`Summary: ${resume.summary.value.default}`)
    lines.push("")
  }

  lines.push("Skills:")
  if (resume.skills.frontend._tag === "Some") {
    lines.push(`  Frontend: ${resume.skills.frontend.value.join(", ")}`)
  }
  if (resume.skills.backend._tag === "Some") {
    lines.push(`  Backend: ${resume.skills.backend.value.join(", ")}`)
  }
  if (resume.skills.infrastructure._tag === "Some") {
    lines.push(`  Infrastructure: ${resume.skills.infrastructure.value.join(", ")}`)
  }
  lines.push("")

  lines.push("Experience:")
  for (const exp of resume.experience) {
    lines.push(`  ${exp.title} at ${exp.company} (${exp.startDate} - ${exp.endDate})`)
    for (const h of exp.highlights) {
      lines.push(`    - ${h.text}`)
    }
  }

  return lines.join("\n")
}
