import { Context, Effect, Layer } from "effect"
import type { Resume } from "../schema/Resume.ts"
import { PreviewError } from "./errors.ts"

export interface PreviewService {
  readonly terminalPreview: (resume: Resume) => Effect.Effect<string>
  readonly browserPreview: (resume: Resume) => Effect.Effect<void, PreviewError>
}

export class Preview extends Context.Tag("@app/Preview")<
  Preview,
  PreviewService
>() {
  static readonly layer = Layer.succeed(Preview, Preview.of({
    terminalPreview: (resume) =>
      Effect.sync(() => {
        const lines: string[] = []
        const width = 70

        // Header
        const name = resume.contact.name.toUpperCase()
        const padding = Math.max(0, Math.floor((width - name.length) / 2))
        lines.push("")
        lines.push(" ".repeat(padding) + name)
        lines.push("=".repeat(width))

        // Contact
        const contactParts: string[] = [resume.contact.email]
        if (resume.contact.phone._tag === "Some") contactParts.push(resume.contact.phone.value)
        if (resume.contact.website._tag === "Some") contactParts.push(resume.contact.website.value)
        if (resume.contact.linkedin._tag === "Some") contactParts.push(`linkedin.com/in/${resume.contact.linkedin.value}`)
        if (resume.contact.github._tag === "Some") contactParts.push(`github.com/${resume.contact.github.value}`)
        lines.push(contactParts.join(" | "))
        lines.push("")

        // Summary
        if (resume.summary._tag === "Some") {
          lines.push("SUMMARY")
          lines.push("-".repeat(width))
          lines.push(wrapText(resume.summary.value.default, width))
          lines.push("")
        }

        // Skills
        lines.push("SKILLS")
        lines.push("-".repeat(width))
        if (resume.skills.frontend._tag === "Some") {
          lines.push(`Frontend:       ${resume.skills.frontend.value.join(", ")}`)
        }
        if (resume.skills.backend._tag === "Some") {
          lines.push(`Backend:        ${resume.skills.backend.value.join(", ")}`)
        }
        if (resume.skills.infrastructure._tag === "Some") {
          lines.push(`Infrastructure: ${resume.skills.infrastructure.value.join(", ")}`)
        }
        if (resume.skills.languages._tag === "Some") {
          lines.push(`Languages:      ${resume.skills.languages.value.join(", ")}`)
        }
        if (resume.skills.leadership._tag === "Some") {
          lines.push(`Leadership:     ${resume.skills.leadership.value.join(", ")}`)
        }
        lines.push("")

        // Experience
        lines.push("EXPERIENCE")
        lines.push("-".repeat(width))
        for (const exp of resume.experience) {
          lines.push(`${exp.title} | ${exp.company}`)
          const location = exp.location._tag === "Some" ? ` | ${exp.location.value}` : ""
          lines.push(`${exp.startDate} - ${exp.endDate}${location}`)
          for (const h of exp.highlights) {
            lines.push(`  • ${wrapText(h.text, width - 4)}`)
          }
          lines.push("")
        }

        // Education
        if (resume.education._tag === "Some" && resume.education.value.length > 0) {
          lines.push("EDUCATION")
          lines.push("-".repeat(width))
          for (const edu of resume.education.value) {
            lines.push(`${edu.degree} - ${edu.institution}`)
            if (edu.graduationDate._tag === "Some") {
              lines.push(`  ${edu.graduationDate.value}`)
            }
          }
          lines.push("")
        }

        // Open Source
        if (resume.openSource._tag === "Some" && resume.openSource.value.length > 0) {
          lines.push("OPEN SOURCE")
          lines.push("-".repeat(width))
          for (const project of resume.openSource.value) {
            lines.push(`${project.name}: ${project.description}`)
          }
          lines.push("")
        }

        return lines.join("\n")
      }),

    browserPreview: (resume) =>
      Effect.tryPromise({
        try: async () => {
          const html = generateHtml(resume)
          const tempFile = `/tmp/resume-preview-${Date.now()}.html`

          await Bun.write(tempFile, html)

          // Open in browser
          const proc = Bun.spawn(["open", tempFile])
          await proc.exited
        },
        catch: (error) => new PreviewError({ cause: error }),
      }),
  }))

  static readonly test = () =>
    Layer.succeed(Preview, Preview.of({
      terminalPreview: () => Effect.succeed("Mock preview"),
      browserPreview: () => Effect.void,
    }))
}

function wrapText(text: string, width: number): string {
  const words = text.split(" ")
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? " " : "") + word
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)

  return lines.join("\n")
}

function generateHtml(resume: Resume): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${resume.contact.name} - Resume</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      color: #333;
    }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .contact { color: #666; margin-bottom: 1.5rem; font-size: 0.9rem; }
    .contact a { color: #0066cc; text-decoration: none; }
    h2 {
      font-size: 1.1rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 2px solid #333;
      padding-bottom: 0.3rem;
      margin: 1.5rem 0 1rem;
    }
    .summary { color: #444; }
    .skills-grid { display: grid; gap: 0.3rem; }
    .skill-row { display: flex; }
    .skill-label { font-weight: 600; width: 120px; }
    .job { margin-bottom: 1.5rem; }
    .job-header { display: flex; justify-content: space-between; }
    .job-title { font-weight: 600; }
    .job-date { color: #666; font-size: 0.9rem; }
    ul { padding-left: 1.2rem; margin-top: 0.5rem; }
    li { margin-bottom: 0.3rem; }
    .education-item { margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <h1>${resume.contact.name}</h1>
  <div class="contact">
    ${resume.contact.email}
    ${resume.contact.phone._tag === "Some" ? ` | ${resume.contact.phone.value}` : ""}
    ${resume.contact.website._tag === "Some" ? ` | <a href="https://${resume.contact.website.value}">${resume.contact.website.value}</a>` : ""}
    ${resume.contact.linkedin._tag === "Some" ? ` | <a href="https://linkedin.com/in/${resume.contact.linkedin.value}">LinkedIn</a>` : ""}
    ${resume.contact.github._tag === "Some" ? ` | <a href="https://github.com/${resume.contact.github.value}">GitHub</a>` : ""}
  </div>

  ${resume.summary._tag === "Some" ? `
  <h2>Summary</h2>
  <p class="summary">${resume.summary.value.default}</p>
  ` : ""}

  <h2>Skills</h2>
  <div class="skills-grid">
    ${resume.skills.frontend._tag === "Some" ? `<div class="skill-row"><span class="skill-label">Frontend:</span> ${resume.skills.frontend.value.join(", ")}</div>` : ""}
    ${resume.skills.backend._tag === "Some" ? `<div class="skill-row"><span class="skill-label">Backend:</span> ${resume.skills.backend.value.join(", ")}</div>` : ""}
    ${resume.skills.infrastructure._tag === "Some" ? `<div class="skill-row"><span class="skill-label">Infrastructure:</span> ${resume.skills.infrastructure.value.join(", ")}</div>` : ""}
    ${resume.skills.languages._tag === "Some" ? `<div class="skill-row"><span class="skill-label">Languages:</span> ${resume.skills.languages.value.join(", ")}</div>` : ""}
  </div>

  <h2>Experience</h2>
  ${resume.experience.map((exp) => `
  <div class="job">
    <div class="job-header">
      <span class="job-title">${exp.title} | ${exp.company}</span>
      <span class="job-date">${exp.startDate} - ${exp.endDate}</span>
    </div>
    <ul>
      ${exp.highlights.map((h) => `<li>${h.text}</li>`).join("")}
    </ul>
  </div>
  `).join("")}

  ${resume.education._tag === "Some" && resume.education.value.length > 0 ? `
  <h2>Education</h2>
  ${resume.education.value.map((edu) => `
  <div class="education-item">
    <strong>${edu.institution}</strong><br>
    ${edu.degree}${edu.graduationDate._tag === "Some" ? ` | ${edu.graduationDate.value}` : ""}
  </div>
  `).join("")}
  ` : ""}

  ${resume.openSource._tag === "Some" && resume.openSource.value.length > 0 ? `
  <h2>Open Source</h2>
  <ul>
  ${resume.openSource.value.map((project) => `
    <li><strong>${project.url ? `<a href="${project.url}">${project.name}</a>` : project.name}</strong>: ${project.description}</li>
  `).join("")}
  </ul>
  ` : ""}
</body>
</html>`
}
