# Resume CLI

A CLI tool for managing, tailoring, and exporting resumes optimized for ATS (Applicant Tracking Systems). Built with [Effect](https://effect.website/) and [Bun](https://bun.sh/).

## Features

- **Multiple Export Formats**: PDF, DOCX, Plain Text, JSON
- **ATS Optimization**: Keyword analysis, format validation, match scoring
- **Job Tailoring**: Generate job-specific resume variants
- **AI-Powered Improvements**: Quantify achievements, improve action verbs, keyword density analysis (requires Anthropic API key)
- **Preview**: Terminal and browser preview

## Installation

```bash
# Clone and install dependencies
git clone https://github.com/cevr/resume.git
cd resume
bun install

# Build and install globally
bun run install:global
```

## Usage

```bash
# Initialize a new resume
resume init

# Validate structure and ATS compatibility
resume validate

# Preview in terminal
resume preview

# Preview in browser
resume preview --browser

# Export to various formats
resume export -f pdf
resume export -f docx
resume export -f json
resume export -f txt

# Analyze against a job posting
resume analyze --job-url https://example.com/job
resume analyze --job-file job.txt

# Generate tailored variant
resume tailor --job-url https://example.com/job --name company-role

# AI-powered improvements (requires ANTHROPIC_API_KEY)
resume improve quantify   # Suggest metrics for achievements
resume improve verbs      # Improve action verbs
resume improve keywords   # Analyze keyword density
```

## Resume Format

Resumes are stored as Markdown with YAML frontmatter in `data/resume.md`:

```yaml
---
contact:
  name: "Your Name"
  email: "email@example.com"
  github: "username"
  linkedin: "username"

summary:
  default: |
    Professional summary here...

skills:
  frontend: [React, TypeScript, Next.js]
  backend: [Node.js, GraphQL, PostgreSQL]
  infrastructure: [Docker, Kubernetes, CI/CD]

experience:
  - company: "Company Name"
    title: "Job Title"
    startDate: "2022-01"
    endDate: "present"
    highlights:
      - text: "Achievement with metrics"
        keywords: [relevant, keywords]
        quantified: true
---
```

## Configuration

Set environment variables or create a `.env` file:

```bash
ANTHROPIC_API_KEY=your-api-key  # For AI features
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

# Build binary
bun run build
```

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Effect System**: [Effect](https://effect.website/) for typed functional programming
- **CLI**: [@effect/cli](https://github.com/Effect-TS/effect/tree/main/packages/cli)
- **PDF Generation**: [@react-pdf/renderer](https://react-pdf.org/)
- **DOCX Generation**: [docx](https://docx.js.org/)
- **AI**: [Vercel AI SDK](https://sdk.vercel.ai/) with Anthropic

## License

MIT
