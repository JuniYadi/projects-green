import { beforeEach, describe, expect, it, mock } from "bun:test"
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
      detectorInspectionLog: {
        create: async () => ({}),
      },
      detectorRuntimeMapping: {
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
        decision: {
          primaryFrameworkId: "nextjs",
          confidence: 0.95,
          requiredRuntimeIds: ["node"],
          reasoning: ["next dependency found in package.json"],
        },
        toolCalls: [
          {
            toolCallId: "tc-1",
            toolName: "read_repo_file",
            input: { filePath: "package.json" },
            output: { content: '{"dependencies":{"next":"14.0"}}' },
          },
        ],
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

    const result = checkForBlockedFrameworks(
      ["artisan", "composer.json"],
      rules
    )

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

describe("detectFrameworkFromGithubApi - error handling", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY
    delete process.env.AI_DETECTOR_MODEL
  })

  it("handles detectorInspectionLog.create failure gracefully", async () => {
    const mockPrisma = {
      detectorRule: {
        findMany: async () => [],
      },
      detectorInspectionLog: {
        create: async () => {
          throw new Error("Database connection failed")
        },
      },
      detectorRuntimeMapping: {
        findMany: async () => [],
      },
    }

    const dependencies: GithubApiDetectorDependencies = {
      listFiles: async () => ({
        files: ["package.json", "next.config.mjs"],
        truncated: false,
      }),
      resolveWithAiToolCalling: async () => ({
        decision: {
          primaryFrameworkId: "nextjs",
          confidence: 0.9,
          requiredRuntimeIds: ["node"],
          reasoning: ["next dependency found"],
        },
        toolCalls: [
          {
            toolCallId: "tc-1",
            toolName: "list_repo_files",
            input: {},
            output: { files: ["package.json", "next.config.mjs"] },
          },
          {
            toolCallId: "tc-2",
            toolName: "read_repo_file",
            input: { filePath: "package.json" },
            output: { content: '{"dependencies":{"next":"14.0"}}' },
          },
        ],
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

    // Should still return result even if logging fails
    expect(result.primaryFramework?.id).toBe("nextjs")
    expect(result.warnings.some((w) => w.includes("Failed to log"))).toBe(true)
  })

  it("handles blocked framework with logging failure", async () => {
    const mockPrisma = {
      detectorRule: {
        findMany: async () => [
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
        ],
      },
      detectorInspectionLog: {
        create: async () => {
          throw new Error("Database connection failed")
        },
      },
      detectorRuntimeMapping: {
        findMany: async () => [],
      },
    }

    const dependencies: GithubApiDetectorDependencies = {
      listFiles: async () => ({
        files: ["wp-config.php"],
        truncated: false,
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

    // Should still return blocked result even if logging fails
    expect(result.primaryFramework?.id).toBe("wordpress")
    expect(result.warnings.some((w) => w.includes("Failed to log"))).toBe(true)
  })

  it("returns error when AI resolver fails", async () => {
    const mockPrisma = {
      detectorRule: {
        findMany: async () => [],
      },
      detectorInspectionLog: {
        create: async () => ({}),
      },
      detectorRuntimeMapping: {
        findMany: async () => [],
      },
    }

    const dependencies: GithubApiDetectorDependencies = {
      listFiles: async () => ({
        files: ["package.json"],
        truncated: false,
      }),
      resolveWithAiToolCalling: async () => {
        throw new Error("AI model unavailable")
      },
      prisma: mockPrisma,
    }

    await expect(
      detectFrameworkFromGithubApi(
        {
          installationId: 12345,
          owner: "test-org",
          repo: "test-repo",
        },
        dependencies
      )
    ).rejects.toThrow("Detection failed: AI model unavailable")
  })

  it("handles truncated file listing", async () => {
    const mockPrisma = {
      detectorRule: {
        findMany: async () => [],
      },
      detectorInspectionLog: {
        create: async () => ({}),
      },
      detectorRuntimeMapping: {
        findMany: async () => [],
      },
    }

    const dependencies: GithubApiDetectorDependencies = {
      listFiles: async () => ({
        files: ["package.json"],
        truncated: true, // Truncated
      }),
      resolveWithAiToolCalling: async () => ({
        decision: {
          primaryFrameworkId: "nextjs",
          confidence: 0.8,
          requiredRuntimeIds: ["node"],
          reasoning: ["partial listing"],
        },
        toolCalls: [],
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

    expect(result.warnings.some((w) => w.includes("truncated"))).toBe(true)
  })

  it("captures tool calls in inspection log audit trail", async () => {
    const mockPrisma = {
      detectorRule: {
        findMany: async () => [],
      },
      detectorInspectionLog: {
        create: mock(() => ({})),
      },
      detectorRuntimeMapping: {
        findMany: async () => [],
      },
    }

    const dependencies: GithubApiDetectorDependencies = {
      listFiles: async () => ({
        files: ["package.json", "next.config.mjs"],
        truncated: false,
      }),
      resolveWithAiToolCalling: async () => ({
        decision: {
          primaryFrameworkId: "nextjs",
          confidence: 0.9,
          requiredRuntimeIds: ["node"],
          reasoning: ["next dependency found"],
        },
        toolCalls: [
          {
            toolCallId: "tc-1",
            toolName: "list_repo_files",
            input: {},
            output: { files: ["package.json", "next.config.mjs"] },
          },
          {
            toolCallId: "tc-2",
            toolName: "read_repo_file",
            input: { filePath: "package.json" },
            output: { content: '{"dependencies":{"next":"14.0"}}' },
          },
        ],
      }),
      prisma: mockPrisma,
    }

    await detectFrameworkFromGithubApi(
      {
        installationId: 12345,
        owner: "test-org",
        repo: "test-repo",
      },
      dependencies
    )

    // Verify tool calls are captured in the audit log
    expect(mockPrisma.detectorInspectionLog.create).toHaveBeenCalledTimes(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logCall = (mockPrisma.detectorInspectionLog.create as any).mock
      .calls[0]?.[0]
    expect(logCall.data.toolCalls).toHaveLength(2)
    expect(logCall.data.toolCalls[0]).toEqual({
      toolCallId: "tc-1",
      toolName: "list_repo_files",
      input: {},
      output: { files: ["package.json", "next.config.mjs"] },
    })
    expect(logCall.data.toolCalls[1]).toEqual({
      toolCallId: "tc-2",
      toolName: "read_repo_file",
      input: { filePath: "package.json" },
      output: { content: '{"dependencies":{"next":"14.0"}}' },
    })
  })
})

describe("enforceRuntimeMappings", () => {
  it("returns suggested runtimes when no mappings exist", async () => {
    const { enforceRuntimeMappings } = __testables

    const mockPrisma = {
      detectorRuntimeMapping: {
        findMany: async () => [],
      },
    }

    const suggestedRuntimes = [
      {
        id: "node" as const,
        kind: "runtime" as const,
        requiredFor: "app_runtime" as const,
        confidence: 0.9,
        reason: "Node detected",
      },
    ]

    const result = await enforceRuntimeMappings(
      "nextjs",
      "14",
      suggestedRuntimes,
      mockPrisma as unknown as {
        detectorRuntimeMapping: { findMany: () => Promise<unknown[]> }
      }
    )

    expect(result.enforced).toEqual(suggestedRuntimes)
    expect(result.appliedMappings).toEqual([])
  })

  it("overrides runtime version when mapping exists", async () => {
    const { enforceRuntimeMappings } = __testables

    const mockPrisma = {
      detectorRuntimeMapping: {
        findMany: async () => [
          {
            id: "mapping-1",
            frameworkId: "laravel",
            frameworkVersion: "10",
            runtimeId: "php",
            runtimeVersion: "8.2",
            buildVersion: null,
            isActive: true,
            priority: 10,
          },
        ],
      },
    }

    const suggestedRuntimes = [
      {
        id: "php" as const,
        kind: "runtime" as const,
        requiredFor: "app_runtime" as const,
        confidence: 0.9,
        reason: "PHP detected",
      },
    ]

    const result = await enforceRuntimeMappings(
      "laravel",
      "10",
      suggestedRuntimes,
      mockPrisma as unknown as {
        detectorRuntimeMapping: { findMany: () => Promise<unknown[]> }
      }
    )

    expect(result.enforced).toHaveLength(1)
    expect(result.enforced[0].id).toBe("php")
    expect(result.enforced[0].confidence).toBe(1.0)
    expect(result.enforced[0].reason).toContain("Enforced by RuntimeMapping")
    expect(result.appliedMappings).toContain("php 8.2")
  })

  it("adds new runtime when mapping exists but not in suggested", async () => {
    const { enforceRuntimeMappings } = __testables

    const mockPrisma = {
      detectorRuntimeMapping: {
        findMany: async () => [
          {
            id: "mapping-1",
            frameworkId: "laravel",
            frameworkVersion: "10",
            runtimeId: "node",
            runtimeVersion: "20",
            buildVersion: null,
            isActive: true,
            priority: 10,
          },
        ],
      },
    }

    const suggestedRuntimes = [
      {
        id: "php" as const,
        kind: "runtime" as const,
        requiredFor: "app_runtime" as const,
        confidence: 0.9,
        reason: "PHP detected",
      },
    ]

    const result = await enforceRuntimeMappings(
      "laravel",
      "10",
      suggestedRuntimes,
      mockPrisma as unknown as {
        detectorRuntimeMapping: { findMany: () => Promise<unknown[]> }
      }
    )

    expect(result.enforced).toHaveLength(2)
    expect(result.enforced.map((r) => r.id)).toContain("php")
    expect(result.enforced.map((r) => r.id)).toContain("node")
    expect(result.appliedMappings).toContain("node 20")
  })

  it("uses wildcard mapping when exact version not found", async () => {
    const { enforceRuntimeMappings } = __testables

    const mockPrisma = {
      detectorRuntimeMapping: {
        findMany: async () => [
          {
            id: "mapping-1",
            frameworkId: "laravel",
            frameworkVersion: null, // wildcard
            runtimeId: "php",
            runtimeVersion: "8.1",
            buildVersion: null,
            isActive: true,
            priority: 5,
          },
        ],
      },
    }

    const suggestedRuntimes = [
      {
        id: "php" as const,
        kind: "runtime" as const,
        requiredFor: "app_runtime" as const,
        confidence: 0.9,
        reason: "PHP detected",
      },
    ]

    const result = await enforceRuntimeMappings(
      "laravel",
      "11", // Different version than mapping
      suggestedRuntimes,
      mockPrisma as unknown as {
        detectorRuntimeMapping: { findMany: () => Promise<unknown[]> }
      }
    )

    expect(result.enforced).toHaveLength(1)
    expect(result.appliedMappings).toContain("php 8.1")
  })
})

describe("inferFrameworkEcosystem", () => {
  it("returns correct ecosystem for known frameworks", () => {
    const { inferFrameworkEcosystem } = __testables

    expect(inferFrameworkEcosystem("laravel")).toBe("php")
    expect(inferFrameworkEcosystem("nextjs")).toBe("node")
    expect(inferFrameworkEcosystem("react")).toBe("node")
    expect(inferFrameworkEcosystem("django")).toBe("python")
    expect(inferFrameworkEcosystem("rails")).toBe("ruby")
    expect(inferFrameworkEcosystem("spring")).toBe("java")
    expect(inferFrameworkEcosystem("echo")).toBe("go")
    expect(inferFrameworkEcosystem("actix")).toBe("rust")
  })

  it("returns unknown for unrecognized frameworks", () => {
    const { inferFrameworkEcosystem } = __testables

    expect(inferFrameworkEcosystem("custom-framework")).toBe("unknown")
    expect(inferFrameworkEcosystem("")).toBe("unknown")
  })
})

describe("evaluateSupportDecision", () => {
  const baseRules = [
    {
      id: "support-laravel-launch",
      name: "Support Laravel Launch",
      description: null,
      patternJson: { frameworkId: "laravel" },
      implicationsJson: {
        impact: "LAUNCH",
        framework: "laravel",
        minConfidence: 0.8,
      },
      confidenceWeight: 1.0,
      isActive: true,
      priority: 100,
    },
    {
      id: "support-next-js-launch",
      name: "Support Next.js Launch",
      description: null,
      patternJson: { frameworkId: "nextjs" },
      implicationsJson: {
        impact: "LAUNCH",
        framework: "nextjs",
        minConfidence: 0.8,
      },
      confidenceWeight: 1.0,
      isActive: true,
      priority: 100,
    },
  ]

  const laravelPrimary = {
    id: "laravel",
    name: "Laravel",
    ecosystem: "php" as const,
    confidence: 0.95,
    reasons: ["artisan file exists"],
  }

  const nextPrimary = {
    id: "nextjs",
    name: "Next.js",
    ecosystem: "node" as const,
    confidence: 0.95,
    reasons: ["next dependency found"],
  }

  it("returns blocked when an evidence entry signals a BLOCK rule match", () => {
    const { evaluateSupportDecision } = __testables

    const rules = [
      {
        id: "block-wordpress",
        name: "Block WordPress",
        description: null,
        patternJson: { files: ["wp-config.php"] },
        implicationsJson: { framework: "wordpress", impact: "BLOCK" },
        confidenceWeight: 1.0,
        isActive: true,
        priority: 100,
      },
    ]

    const decision = evaluateSupportDecision(
      {
        primaryFramework: null,
        confidence: 0,
        evidence: [
          {
            type: "file",
            value: "blocked",
            detail:
              'Blocked by rule "Block WordPress": matched files wp-config.php',
          },
        ],
      },
      rules
    )

    expect(decision.status).toBe("blocked")
    expect(decision.isLaunchable).toBe(false)
    expect(decision.message).toContain("Block WordPress")
  })

  it("returns unsupported when no primary framework is detected", () => {
    const { evaluateSupportDecision } = __testables

    const decision = evaluateSupportDecision(
      {
        primaryFramework: null,
        confidence: 0,
        evidence: [],
      },
      baseRules
    )

    expect(decision.status).toBe("unsupported")
    expect(decision.isLaunchable).toBe(false)
    expect(decision.message).toMatch(/couldn't verify a supported framework/i)
  })

  it("returns success when a LAUNCH rule matches and confidence is high", () => {
    const { evaluateSupportDecision } = __testables

    const decision = evaluateSupportDecision(
      {
        primaryFramework: laravelPrimary,
        confidence: 0.92,
        evidence: [],
      },
      baseRules
    )

    expect(decision.status).toBe("success")
    expect(decision.isLaunchable).toBe(true)
    expect(decision.message).toBe("Ready to deploy.")
  })

  it("returns low_confidence when a LAUNCH rule matches but confidence is below the threshold", () => {
    const { evaluateSupportDecision } = __testables

    const decision = evaluateSupportDecision(
      {
        primaryFramework: nextPrimary,
        confidence: 0.6,
        evidence: [],
      },
      baseRules
    )

    expect(decision.status).toBe("low_confidence")
    expect(decision.isLaunchable).toBe(false)
    expect(decision.message).toContain("Next.js")
    expect(decision.message).toContain("60%")
  })

  it("returns unsupported when a framework has no LAUNCH rule (React on MVP policy)", () => {
    const { evaluateSupportDecision } = __testables

    const reactPrimary = {
      id: "react",
      name: "React",
      ecosystem: "node" as const,
      confidence: 0.9,
      reasons: ["react dependency found"],
    }

    const decision = evaluateSupportDecision(
      {
        primaryFramework: reactPrimary,
        confidence: 0.9,
        evidence: [],
      },
      baseRules
    )

    expect(decision.status).toBe("unsupported")
    expect(decision.isLaunchable).toBe(false)
    expect(decision.message).toContain("React")
    expect(decision.message).toMatch(/laravel, nextjs/)
  })

  it("uses the implicationsJson minConfidence as the gate (custom threshold)", () => {
    const { evaluateSupportDecision } = __testables

    const rules = [
      {
        id: "strict-laravel",
        name: "Strict Laravel Launch",
        description: null,
        patternJson: { frameworkId: "laravel" },
        implicationsJson: {
          impact: "LAUNCH",
          framework: "laravel",
          minConfidence: 0.95,
        },
        confidenceWeight: 1.0,
        isActive: true,
        priority: 100,
      },
    ]

    const decision = evaluateSupportDecision(
      {
        primaryFramework: laravelPrimary,
        confidence: 0.9,
        evidence: [],
      },
      rules
    )

    expect(decision.status).toBe("low_confidence")
    expect(decision.isLaunchable).toBe(false)
  })
})
