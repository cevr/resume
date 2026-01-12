import { Schema } from "effect"

// Contact Schema
export class Contact extends Schema.Class<Contact>("Contact")({
  name: Schema.String,
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  phone: Schema.optionalWith(Schema.String, { as: "Option" }),
  location: Schema.optionalWith(Schema.String, { as: "Option" }),
  linkedin: Schema.optionalWith(Schema.String, { as: "Option" }),
  github: Schema.optionalWith(Schema.String, { as: "Option" }),
  website: Schema.optionalWith(Schema.String, { as: "Option" }),
  twitter: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}

// Skills by category
export class Skills extends Schema.Class<Skills>("Skills")({
  frontend: Schema.optionalWith(Schema.Array(Schema.String), { as: "Option" }),
  backend: Schema.optionalWith(Schema.Array(Schema.String), { as: "Option" }),
  infrastructure: Schema.optionalWith(Schema.Array(Schema.String), { as: "Option" }),
  languages: Schema.optionalWith(Schema.Array(Schema.String), { as: "Option" }),
  leadership: Schema.optionalWith(Schema.Array(Schema.String), { as: "Option" }),
  tools: Schema.optionalWith(Schema.Array(Schema.String), { as: "Option" }),
}) {}

// Experience highlight with keywords for tailoring
export class Highlight extends Schema.Class<Highlight>("Highlight")({
  text: Schema.String,
  keywords: Schema.optionalWith(Schema.Array(Schema.String), { as: "Option" }),
  quantified: Schema.optionalWith(Schema.Boolean, { as: "Option" }),
  priority: Schema.optionalWith(Schema.Number, { as: "Option" }),
}) {}

// Work experience entry
export class Experience extends Schema.Class<Experience>("Experience")({
  company: Schema.String,
  title: Schema.String,
  location: Schema.optionalWith(Schema.String, { as: "Option" }),
  startDate: Schema.String,
  endDate: Schema.String,
  highlights: Schema.Array(Highlight),
  technologies: Schema.optionalWith(Schema.Array(Schema.String), { as: "Option" }),
}) {}

// Education entry
export class Education extends Schema.Class<Education>("Education")({
  institution: Schema.String,
  degree: Schema.String,
  graduationDate: Schema.optionalWith(Schema.String, { as: "Option" }),
  honors: Schema.optionalWith(Schema.String, { as: "Option" }),
  gpa: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}

// Certification
export class Certification extends Schema.Class<Certification>("Certification")({
  name: Schema.String,
  issuer: Schema.String,
  date: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}

// Project
export class Project extends Schema.Class<Project>("Project")({
  name: Schema.String,
  description: Schema.String,
  url: Schema.optionalWith(Schema.String, { as: "Option" }),
  highlights: Schema.optionalWith(Schema.Array(Schema.String), { as: "Option" }),
}) {}

// Open Source contribution
export class OpenSourceProject extends Schema.Class<OpenSourceProject>("OpenSourceProject")({
  name: Schema.String,
  url: Schema.optionalWith(Schema.String, { as: "Option" }),
  description: Schema.String,
  keywords: Schema.optionalWith(Schema.Array(Schema.String), { as: "Option" }),
  quantified: Schema.optionalWith(Schema.Boolean, { as: "Option" }),
}) {}

// Summary with variants for tailoring
export class Summary extends Schema.Class<Summary>("Summary")({
  default: Schema.String,
  variants: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.String }),
    { as: "Option" }
  ),
}) {}

// Resume metadata
export class Meta extends Schema.Class<Meta>("Meta")({
  version: Schema.optionalWith(Schema.String, { as: "Option" }),
  lastUpdated: Schema.optionalWith(Schema.String, { as: "Option" }),
  target: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}

// Full Resume
export class Resume extends Schema.Class<Resume>("Resume")({
  meta: Schema.optionalWith(Meta, { as: "Option" }),
  contact: Contact,
  summary: Schema.optionalWith(Summary, { as: "Option" }),
  skills: Skills,
  experience: Schema.Array(Experience),
  education: Schema.optionalWith(Schema.Array(Education), { as: "Option" }),
  certifications: Schema.optionalWith(Schema.Array(Certification), { as: "Option" }),
  projects: Schema.optionalWith(Schema.Array(Project), { as: "Option" }),
  openSource: Schema.optionalWith(Schema.Array(OpenSourceProject), { as: "Option" }),
}) {}
