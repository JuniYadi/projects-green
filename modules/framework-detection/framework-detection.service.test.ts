import { beforeEach, describe, expect, it } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  detectFrameworkFromGitRepo,
  detectFrameworkFromGithubApi,
  __testables,
} from "@/modules/framework-detection/framework-detection.service"
import type { FrameworkDetectionInput } from "@/modules/framework-detection/framework-detection.types"
import type { DetectorDependencies } from "@/modules/framework-detection/framework-detection.service"
import type { GithubApiDetectorDependencies } from "@/modules/framework-detection/framework-detection.service"

const writeRepoFiles = async (
  rootPath: string,
  entries: Record<string, string>
) => {
  for (const [filePath, content] of Object.entries(entries)) {
    const absolutePath = path.join(rootPath, filePath)

    await mkdir(path.dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, content)
  }
}

const runWithMockClone = async (
  input: FrameworkDetectionInput,
  files: Record<string, string>,
  resolveWithAi?: DetectorDependencies["resolveWithAi"]
) => {
  return detectFrameworkFromGitRepo(input, {
    cloneRepository: async (_, destinationPath) => {
      await writeRepoFiles(destinationPath, files)
    },
    resolveWithAi,
  })
}

describe("detectFrameworkFromGitRepo", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY
    delete process.env.AI_DETECTOR_MODEL
  })

  it("detects Next.js and does not require AI fallback", async () => {
    let aiCalled = false

    const result = await runWithMockClone(
      { repoUrl: "https://example.com/repo.git" },
      {
        "package.json": JSON.stringify({
          dependencies: {
            next: "16.1.0",
            react: "19.0.0",
          },
          scripts: {
            dev: "next dev",
          },
        }),
        "next.config.mjs": "export default {}",
        "app/page.tsx": "export default function Page() { return null }",
        "bun.lock": "{}",
      },
      async () => {
        aiCalled = true

        return {
          primaryFrameworkId: "nextjs",
          confidence: 0.95,
          requiredRuntimeIds: ["node"],
          reasoning: ["mock"],
        }
      }
    )

    expect(result.primaryFramework?.id).toBe("nextjs")
    expect(result.requiredDependencies).toContainEqual(
      expect.objectContaining({
        id: "node",
        requiredFor: "app_runtime",
      })
    )
    expect(aiCalled).toBe(false)
  })

  it("detects Laravel as primary and Node for asset build", async () => {
    const result = await runWithMockClone(
      { repoUrl: "https://example.com/repo.git" },
      {
        "composer.json": JSON.stringify({
          require: {
            "laravel/framework": "^11.0",
          },
        }),
        "composer.lock": "{}",
        artisan: "#!/usr/bin/env php",
        "bootstrap/app.php": "<?php",
        "config/app.php": "<?php",
        "package.json": JSON.stringify({
          devDependencies: {
            "laravel-vite-plugin": "^1.0",
          },
        }),
        "vite.config.js": "export default {}",
        "package-lock.json": "{}",
      }
    )

    expect(result.primaryFramework?.id).toBe("laravel")
    expect(result.requiredDependencies).toContainEqual(
      expect.objectContaining({
        id: "php",
        requiredFor: "app_runtime",
      })
    )
    expect(result.requiredDependencies).toContainEqual(
      expect.objectContaining({
        id: "node",
        requiredFor: "asset_build",
      })
    )
  })

  it("uses AI fallback when deterministic confidence is low", async () => {
    const result = await runWithMockClone(
      { repoUrl: "https://example.com/repo.git" },
      {
        "package.json": JSON.stringify({
          dependencies: {
            react: "19.0.0",
          },
          devDependencies: {
            vite: "5.0.0",
          },
        }),
        "vite.config.ts": "export default {}",
      },
      async () => ({
        primaryFrameworkId: "react",
        confidence: 0.8,
        requiredRuntimeIds: ["node"],
        reasoning: ["React + Vite signature is strongest"],
      })
    )

    expect(result.primaryFramework?.id).toBe("react")
    expect(result.evidence).toContainEqual(
      expect.objectContaining({
        type: "ai",
        value: "ai-disambiguation",
      })
    )
  })

  it("falls back to deterministic result when AI resolver fails", async () => {
    const result = await runWithMockClone(
      { repoUrl: "https://example.com/repo.git" },
      {
        "package.json": JSON.stringify({
          dependencies: {
            react: "19.0.0",
          },
          devDependencies: {
            vite: "5.0.0",
          },
        }),
        "vite.config.ts": "export default {}",
      },
      async () => {
        throw new Error("model unavailable")
      }
    )

    expect(result.primaryFramework?.id).toBe("react")
    expect(
      result.warnings.some((warning) => warning.includes("AI fallback skipped"))
    ).toBe(true)
  })
})

describe("detectFrameworkFromGithubApi", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY
    delete process.env.AI_DETECTOR_MODEL
  })

  it("detects Next.js via GitHub API tools", async () => {
    const mockFiles = [
      "package.json",
      "next.config.mjs",
      "app/page.tsx",
      "bun.lock",
    ]

    const mockFileContents: Record<string, string> = {
      "package.json": JSON.stringify({
        dependencies: {
          next: "16.1.0",
          react: "19.0.0",
        },
      }),
    }

    const mockPrisma = {
      detectorRule: {
        findMany: async () => [],
      },
      inspectionLog: {
        create: async () => ({}),
      },
      runtimeMapping: {
        findMany: async () => [],
      },
    }

    const dependencies: GithubApiDetectorDependencies = {
      listFiles: async () => ({ files: mockFiles, truncated: false }),
      readFile: async ({ filePath }) => ({
        content: mockFileContents[filePath] ?? "",
        path: filePath,
        sha: "abc123",
        size: 100,
      }),
      resolveWithAiToolCalling: async () => ({
        primaryFrameworkId: "nextjs",
        confidence: 0.95,
        requiredRuntimeIds: ["node"],
        reasoning: ["next dependency found in package.json"],
      }),
      prisma: mockPrisma,
    }

    const result = await detectFrameworkFromGithubApi(
      {
        installationId: 12345,
        owner: "test-org",
        repo: "test-repo",
      },
      dependencies
    )

    expect(result.primaryFramework?.id).toBe("nextjs")
    expect(result.requiredDependencies).toContainEqual(
      expect.objectContaining({
        id: "node",
      })
    )
    expect(result.evidence).toContainEqual(
      expect.objectContaining({
        type: "ai",
        value: "tool-calling-detection",
      })
    )
  })

  it("blocks WordPress via DetectorRule", async () => {
    // Test the checkForBlockedFrameworks logic directly
    const { checkForBlockedFrameworks } = __testables

    const detectorRules = [
      {
        id: "rule-1",
        name: "Block WordPress",
        description: "WordPress is not supported",
        patternJson: { files: ["wp-config.php"] },
        implicationsJson: { framework: "wordpress", impact: "BLOCK" },
        confidenceWeight: 1.0,
        isActive: true,
        priority: 100,
      },
    ]

    const result = checkForBlockedFrameworks(
      ["wp-config.php", "wp-admin/index.php"],
      detectorRules
    )

    expect(result.blocked).toBe(true)
    expect(result.rule?.name).toBe("Block WordPress")
    expect(result.matchedFiles).toContain("wp-config.php")
  })
})

describe("checkForBlockedFrameworks", () => {
  it("returns not blocked when no BLOCK rules match", () => {
    const { checkForBlockedFrameworks } = __testables

    const rules = [
      {
        id: "rule-1",
        name: "Hint Laravel",
        description: null,
        patternJson: { files: ["artisan"] },
        implicationsJson: { framework: "laravel", impact: "HINT" },
        confidenceWeight: 1.0,
        isActive: true,
        priority: 10,
      },
    ]

    const result = checkForBlockedFrameworks(["artisan", "composer.json"], rules)

    expect(result.blocked).toBe(false)
  })

  it("returns blocked when a BLOCK rule matches", () => {
    const { checkForBlockedFrameworks } = __testables

    const rules = [
      {
        id: "rule-1",
        name: "Block WordPress",
        description: null,
        patternJson: { files: ["wp-config.php"] },
        implicationsJson: { framework: "wordpress", impact: "BLOCK" },
        confidenceWeight: 1.0,
        isActive: true,
        priority: 100,
      },
    ]

    const result = checkForBlockedFrameworks(
      ["wp-config.php", "wp-includes/functions.php"],
      rules
    )

    expect(result.blocked).toBe(true)
    expect(result.rule?.id).toBe("rule-1")
    expect(result.matchedFiles).toEqual(["wp-config.php"])
  })

  it("respects priority when multiple BLOCK rules match", () => {
    const { checkForBlockedFrameworks } = __testables

    const rules = [
      {
        id: "rule-1",
        name: "Low Priority Block",
        description: null,
        patternJson: { files: ["wp-config.php"] },
        implicationsJson: { framework: "wordpress", impact: "BLOCK" },
        confidenceWeight: 1.0,
        isActive: true,
        priority: 10,
      },
      {
        id: "rule-2",
        name: "High Priority Block",
        description: null,
        patternJson: { files: ["wp-config.php"] },
        implicationsJson: { framework: "wordpress", impact: "BLOCK" },
        confidenceWeight: 1.0,
        isActive: true,
        priority: 100,
      },
    ]

    const result = checkForBlockedFrameworks(["wp-config.php"], rules)

    expect(result.blocked).toBe(true)
    expect(result.rule?.name).toBe("High Priority Block")
  })
})

describe("buildDetectorRuleHints", () => {
  it("returns hint for no rules", () => {
    const { buildDetectorRuleHints } = __testables

    const result = buildDetectorRuleHints([])

    expect(result).toBe("No admin-defined detector rules are active.")
  })

  it("formats rules correctly", () => {
    const { buildDetectorRuleHints } = __testables

    const rules = [
      {
        id: "rule-1",
        name: "Laravel Detection",
        description: "Detect Laravel projects",
        patternJson: { files: ["artisan", "composer.json"] },
        implicationsJson: { framework: "laravel", impact: "HINT" },
        confidenceWeight: 1.0,
        isActive: true,
        priority: 10,
      },
    ]

    const result = buildDetectorRuleHints(rules)

    expect(result).toContain("Admin-defined detector rules")
    expect(result).toContain("Laravel Detection")
    expect(result).toContain("artisan, composer.json")
    expect(result).toContain("framework=laravel")
  })
})
