# Resume CLI

[![CI](https://github.com/cevr/resume/actions/workflows/ci.yml/badge.svg)](https://github.com/cevr/resume/actions/workflows/ci.yml)

A CLI tool for managing, tailoring, and exporting resumes optimized for ATS (Applicant Tracking Systems). Built with [Effect](https://effect.website/) and [Bun](https://bun.sh/).

## Features

- **Multiple Export Formats**: PDF, DOCX, Plain Text, JSON
- **ATS Optimization**: Keyword analysis, format validation, match scoring
- **Job Tracking**: Save and manage job descriptions for analysis
- **Resume Variants**: Create and manage tailored resume versions
- **Search**: Find content across your resume by keyword
- **Preview**: Terminal, browser, and PDF preview modes
- **Validation**: Structure checks and ATS compatibility warnings

## Installation

```bash
# Clone and install dependencies
git clone https://github.com/cevr/resume.git
cd resume
bun install

# Run directly
bun run dev -- <command>

# Or build and install globally
bun run build
bun run install:global
```

## Commands

### Core Commands

```bash
# Initialize a new resume from template
resume init

# Show resume statistics
resume stats

# Search for terms in resume
resume search <term>

# Validate structure and ATS compatibility
resume validate
resume validate --strict  # Additional checks

# Preview resume
resume preview           # Terminal output
resume preview --browser # Open in browser
resume preview --pdf     # Open as PDF
```

### Export

```bash
# Export to specific format
resume export -f pdf
resume export -f docx
resume export -f txt
resume export -f json

# Export all formats at once
resume export --all

# Custom output path
resume export -f pdf -o ./my-resume.pdf
```

### Job Analysis

```bash
# Analyze resume against a job posting
resume analyze --job-url https://example.com/job
resume analyze --job-file job.txt
resume analyze --job saved-job-name

# Track job descriptions
resume jobs add https://example.com/job --name company-role
resume jobs add ./job.txt --name startup-swe
resume jobs list
resume jobs remove company-role
```

### Resume Variants

```bash
# Generate tailored variant for a job
resume tailor --job-url https://example.com/job --name company-role
resume tailor --job-file job.txt --name startup-variant

# Manage variants
resume variants list
resume variants diff company-role  # Compare to master
resume variants remove old-variant
```

## Resume Format

Resumes are stored as Markdown with YAML frontmatter in `data/resume.md`:

```yaml
---
meta:
  version: "1.0"
  lastUpdated: "2025-01-12"
  target: "Senior Software Engineer"

contact:
  name: "Your Name"
  email: "email@example.com"
  phone: "+1-555-555-5555"
  linkedin: "username"
  github: "username"

summary:
  default: |
    Professional summary here...

skills:
  frontend: [React, TypeScript, Next.js]
  backend: [Node.js, GraphQL, PostgreSQL]
  infrastructure: [Docker, Kubernetes, AWS]
  languages: [TypeScript, Python, Go]

experience:
  - company: "Company Name"
    title: "Senior Software Engineer"
    location: "Remote"
    startDate: "2022-01"
    endDate: "present"
    highlights:
      - text: "Led migration to microservices, reducing latency by 40%"
        keywords: [architecture, microservices, performance]
        quantified: true
      - text: "Mentored 5 engineers across 2 teams"
        keywords: [leadership, mentorship]
        quantified: true
    technologies: [TypeScript, React, Node.js, PostgreSQL]

education:
  - institution: "University Name"
    degree: "B.S. Computer Science"
    graduationDate: "2019-05"

openSource:
  - name: "project-name"
    url: "https://github.com/user/project"
    description: "Description of the project"
---
```

## Configuration

Set environment variables or create a `.env` file:

```bash
ANTHROPIC_API_KEY=your-api-key  # For AI features (optional)
RESUME_PATH=./data/resume.md    # Default resume location
OUTPUT_DIR=./output             # Export directory
DEFAULT_TEMPLATE=professional   # PDF template
```

## Development

```bash
# Run in development
bun run dev -- <command>

# Run tests
bun run test

# Run tests in watch mode
bun run test:watch

# Build binary
bun run build
```

## Testing

The project includes comprehensive workflow-based tests using `@effect/vitest`:

```bash
bun run test
```

90 tests covering all CLI commands:
- Command flow testing with mock layers
- Service call tracking and assertions
- Edge cases and error handling

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Effect System**: [Effect](https://effect.website/) for typed functional programming
- **CLI**: [@effect/cli](https://github.com/Effect-TS/effect/tree/main/packages/cli)
- **Testing**: [@effect/vitest](https://github.com/Effect-TS/effect/tree/main/packages/vitest)
- **PDF Generation**: [@react-pdf/renderer](https://react-pdf.org/)
- **DOCX Generation**: [docx](https://docx.js.org/)

## License

MIT
