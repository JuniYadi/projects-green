import { describe, expect, it } from "bun:test"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import {
  formatIconName,
  generateTemplateIconsCode,
  scanTemplateLocalIcons,
  generateTemplateIconsFile,
} from "./generate-template-icons"
import {
  TEMPLATE_LOCAL_ICONS,
  getTemplateLocalIconByPath,
  getTemplateLocalIconBySlug,
} from "@/modules/deploy/constants/template-local-icons.generated"

describe("generate-template-icons script", () => {
  it("formats icon name correctly for known and unknown slugs", () => {
    expect(formatIconName("hermes")).toBe("Hermes Agent")
    expect(formatIconName("9router")).toBe("9router")
    expect(formatIconName("n8n")).toBe("n8n Automation")
    expect(formatIconName("openclaw")).toBe("OpenClaw")
    expect(formatIconName("custom-tool")).toBe("Custom Tool")
    expect(formatIconName("another_sample_app")).toBe("Another Sample App")
  })

  it("scans mock directory with various image extensions and ignores non-images", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "icons-test-"))
    try {
      fs.writeFileSync(path.join(tempDir, "sample-app.svg"), "<svg></svg>")
      fs.writeFileSync(path.join(tempDir, "other-app.png"), "fake png")
      fs.writeFileSync(path.join(tempDir, "ignored-doc.txt"), "readme")
      fs.mkdirSync(path.join(tempDir, "nested-dir"))

      const icons = scanTemplateLocalIcons(tempDir)
      expect(icons.length).toBe(2)
      expect(icons[0].slug).toBe("other-app")
      expect(icons[0].fileName).toBe("other-app.png")
      expect(icons[0].path).toBe("/app-hosting/icons/other-app.png")

      expect(icons[1].slug).toBe("sample-app")
      expect(icons[1].fileName).toBe("sample-app.svg")
      expect(icons[1].path).toBe("/app-hosting/icons/sample-app.svg")
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("handles non-existent directory gracefully", () => {
    const icons = scanTemplateLocalIcons("/path/that/does/not/exist/at/all")
    expect(icons).toEqual([])
  })

  it("generates TypeScript code matching expected schema", () => {
    const code = generateTemplateIconsCode([
      {
        slug: "test-app",
        name: "Test App",
        fileName: "test-app.svg",
        path: "/app-hosting/icons/test-app.svg",
      },
    ])
    expect(code).toContain("TEMPLATE_LOCAL_ICONS")
    expect(code).toContain("/app-hosting/icons/test-app.svg")
    expect(code).toContain("getTemplateLocalIconByPath")
    expect(code).toContain("getTemplateLocalIconBySlug")
  })

  it("executes generateTemplateIconsFile and produces valid file", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gen-icons-test-"))
    const tempOutput = path.join(tempDir, "generated.ts")
    try {
      fs.writeFileSync(path.join(tempDir, "app.svg"), "<svg></svg>")
      const res = generateTemplateIconsFile(tempDir, tempOutput)
      expect(res.count).toBe(1)
      expect(fs.existsSync(tempOutput)).toBe(true)
      const content = fs.readFileSync(tempOutput, "utf-8")
      expect(content).toContain("app.svg")
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("verifies generated TEMPLATE_LOCAL_ICONS has active templates", () => {
    expect(TEMPLATE_LOCAL_ICONS.length).toBeGreaterThanOrEqual(3)
    const slugs = TEMPLATE_LOCAL_ICONS.map((i) => i.slug)
    expect(slugs).toContain("hermes")
    expect(slugs).toContain("9router")
    expect(slugs).toContain("n8n")

    const hermes = getTemplateLocalIconBySlug("hermes")
    expect(hermes?.path).toBe("/app-hosting/icons/hermes.svg")

    const byPath = getTemplateLocalIconByPath("/app-hosting/icons/n8n.svg")
    expect(byPath?.slug).toBe("n8n")

    expect(getTemplateLocalIconBySlug("non-existent")).toBeUndefined()
    expect(getTemplateLocalIconByPath(null)).toBeUndefined()
  })
})
