import { Context, Effect, Layer, Option } from "effect"
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

// Implementation function - called directly within the service
const renderImpl = async (resume: Resume): Promise<Uint8Array> => {
  const doc = createDocument(resume)
  const buffer = await Packer.toBuffer(doc)
  return new Uint8Array(buffer)
}

export class DocxRenderer extends Context.Tag("@app/DocxRenderer")<
  DocxRenderer,
  DocxRendererService
>() {
  static readonly layer = Layer.succeed(DocxRenderer, DocxRenderer.of({
    render: (resume) =>
      Effect.tryPromise({
        try: () => renderImpl(resume),
        catch: (error) => new RenderError({ cause: error }),
      }),

    renderToFile: (resume, path) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem

        const buffer = yield* Effect.tryPromise({
          try: () => renderImpl(resume),
          catch: (error) => new RenderError({ cause: error }),
        })
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

  // Contact info - collect all present optional fields
  const contactParts = [
    resume.contact.email,
    ...Option.getOrElse(Option.map(resume.contact.phone, (v) => [v]), () => []),
    ...Option.getOrElse(Option.map(resume.contact.website, (v) => [v]), () => []),
    ...Option.getOrElse(Option.map(resume.contact.linkedin, (v) => [v]), () => []),
    ...Option.getOrElse(Option.map(resume.contact.github, (v) => [v]), () => []),
  ]

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
  Option.match(resume.summary, {
    onNone: () => {},
    onSome: (summary) => {
      children.push(createSectionHeader("PROFESSIONAL SUMMARY"))
      children.push(
        new Paragraph({
          children: [new TextRun({ text: summary.default, size: 22 })],
          spacing: { after: 200 },
        })
      )
    },
  })

  // Skills - collect all present skill categories
  const skillParagraphs = [
    Option.map(resume.skills.frontend, (s) => createSkillLine("Frontend", s)),
    Option.map(resume.skills.backend, (s) => createSkillLine("Backend", s)),
    Option.map(resume.skills.infrastructure, (s) => createSkillLine("Infrastructure", s)),
    Option.map(resume.skills.languages, (s) => createSkillLine("Languages", s)),
  ].filter(Option.isSome).map((o) => o.value)

  if (skillParagraphs.length > 0) {
    children.push(createSectionHeader("SKILLS"))
    children.push(...skillParagraphs)
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
    const location = Option.getOrElse(Option.map(exp.location, (l) => ` | ${l}`), () => "")
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${exp.startDate} - ${exp.endDate}${location}`,
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
  Option.match(resume.education, {
    onNone: () => {},
    onSome: (education) => {
      if (education.length > 0) {
        children.push(createSectionHeader("EDUCATION"))
        for (const edu of education) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: edu.institution, bold: true, size: 24 }),
              ],
            })
          )
          const gradDate = Option.getOrElse(Option.map(edu.graduationDate, (d) => ` | ${d}`), () => "")
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${edu.degree}${gradDate}`,
                  size: 22,
                }),
              ],
              spacing: { after: 100 },
            })
          )
        }
      }
    },
  })

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
