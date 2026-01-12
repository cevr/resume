import { Schema } from "effect"

// Parsed job description
export class JobDescription extends Schema.Class<JobDescription>("JobDescription")({
  title: Schema.optionalWith(Schema.String, { as: "Option" }),
  company: Schema.optionalWith(Schema.String, { as: "Option" }),
  requirements: Schema.Array(Schema.String),
  responsibilities: Schema.Array(Schema.String),
  keywords: Schema.Array(Schema.String),
  rawText: Schema.String,
}) {}
