import { Schema } from "effect"

export class ResumeLoadError extends Schema.TaggedError<ResumeLoadError>()(
  "ResumeLoadError",
  {
    path: Schema.String,
    cause: Schema.Unknown,
  }
) {}

export class ResumeSaveError extends Schema.TaggedError<ResumeSaveError>()(
  "ResumeSaveError",
  {
    path: Schema.String,
    cause: Schema.Unknown,
  }
) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    errors: Schema.Array(Schema.String),
  }
) {}

export class ExportError extends Schema.TaggedError<ExportError>()(
  "ExportError",
  {
    format: Schema.String,
    cause: Schema.Unknown,
  }
) {}

export class AIError extends Schema.TaggedError<AIError>()(
  "AIError",
  {
    operation: Schema.String,
    cause: Schema.Unknown,
  }
) {}

export class FetchError extends Schema.TaggedError<FetchError>()(
  "FetchError",
  {
    url: Schema.String,
    cause: Schema.Unknown,
  }
) {}

export class ParseError extends Schema.TaggedError<ParseError>()(
  "ParseError",
  {
    message: Schema.String,
    cause: Schema.Unknown,
  }
) {}

export class RenderError extends Schema.TaggedError<RenderError>()(
  "RenderError",
  {
    cause: Schema.Unknown,
  }
) {}

export class PreviewError extends Schema.TaggedError<PreviewError>()(
  "PreviewError",
  {
    cause: Schema.Unknown,
  }
) {}
