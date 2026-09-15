import { describe, expect, it } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  emitGitHubAnnotations,
  generateMarkdownSummary,
  isHumanReadableText,
  scanCodebase,
  scanSourceFile,
  type ScanReport,
} from "./scan-i18n"

describe("i18n Scanner", () => {
  describe("isHumanReadableText", () => {
    it("recognizes natural human text in JSX text context", () => {
      expect(isHumanReadableText("Welcome to Dashboard", "jsx_text")).toBe(true)
      expect(isHumanReadableText("Save changes", "jsx_text")).toBe(true)
      expect(isHumanReadableText("Apakah anda yakin?", "jsx_text")).toBe(true)
    })

    it("ignores whitespace, numbers, symbols, and HTML entities", () => {
      expect(isHumanReadableText("   ", "jsx_text")).toBe(false)
      expect(isHumanReadableText("12345", "jsx_text")).toBe(false)
      expect(isHumanReadableText("100%", "jsx_text")).toBe(false)
      expect(isHumanReadableText("&mdash;", "jsx_text")).toBe(false)
      expect(isHumanReadableText("...", "jsx_text")).toBe(false)
      expect(isHumanReadableText("->", "jsx_text")).toBe(false)
    })

    it("ignores technical acronyms and brands", () => {
      expect(isHumanReadableText("WhatsApp", "jsx_text")).toBe(false)
      expect(isHumanReadableText("API", "jsx_text")).toBe(false)
      expect(isHumanReadableText("JSON", "jsx_text")).toBe(false)
      expect(isHumanReadableText("USD", "jsx_text")).toBe(false)
      expect(isHumanReadableText("IDR", "jsx_text")).toBe(false)
    })

    it("ignores URLs and paths", () => {
      expect(isHumanReadableText("https://example.com/api", "jsx_text")).toBe(
        false
      )
      expect(isHumanReadableText("/console/settings", "jsx_text")).toBe(false)
      expect(isHumanReadableText("#section", "jsx_text")).toBe(false)
    })

    it("evaluates JSX attributes appropriately", () => {
      expect(
        isHumanReadableText(
          "Enter your email address",
          "jsx_attribute",
          "placeholder"
        )
      ).toBe(true)
      expect(
        isHumanReadableText("Close modal", "jsx_attribute", "aria-label")
      ).toBe(true)
    })
  })

  describe("scanSourceFile and scanCodebase", () => {
    const testDir = join(process.cwd(), ".tmp-test-i18n")

    const setupTestFiles = () => {
      mkdirSync(testDir, { recursive: true })

      // File 1: Pure hardcoded
      writeFileSync(
        join(testDir, "hardcoded-component.tsx"),
        `
        import React from "react"
        export function HardcodedComponent() {
          return (
            <div>
              <h1>Welcome to the App</h1>
              <p>This is a hardcoded description.</p>
              <input placeholder="Type something here" />
            </div>
          )
        }
        `
      )

      // File 2: Mixed translated and hardcoded
      writeFileSync(
        join(testDir, "mixed-component.tsx"),
        `
        import React from "react"
        import { getMessages } from "@/lib/i18n/messages"
        export function MixedComponent({ locale }: { locale: "en" | "id" }) {
          const messages = getMessages(locale)
          return (
            <div>
              <h1>{messages.heading}</h1>
              <p>Untranslated helper text</p>
            </div>
          )
        }
        `
      )

      // File 3: Fully translated
      writeFileSync(
        join(testDir, "translated-component.tsx"),
        `
        import React from "react"
        export function FullyTranslated({ messages }: { messages: any }) {
          return (
            <div>
              <h1>{messages.title}</h1>
              <p>{messages.description}</p>
            </div>
          )
        }
        `
      )
    }

    const cleanupTestFiles = () => {
      rmSync(testDir, { recursive: true, force: true })
    }

    it("detects hardcoded strings in a file", () => {
      setupTestFiles()
      try {
        const fileReport = scanSourceFile("hardcoded-component.tsx", testDir)

        expect(fileReport.hardcodedCount).toBe(3)
        expect(fileReport.translatedCount).toBe(0)
        expect(fileReport.coverage).toBe(0)
        expect(fileReport.issues.length).toBe(3)
      } finally {
        cleanupTestFiles()
      }
    })

    it("calculates accurate coverage for mixed and translated components", () => {
      setupTestFiles()
      try {
        const mixed = scanSourceFile("mixed-component.tsx", testDir)
        expect(mixed.hardcodedCount).toBe(1)
        expect(mixed.translatedCount).toBeGreaterThanOrEqual(1)
        expect(mixed.coverage).toBeGreaterThan(0)
        expect(mixed.coverage).toBeLessThan(100)

        const translated = scanSourceFile("translated-component.tsx", testDir)
        expect(translated.hardcodedCount).toBe(0)
        expect(translated.translatedCount).toBe(2)
        expect(translated.coverage).toBe(100)
      } finally {
        cleanupTestFiles()
      }
    })

    it("scans entire directory and compiles overall scan report", () => {
      setupTestFiles()
      try {
        const report = scanCodebase({
          rootDir: testDir,
          targetPaths: ["."],
        })

        expect(report.totalFiles).toBe(3)
        expect(report.totalHardcoded).toBe(4)
        expect(report.totalTranslated).toBeGreaterThanOrEqual(3)
        expect(report.overallCoverage).toBeGreaterThan(0)
        expect(report.files.length).toBe(3)
      } finally {
        cleanupTestFiles()
      }
    })
  })

  describe("Markdown and Annotations generation", () => {
    const sampleReport: ScanReport = {
      timestamp: "2026-09-15T00:00:00.000Z",
      totalFiles: 2,
      totalStrings: 10,
      totalHardcoded: 3,
      totalTranslated: 7,
      overallCoverage: 70.0,
      files: [
        {
          file: "app/[lang]/portal/page.tsx",
          totalStrings: 5,
          hardcodedCount: 3,
          translatedCount: 2,
          coverage: 40.0,
          issues: [
            {
              file: "app/[lang]/portal/page.tsx",
              line: 10,
              character: 5,
              text: "Hardcoded title",
              context: "jsx_text",
            },
            {
              file: "app/[lang]/portal/page.tsx",
              line: 15,
              character: 7,
              text: "Enter text",
              context: "jsx_attribute",
              attributeName: "placeholder",
            },
          ],
        },
        {
          file: "app/[lang]/console/page.tsx",
          totalStrings: 5,
          hardcodedCount: 0,
          translatedCount: 5,
          coverage: 100.0,
          issues: [],
        },
      ],
    }

    it("generates markdown summary with table and badges", () => {
      const md = generateMarkdownSummary(sampleReport)
      expect(md).toContain("i18n Translation & Coverage Report")
      expect(md).toContain("70%")
      expect(md).toContain("app/[lang]/portal/page.tsx")
      expect(md).toContain("40%")
    })

    it("emits GitHub annotations without crashing", () => {
      const logs: string[] = []
      const originalLog = console.log
      console.log = (msg: string) => logs.push(msg)

      try {
        emitGitHubAnnotations(sampleReport)
        expect(logs.length).toBe(2)
        expect(logs[0]).toContain(
          "::warning file=app/[lang]/portal/page.tsx,line=10"
        )
        expect(logs[0]).toContain('Hardcoded JSX text: "Hardcoded title"')
        expect(logs[1]).toContain(
          "::warning file=app/[lang]/portal/page.tsx,line=15"
        )
        expect(logs[1]).toContain(
          "Hardcoded prop 'placeholder': \"Enter text\""
        )
      } finally {
        console.log = originalLog
      }
    })
  })
})
