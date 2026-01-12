---
name: resume
description: Help improve resume content for ATS optimization and hiring. Use when asked to improve resume, optimize for jobs, add metrics, strengthen bullet points, or prepare for applications.
allowed-tools: Read, Grep, Glob, Edit, Bash
---

# Resume Improvement Skill

Help the user improve their resume for maximum hirability and ATS (Applicant Tracking System) optimization.

## Resume Location

The master resume is at `data/resume.md` in YAML frontmatter format.

## CLI Tool Available

This project has a built-in CLI tool. Run commands with `bun run dev --` or use the global `resume` command:

```bash
resume validate          # Check structure and ATS issues
resume preview           # Terminal preview
resume analyze --job-url <url>  # Match against job posting
resume export -f pdf     # Export to PDF
```

## Improvement Guidelines

### 1. Quantify Achievements

Every bullet point should include metrics where possible:

**Weak:**
- Led infrastructure modularization

**Strong:**
- Led infrastructure modularization reducing deployment time by 60% and enabling 3 teams to deploy independently

**Patterns to look for:**
- "Improved X" → Add percentage or absolute numbers
- "Led team" → Add team size and scope
- "Built feature" → Add user impact or business outcome
- "Reduced/Increased" → Always add specific metrics

### 2. Strong Action Verbs

Use impactful verbs appropriate for the level:

**Staff/Lead Level Verbs:**
- Architected, Spearheaded, Pioneered, Orchestrated
- Established, Championed, Drove, Directed
- Mentored, Influenced, Transformed

**Avoid:**
- Helped, Assisted, Worked on, Was responsible for

### 3. ATS Optimization

**Keywords to include for Staff Product Engineering:**
- Technical: architecture, scalable, distributed, performance, microservices
- Leadership: mentorship, cross-functional, stakeholder, strategy, roadmap
- Process: agile, CI/CD, DevOps, testing, code review
- Impact: revenue, growth, efficiency, cost reduction

**Format rules:**
- Use standard section headers (Experience, Skills, Education)
- Avoid tables, columns, graphics
- Spell out acronyms at least once
- Use consistent date formats (YYYY-MM or Month YYYY)

### 4. Staff/Lead Level Positioning

Emphasize:
- System-wide impact, not just feature work
- Cross-team collaboration and influence
- Technical decision-making and architecture
- Mentorship and team growth
- Business outcomes tied to technical work

### 5. Skills Organization

Group skills by category:
- Frontend: React, TypeScript, Next.js, etc.
- Backend: Node.js, GraphQL, databases
- Infrastructure: Docker, Kubernetes, CI/CD
- Leadership: System Design, Technical Strategy

## When Analyzing Job Postings

1. Extract key requirements and keywords
2. Compare against current resume
3. Identify gaps in:
   - Missing technical skills
   - Missing soft skills/leadership indicators
   - Experience level alignment
4. Suggest specific changes to highlight relevant experience

## Resume Schema Reference

The resume uses this structure in `data/resume.md`:

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
    endDate: "present" or "YYYY-MM"
    highlights:
      - text: "Achievement description"
        keywords: [relevant, keywords]
        quantified: true/false
```

## Improvement Workflow

1. **Read current resume**: `Read data/resume.md`
2. **Validate structure**: `resume validate --strict`
3. **Identify weak points**: Look for unquantified achievements, weak verbs
4. **Suggest improvements**: Provide before/after examples
5. **Apply changes**: Use Edit tool to update `data/resume.md`
6. **Verify**: Run `resume preview` to check formatting

## Additional Resources

- For ATS keyword reference, see [ats-keywords.md](ats-keywords.md)
- For bullet point improvement examples, see [bullet-examples.md](bullet-examples.md)

## Common Improvements for This Resume

Based on initial analysis:

1. **Add metrics to these roles:**
   - Bite: "Led infrastructure modularization" - add deployment frequency improvement
   - Glossi: "Managed deadlines" - add project count or team size
   - Turbulent: "Managed sprints" - add velocity improvement or team size

2. **Strengthen leadership narrative:**
   - Add team sizes managed
   - Quantify mentorship impact
   - Highlight cross-functional work

3. **Update skills:**
   - Add: Effect, Bun (modern tools being used)
   - Consider adding: System Design, Technical Leadership
