import { Layer } from "effect"
import { BunContext } from "@effect/platform-bun"
import {
  Config,
  ResumeRepo,
  Exporter,
  PdfRenderer,
  DocxRenderer,
  AIAssistant,
  JobAnalyzer,
  Preview,
} from "../services/index.ts"

// Config layer (base)
const ConfigLive = Config.layer

// Services that don't depend on Config
const CoreServicesLive = Layer.mergeAll(
  ResumeRepo.layer,
  Exporter.layer,
  PdfRenderer.layer,
  DocxRenderer.layer,
  JobAnalyzer.layer,
  Preview.layer
)

// AI service depends on Config
const AILive = AIAssistant.layer.pipe(Layer.provide(ConfigLive))

// Full application layer - BunContext.layer includes HttpClient
export const AppLive = Layer.mergeAll(
  ConfigLive,
  CoreServicesLive,
  AILive
).pipe(Layer.provideMerge(BunContext.layer))
