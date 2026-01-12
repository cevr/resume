import React from "react"
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
} from "@react-pdf/renderer"
import type { Resume } from "../schema/Resume.ts"

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    lineHeight: 1.4,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  contact: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    color: "#666",
    fontSize: 9,
  },
  contactItem: {
    marginRight: 8,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    fontFamily: "Helvetica-Bold",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingBottom: 3,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summary: {
    fontSize: 10,
    color: "#333",
    lineHeight: 1.5,
  },
  experienceItem: {
    marginBottom: 10,
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  jobTitle: {
    fontWeight: "bold",
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  company: {
    color: "#444",
  },
  dateLocation: {
    fontSize: 9,
    color: "#666",
    marginBottom: 4,
  },
  bullet: {
    flexDirection: "row",
    marginLeft: 8,
    marginBottom: 2,
  },
  bulletPoint: {
    width: 10,
    color: "#666",
  },
  bulletText: {
    flex: 1,
    color: "#333",
  },
  skillCategory: {
    flexDirection: "row",
    marginBottom: 3,
  },
  skillLabel: {
    fontWeight: "bold",
    fontFamily: "Helvetica-Bold",
    width: 80,
    color: "#444",
  },
  skillList: {
    flex: 1,
    color: "#333",
  },
  educationItem: {
    marginBottom: 6,
  },
  institution: {
    fontWeight: "bold",
    fontFamily: "Helvetica-Bold",
  },
  degree: {
    color: "#333",
  },
  link: {
    color: "#0066cc",
    textDecoration: "none",
  },
})

interface Props {
  resume: Resume
}

export const ProfessionalTemplate: React.FC<Props> = ({ resume }) => (
  <Document>
    <Page size="LETTER" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.name}>{resume.contact.name}</Text>
        <View style={styles.contact}>
          <Text style={styles.contactItem}>{resume.contact.email}</Text>
          {resume.contact.phone._tag === "Some" && (
            <Text style={styles.contactItem}>| {resume.contact.phone.value}</Text>
          )}
          {resume.contact.location._tag === "Some" && (
            <Text style={styles.contactItem}>| {resume.contact.location.value}</Text>
          )}
          {resume.contact.website._tag === "Some" && (
            <Link style={[styles.contactItem, styles.link]} src={`https://${resume.contact.website.value}`}>
              | {resume.contact.website.value}
            </Link>
          )}
          {resume.contact.linkedin._tag === "Some" && (
            <Link style={[styles.contactItem, styles.link]} src={`https://linkedin.com/in/${resume.contact.linkedin.value}`}>
              | LinkedIn
            </Link>
          )}
          {resume.contact.github._tag === "Some" && (
            <Link style={[styles.contactItem, styles.link]} src={`https://github.com/${resume.contact.github.value}`}>
              | GitHub
            </Link>
          )}
        </View>
      </View>

      {/* Summary */}
      {resume.summary._tag === "Some" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Professional Summary</Text>
          <Text style={styles.summary}>{resume.summary.value.default}</Text>
        </View>
      )}

      {/* Skills */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Skills</Text>
        {resume.skills.frontend._tag === "Some" && (
          <View style={styles.skillCategory}>
            <Text style={styles.skillLabel}>Frontend:</Text>
            <Text style={styles.skillList}>{resume.skills.frontend.value.join(", ")}</Text>
          </View>
        )}
        {resume.skills.backend._tag === "Some" && (
          <View style={styles.skillCategory}>
            <Text style={styles.skillLabel}>Backend:</Text>
            <Text style={styles.skillList}>{resume.skills.backend.value.join(", ")}</Text>
          </View>
        )}
        {resume.skills.infrastructure._tag === "Some" && (
          <View style={styles.skillCategory}>
            <Text style={styles.skillLabel}>Infrastructure:</Text>
            <Text style={styles.skillList}>{resume.skills.infrastructure.value.join(", ")}</Text>
          </View>
        )}
        {resume.skills.languages._tag === "Some" && (
          <View style={styles.skillCategory}>
            <Text style={styles.skillLabel}>Languages:</Text>
            <Text style={styles.skillList}>{resume.skills.languages.value.join(", ")}</Text>
          </View>
        )}
        {resume.skills.leadership._tag === "Some" && (
          <View style={styles.skillCategory}>
            <Text style={styles.skillLabel}>Leadership:</Text>
            <Text style={styles.skillList}>{resume.skills.leadership.value.join(", ")}</Text>
          </View>
        )}
        {resume.skills.tools._tag === "Some" && (
          <View style={styles.skillCategory}>
            <Text style={styles.skillLabel}>Tools:</Text>
            <Text style={styles.skillList}>{resume.skills.tools.value.join(", ")}</Text>
          </View>
        )}
      </View>

      {/* Experience */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Experience</Text>
        {resume.experience.map((exp, i) => (
          <View key={i} style={styles.experienceItem}>
            <View style={styles.jobHeader}>
              <Text>
                <Text style={styles.jobTitle}>{exp.title}</Text>
                <Text style={styles.company}> | {exp.company}</Text>
              </Text>
            </View>
            <Text style={styles.dateLocation}>
              {exp.startDate} - {exp.endDate}
              {exp.location._tag === "Some" ? ` | ${exp.location.value}` : ""}
            </Text>
            {exp.highlights.map((h, j) => (
              <View key={j} style={styles.bullet}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.bulletText}>{h.text}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      {/* Education */}
      {resume.education._tag === "Some" && resume.education.value.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Education</Text>
          {resume.education.value.map((edu, i) => (
            <View key={i} style={styles.educationItem}>
              <Text style={styles.institution}>{edu.institution}</Text>
              <Text style={styles.degree}>
                {edu.degree}
                {edu.graduationDate._tag === "Some" ? ` | ${edu.graduationDate.value}` : ""}
              </Text>
              {edu.honors._tag === "Some" && (
                <Text style={styles.dateLocation}>{edu.honors.value}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Projects */}
      {resume.projects._tag === "Some" && resume.projects.value.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Projects</Text>
          {resume.projects.value.map((proj, i) => (
            <View key={i} style={styles.experienceItem}>
              <Text style={styles.jobTitle}>{proj.name}</Text>
              <Text style={styles.summary}>{proj.description}</Text>
              {proj.highlights._tag === "Some" && proj.highlights.value.map((h, j) => (
                <View key={j} style={styles.bullet}>
                  <Text style={styles.bulletPoint}>•</Text>
                  <Text style={styles.bulletText}>{h}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </Page>
  </Document>
)
