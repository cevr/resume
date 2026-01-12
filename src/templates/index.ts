import React from "react"
import type { Resume } from "../schema/Resume.ts"
import { ProfessionalTemplate } from "./Professional.tsx"

export interface PdfTemplate {
  readonly name: string
  readonly component: React.FC<{ resume: Resume }>
}

export const templates: Map<string, PdfTemplate> = new Map([
  ["professional", { name: "professional", component: ProfessionalTemplate }],
])

export const getTemplate = (name: string): PdfTemplate | undefined =>
  templates.get(name)

export const getDefaultTemplate = (): PdfTemplate =>
  templates.get("professional")!

export { ProfessionalTemplate }
