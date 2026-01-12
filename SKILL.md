---
name: resume
description: Help improve resume content for ATS optimization and hiring. Use when asked to improve resume, optimize for jobs, add metrics, strengthen bullet points, or prepare for applications.
allowed-tools: Read, Grep, Glob, Edit, Bash
---

# Resume CLI Skill

This skill covers two areas:
1. **Resume Content Improvement** - Optimizing resume content for ATS and hiring
2. **Codebase Development** - Working on the Resume CLI tool itself

## Quick Start

```bash
# Development
bun run dev -- <command>

# Run tests
bun run test

# Build
bun run build
```

## Resume Location

The master resume is at `data/resume.md` in YAML frontmatter format.

## CLI Commands

| Command | Description |
|---------|-------------|
| `init` | Create resume from template |
| `stats` | Show resume statistics |
| `search <term>` | Search resume content |
| `validate [--strict]` | Check structure/ATS compatibility |
| `preview [--browser\|--pdf]` | Preview resume |
| `export -f <format>` | Export to PDF/DOCX/TXT/JSON |
| `export --all` | Export all formats |
| `analyze --job-url <url>` | Match against job posting |
| `analyze --job <name>` | Match against saved job |
| `tailor --job-url <url> --name <name>` | Generate variant |
| `jobs add\|list\|remove` | Manage saved jobs |
| `variants list\|diff\|remove` | Manage variants |

---

## Part 1: Resume Content Improvement

### Quantify Achievements

Every bullet point should include metrics:

**Weak:** Led infrastructure modularization

**Strong:** Led infrastructure modularization reducing deployment time by 60% and enabling 3 teams to deploy independently

### Strong Action Verbs

**Staff/Lead Level:** Architected, Spearheaded, Pioneered, Orchestrated, Established, Championed, Drove, Mentored, Influenced, Transformed

**Avoid:** Helped, Assisted, Worked on, Was responsible for

### ATS Keywords for Staff Product Engineering

- **Technical:** architecture, scalable, distributed, performance, microservices
- **Leadership:** mentorship, cross-functional, stakeholder, strategy, roadmap
- **Process:** agile, CI/CD, DevOps, testing, code review
- **Impact:** revenue, growth, efficiency, cost reduction

### Resume Schema

```yaml
contact:
  name, email, website, github, linkedin

summary:
  default: "Professional summary text"

skills:
  frontend: [...]
  backend: [...]
  infrastructure: [...]
  languages: [...]

experience:
  - company: "Company Name"
    title: "Job Title"
    startDate: "YYYY-MM"
    endDate: "present"
    highlights:
      - text: "Achievement description"
        keywords: [relevant, keywords]
        quantified: true/false
    technologies: [...]
```

### Improvement Workflow

1. Read current resume: `Read data/resume.md`
2. Validate: `bun run dev -- validate --strict`
3. Identify weak points (unquantified achievements, weak verbs)
4. Suggest improvements with before/after examples
5. Apply changes with Edit tool
6. Verify: `bun run dev -- preview`

---

## Part 2: Codebase Development

### Architecture

```
src/
├── cli/commands/     # CLI command handlers
├── schema/           # Effect Schema definitions
├── services/         # Effect services with Layer pattern
└── layers/App.ts     # Composed application layer

tests/
├── commands/         # Workflow-based command tests
└── helpers/          # Test fixtures and layers
```

### Effect Patterns

**Services** use `Context.Tag` with `layer` and `test()`:

```typescript
export class MyService extends Context.Tag("@app/MyService")<
  MyService,
  MyServiceInterface
>() {
  static readonly layer = Layer.succeed(MyService, MyService.of({...}))
  static readonly test = () => Layer.succeed(MyService, MyService.of({...}))
}
```

**Tests** use `@effect/vitest`:

```typescript
it.effect("description", () =>
  Effect.gen(function* () {
    const result = yield* someEffect
    expect(result).toBe(expected)
  }).pipe(Effect.provide(TestLayer))
)
```

### Services

| Service | Purpose |
|---------|---------|
| `Config` | App configuration from env |
| `ResumeRepo` | Load/save resume files |
| `Exporter` | JSON/Text export |
| `PdfRenderer` | PDF generation |
| `DocxRenderer` | DOCX generation |
| `JobAnalyzer` | Job matching/analysis |
| `Preview` | Terminal/browser preview |

### Testing

90 tests across 10 files using workflow-based testing:
- Extract command logic into testable functions
- Use mock layers for services
- Track service calls with Ref
- Assert on outputs and side effects

```bash
bun run test                    # Run all tests
bun run test -- <file>          # Run specific file
bun run test:watch              # Watch mode
```
