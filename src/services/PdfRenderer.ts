import { Context, Effect, Layer } from "effect"
import { FileSystem } from "@effect/platform"
import { renderToBuffer } from "@react-pdf/renderer"
import type { DocumentProps } from "@react-pdf/renderer"
import React from "react"
import type { Resume } from "../schema/Resume.ts"
import { RenderError } from "./errors.ts"
import { templates, getTemplate, getDefaultTemplate, type PdfTemplate } from "../templates/index.ts"

export interface PdfRendererService {
  readonly render: (
    resume: Resume,
    templateName?: string
  ) => Effect.Effect<Uint8Array, RenderError>

  readonly renderToFile: (
    resume: Resume,
    path: string,
    templateName?: string
  ) => Effect.Effect<void, RenderError, FileSystem.FileSystem>

  readonly getAvailableTemplates: () => Effect.Effect<PdfTemplate[]>
}

// Implementation function - called directly within the service
const renderImpl = async (resume: Resume, templateName?: string): Promise<Uint8Array> => {
  const template = templateName
    ? getTemplate(templateName) ?? getDefaultTemplate()
    : getDefaultTemplate()

  const element = React.createElement(template.component, { resume })
  const buffer = await renderToBuffer(element as React.ReactElement<DocumentProps>)
  return new Uint8Array(buffer)
}

export class PdfRenderer extends Context.Tag("@app/PdfRenderer")<
  PdfRenderer,
  PdfRendererService
>() {
  static readonly layer = Layer.succeed(PdfRenderer, PdfRenderer.of({
    render: (resume, templateName) =>
      Effect.tryPromise({
        try: () => renderImpl(resume, templateName),
        catch: (error) => new RenderError({ cause: error }),
      }),

    renderToFile: (resume, path, templateName) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem

        const buffer = yield* Effect.tryPromise({
          try: () => renderImpl(resume, templateName),
          catch: (error) => new RenderError({ cause: error }),
        })
        yield* fs.writeFile(path, buffer).pipe(
          Effect.mapError((cause) => new RenderError({ cause }))
        )
      }),

    getAvailableTemplates: () =>
      Effect.succeed(Array.from(templates.values())),
  }))

  static readonly test = () =>
    Layer.succeed(PdfRenderer, PdfRenderer.of({
      render: () => Effect.succeed(new Uint8Array([0x25, 0x50, 0x44, 0x46])), // %PDF
      renderToFile: () => Effect.void,
      getAvailableTemplates: () => Effect.succeed([]),
    }))
}
