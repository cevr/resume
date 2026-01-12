import { Context, Effect, Layer } from "effect"
import { FileSystem } from "@effect/platform"
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
  AlignmentType,
  BorderStyle,
} from "docx"
import type { Resume } from "../schema/Resume.ts"
import { RenderError } from "./errors.ts"

export interface DocxRendererService {
  readonly render: (resume: Resume) => Effect.Effect<Uint8Array, RenderError>

  readonly renderToFile: (
    resume: Resume,
    path: string
  ) => Effect.Effect<void, RenderError, FileSystem.FileSystem>
}

export class DocxRenderer extends Context.Tag("@app/DocxRenderer")<
  DocxRenderer,
  DocxRendererService
>() {
  static readonly layer = Layer.succeed(DocxRenderer, DocxRenderer.of({
    render: (resume) =>
      Effect.tryPromise({
        try: async () => {
          const doc = createDocument(resume)
          const buffer = await Packer.toBuffer(doc)
          return new Uint8Array(buffer)
        },
        catch: (error) => new RenderError({ cause: error }),
      }),

    renderToFile: (resume, path) =>
      Effect.gen(function* () {
        const renderer = yield* DocxRenderer
        const fs = yield* FileSystem.FileSystem

        const buffer = yield* renderer.render(resume)
        yield* fs.writeFile(path, buffer).pipe(
          Effect.mapError((cause) => new RenderError({ cause }))
        )
      }),
  }))

  static readonly test = () =>
    Layer.succeed(DocxRenderer, DocxRenderer.of({
      render: () => Effect.succeed(new Uint8Array([0x50, 0x4B])), // PK (zip signature)
      renderToFile: () => Effect.void,
    }))
}

function createDocument(resume: Resume): Document {
  const children: Paragraph[] = []

  // Name header
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: resume.contact.name,
          bold: true,
          size: 48,
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  )

  // Contact info
  const contactParts: string[] = [resume.contact.email]
  if (resume.contact.phone._tag === "Some") contactParts.push(resume.contact.phone.value)
  if (resume.contact.website._tag === "Some") contactParts.push(resume.contact.website.value)
  if (resume.contact.linkedin._tag === "Some") contactParts.push(resume.contact.linkedin.value)
  if (resume.contact.github._tag === "Some") contactParts.push(resume.contact.github.value)

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: contactParts.join(" | "),
          size: 20,
          color: "666666",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  )

  // Summary
  if (resume.summary._tag === "Some") {
    children.push(createSectionHeader("PROFESSIONAL SUMMARY"))
    children.push(
      new Paragraph({
        children: [new TextRun({ text: resume.summary.value.default, size: 22 })],
        spacing: { after: 200 },
      })
    )
  }

  // Skills
  children.push(createSectionHeader("SKILLS"))
  if (resume.skills.frontend._tag === "Some") {
    children.push(createSkillLine("Frontend", resume.skills.frontend.value))
  }
  if (resume.skills.backend._tag === "Some") {
    children.push(createSkillLine("Backend", resume.skills.backend.value))
  }
  if (resume.skills.infrastructure._tag === "Some") {
    children.push(createSkillLine("Infrastructure", resume.skills.infrastructure.value))
  }
  if (resume.skills.languages._tag === "Some") {
    children.push(createSkillLine("Languages", resume.skills.languages.value))
  }

  // Experience
  children.push(createSectionHeader("EXPERIENCE"))
  for (const exp of resume.experience) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: exp.title, bold: true, size: 24 }),
          new TextRun({ text: ` | ${exp.company}`, size: 24 }),
        ],
      })
    )
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${exp.startDate} - ${exp.endDate}${exp.location._tag === "Some" ? ` | ${exp.location.value}` : ""}`,
            size: 20,
            color: "666666",
          }),
        ],
        spacing: { after: 100 },
      })
    )
    for (const highlight of exp.highlights) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `• ${highlight.text}`, size: 22 })],
          indent: { left: 360 },
        })
      )
    }
    children.push(new Paragraph({ spacing: { after: 200 } }))
  }

  // Education
  if (resume.education._tag === "Some" && resume.education.value.length > 0) {
    children.push(createSectionHeader("EDUCATION"))
    for (const edu of resume.education.value) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: edu.institution, bold: true, size: 24 }),
          ],
        })
      )
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${edu.degree}${edu.graduationDate._tag === "Some" ? ` | ${edu.graduationDate.value}` : ""}`,
              size: 22,
            }),
          ],
          spacing: { after: 100 },
        })
      )
    }
  }

  return new Document({
    sections: [{ children }],
  })
}

function createSectionHeader(title: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 26,
      }),
    ],
    heading: HeadingLevel.HEADING_2,
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 6,
        color: "333333",
      },
    },
    spacing: { before: 200, after: 100 },
  })
}

function createSkillLine(label: string, skills: readonly string[]): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22 }),
      new TextRun({ text: skills.join(", "), size: 22 }),
    ],
    spacing: { after: 50 },
  })
}
