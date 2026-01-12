import { Layer } from "effect"
import { BunContext } from "@effect/platform-bun"
import {
  Config,
  ResumeRepo,
  Exporter,
  PdfRenderer,
  DocxRenderer,
  JobAnalyzer,
  Preview,
} from "../services/index.ts"

// Config layer (base)
const ConfigLive = Config.layer

// Core services
const CoreServicesLive = Layer.mergeAll(
  ResumeRepo.layer,
  Exporter.layer,
  PdfRenderer.layer,
  DocxRenderer.layer,
  JobAnalyzer.layer,
  Preview.layer
)

// Full application layer - BunContext.layer includes HttpClient
export const AppLive = Layer.mergeAll(
  ConfigLive,
  CoreServicesLive
).pipe(Layer.provideMerge(BunContext.layer))
