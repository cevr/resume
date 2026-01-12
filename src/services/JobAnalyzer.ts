import { Context, Effect, Layer, Option } from "effect"
import { HttpClient } from "@effect/platform"
import type { Resume } from "../schema/Resume.ts"
import { JobDescription } from "../schema/JobDescription.ts"
import { AnalysisResult, SectionValidation } from "../schema/Analysis.ts"
import { FetchError, ParseError } from "./errors.ts"

export interface JobAnalyzerService {
  readonly parseJobDescription: (text: string) => Effect.Effect<JobDescription, ParseError>

  readonly fetchJobDescription: (
    url: string
  ) => Effect.Effect<JobDescription, FetchError | ParseError, HttpClient.HttpClient>

  readonly analyzeMatch: (
    resume: Resume,
    job: JobDescription
  ) => Effect.Effect<AnalysisResult>

  readonly validateAtsCompatibility: (resume: Resume) => Effect.Effect<string[]>
}

export class JobAnalyzer extends Context.Tag("@app/JobAnalyzer")<
  JobAnalyzer,
  JobAnalyzerService
>() {
  static readonly layer = Layer.succeed(JobAnalyzer, JobAnalyzer.of({
    parseJobDescription: (text) =>
      Effect.sync(() => {
        const keywords = extractKeywords(text)
        const requirements = extractSection(text, ["requirements", "qualifications", "must have", "required"])
        const responsibilities = extractSection(text, ["responsibilities", "duties", "what you'll do", "role"])

        return new JobDescription({
          title: Option.none(),
          company: Option.none(),
          requirements,
          responsibilities,
          keywords,
          rawText: text,
        })
      }),

    fetchJobDescription: (url) =>
      Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient
        const analyzer = yield* JobAnalyzer

        const response = yield* client.get(url).pipe(
          Effect.mapError((cause) => new FetchError({ url, cause }))
        )

        const html = yield* response.text.pipe(
          Effect.mapError((cause) => new FetchError({ url, cause }))
        )

        // Simple HTML to text conversion
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s+/g, " ")
          .trim()

        return yield* analyzer.parseJobDescription(text)
      }),

    analyzeMatch: (resume, job) =>
      Effect.sync(() => {
        const resumeText = getResumeText(resume).toLowerCase()
        const jobKeywords = job.keywords.map((k) => k.toLowerCase())

        const matchedKeywords = jobKeywords.filter((k) => resumeText.includes(k))
        const missingKeywords = jobKeywords.filter((k) => !resumeText.includes(k))

        const matchScore = Math.round((matchedKeywords.length / jobKeywords.length) * 100) || 0

        const sectionValidation = new SectionValidation({
          hasContact: true, // Always true if we have a resume
          hasSummary: resume.summary._tag === "Some",
          hasExperience: resume.experience.length > 0,
          hasEducation: resume.education._tag === "Some" && resume.education.value.length > 0,
          hasSkills: hasAnySkills(resume),
        })

        const atsWarnings = getAtsWarnings(resume)

        return new AnalysisResult({
          matchScore,
          matchedKeywords,
          missingKeywords,
          suggestedHighlights: [],
          sectionValidation,
          atsWarnings,
        })
      }),

    validateAtsCompatibility: (resume) =>
      Effect.sync(() => getAtsWarnings(resume)),
  }))

  static readonly test = (responses: {
    score?: number
    missingKeywords?: string[]
    atsWarnings?: string[]
  } = {}) =>
    Layer.succeed(
      JobAnalyzer,
      JobAnalyzer.of({
        parseJobDescription: (text) =>
          Effect.succeed(
            new JobDescription({
              title: Option.none(),
              company: Option.none(),
              requirements: [],
              responsibilities: [],
              keywords: ["typescript", "react", "node"],
              rawText: text,
            })
          ),
        fetchJobDescription: () =>
          Effect.succeed(
            new JobDescription({
              title: Option.none(),
              company: Option.none(),
              requirements: [],
              responsibilities: [],
              keywords: ["typescript", "react"],
              rawText: "Test job description",
            })
          ) as Effect.Effect<JobDescription, FetchError | ParseError, HttpClient.HttpClient>,
        analyzeMatch: () =>
          Effect.succeed(
            new AnalysisResult({
              matchScore: responses.score ?? 75,
              matchedKeywords: ["typescript", "react"],
              missingKeywords: responses.missingKeywords ?? ["kubernetes", "aws"],
              suggestedHighlights: [],
              sectionValidation: new SectionValidation({
                hasContact: true,
                hasSummary: true,
                hasExperience: true,
                hasEducation: true,
                hasSkills: true,
              }),
              atsWarnings: responses.atsWarnings ?? [],
            })
          ),
        validateAtsCompatibility: () =>
          Effect.succeed(responses.atsWarnings ?? []),
      })
    )
}

// Helper functions

function extractKeywords(text: string): string[] {
  // Common tech keywords to look for
  const techKeywords = [
    "typescript", "javascript", "react", "node", "python", "java", "go", "rust",
    "aws", "gcp", "azure", "docker", "kubernetes", "ci/cd", "devops",
    "sql", "nosql", "mongodb", "postgresql", "redis", "graphql", "rest",
    "agile", "scrum", "leadership", "mentorship", "architecture",
    "microservices", "distributed", "scalable", "performance",
    "testing", "tdd", "unit testing", "integration",
    "git", "github", "gitlab",
  ]

  const found = new Set<string>()
  const lowerText = text.toLowerCase()

  for (const keyword of techKeywords) {
    if (lowerText.includes(keyword)) {
      found.add(keyword)
    }
  }

  // Also extract years of experience mentions
  const yearsMatch = text.match(/(\d+)\+?\s*years?/gi)
  if (yearsMatch) {
    found.add(yearsMatch[0]!)
  }

  return Array.from(found)
}

function extractSection(text: string, markers: string[]): string[] {
  const lines: string[] = []
  const lowerText = text.toLowerCase()

  for (const marker of markers) {
    const index = lowerText.indexOf(marker)
    if (index !== -1) {
      // Extract text after the marker until next section or end
      const afterMarker = text.slice(index + marker.length, index + 2000)
      const bullets = afterMarker.match(/[•\-\*]\s*[^\n]+/g)
      if (bullets) {
        lines.push(...bullets.map((b) => b.replace(/^[•\-\*]\s*/, "").trim()))
      }
    }
  }

  return lines.slice(0, 10) // Limit to 10 items
}

function getResumeText(resume: Resume): string {
  const parts: string[] = []

  if (resume.summary._tag === "Some") {
    parts.push(resume.summary.value.default)
  }

  const allSkills: string[] = []
  if (resume.skills.frontend._tag === "Some") allSkills.push(...resume.skills.frontend.value)
  if (resume.skills.backend._tag === "Some") allSkills.push(...resume.skills.backend.value)
  if (resume.skills.infrastructure._tag === "Some") allSkills.push(...resume.skills.infrastructure.value)
  if (resume.skills.languages._tag === "Some") allSkills.push(...resume.skills.languages.value)
  if (resume.skills.leadership._tag === "Some") allSkills.push(...resume.skills.leadership.value)
  if (resume.skills.tools._tag === "Some") allSkills.push(...resume.skills.tools.value)
  parts.push(allSkills.join(" "))

  for (const exp of resume.experience) {
    parts.push(exp.title)
    parts.push(exp.company)
    if (exp.technologies._tag === "Some") {
      parts.push(exp.technologies.value.join(" "))
    }
    for (const h of exp.highlights) {
      parts.push(h.text)
      if (h.keywords._tag === "Some") {
        parts.push(h.keywords.value.join(" "))
      }
    }
  }

  return parts.join(" ")
}

function hasAnySkills(resume: Resume): boolean {
  return (
    resume.skills.frontend._tag === "Some" ||
    resume.skills.backend._tag === "Some" ||
    resume.skills.infrastructure._tag === "Some" ||
    resume.skills.languages._tag === "Some" ||
    resume.skills.leadership._tag === "Some" ||
    resume.skills.tools._tag === "Some"
  )
}

function getAtsWarnings(resume: Resume): string[] {
  const warnings: string[] = []

  if (resume.summary._tag === "None") {
    warnings.push("Missing professional summary - ATS systems often look for this section")
  }

  if (resume.experience.length === 0) {
    warnings.push("No work experience listed")
  }

  if (!hasAnySkills(resume)) {
    warnings.push("No skills section - important for keyword matching")
  }

  // Check for unquantified achievements
  let unquantifiedCount = 0
  for (const exp of resume.experience) {
    for (const h of exp.highlights) {
      if (h.quantified._tag === "None" || h.quantified.value === false) {
        // Check if the text has numbers
        if (!/\d/.test(h.text)) {
          unquantifiedCount++
        }
      }
    }
  }
  if (unquantifiedCount > 3) {
    warnings.push(`${unquantifiedCount} achievements lack quantifiable metrics - consider adding specific numbers`)
  }

  return warnings
}
