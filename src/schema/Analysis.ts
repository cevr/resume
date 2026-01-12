import { Schema } from "effect"

// Section validation results
export class SectionValidation extends Schema.Class<SectionValidation>("SectionValidation")({
  hasContact: Schema.Boolean,
  hasSummary: Schema.Boolean,
  hasExperience: Schema.Boolean,
  hasEducation: Schema.Boolean,
  hasSkills: Schema.Boolean,
}) {}

// Full analysis result
export class AnalysisResult extends Schema.Class<AnalysisResult>("AnalysisResult")({
  matchScore: Schema.Number.pipe(Schema.between(0, 100)),
  matchedKeywords: Schema.Array(Schema.String),
  missingKeywords: Schema.Array(Schema.String),
  suggestedHighlights: Schema.Array(Schema.String),
  sectionValidation: SectionValidation,
  atsWarnings: Schema.Array(Schema.String),
}) {}

// Verb improvement suggestion
export class VerbSuggestion extends Schema.Class<VerbSuggestion>("VerbSuggestion")({
  original: Schema.String,
  improved: Schema.String,
  context: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}

// Keyword density report
export class KeywordDensityReport extends Schema.Class<KeywordDensityReport>("KeywordDensityReport")({
  keyword: Schema.String,
  count: Schema.Number,
  recommended: Schema.Number,
  status: Schema.Literal("low", "good", "high"),
}) {}
