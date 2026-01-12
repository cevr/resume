import { Option } from "effect"
import {
  Resume,
  Contact,
  Skills,
  Experience,
  Highlight,
  Summary,
  Meta,
  Education,
  OpenSourceProject,
} from "../../src/schema/Resume.ts"

/**
 * Mock resume for testing
 */
export const mockResume = Resume.make({
  meta: Option.some(
    Meta.make({
      version: Option.some("1.0.0"),
      lastUpdated: Option.some("2025-01-12"),
      target: Option.some("Senior Software Engineer"),
    })
  ),
  contact: Contact.make({
    name: "Test User",
    email: "test@example.com",
    phone: Option.some("+1-555-0123"),
    location: Option.some("San Francisco, CA"),
    linkedin: Option.some("linkedin.com/in/testuser"),
    github: Option.some("github.com/testuser"),
    website: Option.none(),
    twitter: Option.none(),
  }),
  summary: Option.some(
    Summary.make({
      default: "Experienced software engineer with 5+ years building scalable web applications.",
      variants: Option.none(),
    })
  ),
  skills: Skills.make({
    frontend: Option.some(["React", "TypeScript", "CSS"]),
    backend: Option.some(["Node.js", "PostgreSQL", "Redis"]),
    infrastructure: Option.some(["AWS", "Docker", "Kubernetes"]),
    languages: Option.some(["TypeScript", "Python", "Go"]),
    leadership: Option.some(["Mentoring", "Code Review"]),
    tools: Option.some(["Git", "VS Code"]),
  }),
  experience: [
    Experience.make({
      company: "TechCorp",
      title: "Senior Software Engineer",
      location: Option.some("San Francisco, CA"),
      startDate: "2022-01",
      endDate: "Present",
      highlights: [
        Highlight.make({
          text: "Led migration of legacy monolith to microservices, reducing deployment time by 80%",
          keywords: Option.some(["microservices", "migration", "architecture"]),
          quantified: Option.some(true),
          priority: Option.some(1),
        }),
        Highlight.make({
          text: "Mentored 3 junior engineers through onboarding and technical growth",
          keywords: Option.some(["mentoring", "leadership"]),
          quantified: Option.some(true),
          priority: Option.some(2),
        }),
        Highlight.make({
          text: "Implemented CI/CD pipeline using GitHub Actions",
          keywords: Option.some(["CI/CD", "automation"]),
          quantified: Option.none(),
          priority: Option.none(),
        }),
      ],
      technologies: Option.some(["TypeScript", "React", "Node.js", "PostgreSQL"]),
    }),
    Experience.make({
      company: "StartupXYZ",
      title: "Software Engineer",
      location: Option.some("Remote"),
      startDate: "2020-03",
      endDate: "2021-12",
      highlights: [
        Highlight.make({
          text: "Built real-time collaboration features serving 10K daily active users",
          keywords: Option.some(["real-time", "collaboration", "performance"]),
          quantified: Option.some(true),
          priority: Option.some(1),
        }),
        Highlight.make({
          text: "Improved API response time by 60% through query optimization",
          keywords: Option.some(["performance", "optimization", "API"]),
          quantified: Option.some(true),
          priority: Option.some(2),
        }),
      ],
      technologies: Option.some(["Python", "Django", "Redis", "AWS"]),
    }),
  ],
  education: Option.some([
    Education.make({
      institution: "University of Technology",
      degree: "B.S. Computer Science",
      graduationDate: Option.some("2020"),
      honors: Option.some("Magna Cum Laude"),
      gpa: Option.some("3.8"),
    }),
  ]),
  certifications: Option.none(),
  projects: Option.none(),
  openSource: Option.some([
    OpenSourceProject.make({
      name: "cool-library",
      url: Option.some("https://github.com/testuser/cool-library"),
      description: "A useful utility library with 500+ stars",
      keywords: Option.some(["open source", "utilities"]),
      quantified: Option.some(true),
    }),
  ]),
})

/**
 * Minimal resume for edge case testing
 */
export const minimalResume = Resume.make({
  meta: Option.none(),
  contact: Contact.make({
    name: "Minimal User",
    email: "minimal@example.com",
    phone: Option.none(),
    location: Option.none(),
    linkedin: Option.none(),
    github: Option.none(),
    website: Option.none(),
    twitter: Option.none(),
  }),
  summary: Option.none(),
  skills: Skills.make({
    frontend: Option.none(),
    backend: Option.none(),
    infrastructure: Option.none(),
    languages: Option.none(),
    leadership: Option.none(),
    tools: Option.none(),
  }),
  experience: [],
  education: Option.none(),
  certifications: Option.none(),
  projects: Option.none(),
  openSource: Option.none(),
})

/**
 * Mock job description text
 */
export const mockJobDescription = `
Senior Software Engineer - TechCompany

About the Role:
We're looking for a Senior Software Engineer to join our platform team.

Requirements:
- 5+ years of experience with TypeScript and React
- Experience with microservices architecture
- Strong knowledge of PostgreSQL and Redis
- Kubernetes and Docker experience
- Excellent communication skills

Responsibilities:
- Design and implement scalable APIs
- Lead technical discussions and code reviews
- Mentor junior engineers
- Collaborate with product and design teams
`
