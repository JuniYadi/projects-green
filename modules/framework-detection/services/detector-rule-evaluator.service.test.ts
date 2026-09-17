import { describe, expect, it, mock } from "bun:test"
import type { PrismaClient } from "@prisma/client"
import {
  DetectorRuleEvaluator,
  detectorRuleEvaluator,
  type PolicyRuleEvaluationResult,
} from "./detector-rule-evaluator.service"
import type { AiDetectionToolTrace } from "../framework-detection.trace"

describe("DetectorRuleEvaluator", () => {
  const createMockDb = (rules: unknown[] = []) => {
    return {
      detectorRule: {
        findMany: mock(async () => rules),
      },
    } as unknown as PrismaClient
  }

  describe("evaluateRepositoryPolicy - clean repositories", () => {
    it("returns isBlocked: false for Next.js repository", async () => {
      const evaluator = new DetectorRuleEvaluator()
      const result = await evaluator.evaluateRepositoryPolicy({
        files: [
          "package.json",
          "next.config.js",
          "src/app/page.tsx",
          "src/app/layout.tsx",
        ],
        detectedFramework: "nextjs",
      })

      expect(result.isBlocked).toBe(false)
      expect(result.ruleCode).toBeUndefined()
    })

    it("returns isBlocked: false for Node.js Express repository", async () => {
      const evaluator = new DetectorRuleEvaluator()
      const result = await evaluator.evaluateRepositoryPolicy({
        files: ["package.json", "index.js", ".env.example"],
        detectedFramework: "express",
      })

      expect(result.isBlocked).toBe(false)
      expect(result.ruleCode).toBeUndefined()
    })

    it("returns isBlocked: false for Go repository", async () => {
      const evaluator = new DetectorRuleEvaluator()
      const result = await evaluator.evaluateRepositoryPolicy({
        files: ["go.mod", "go.sum", "main.go", "handlers/health.go"],
        detectedFramework: "go",
      })

      expect(result.isBlocked).toBe(false)
      expect(result.ruleCode).toBeUndefined()
    })

    it("returns isBlocked: false when mock database returns empty rules", async () => {
      const mockDb = createMockDb([])
      const result = await detectorRuleEvaluator.evaluateRepositoryPolicy({
        files: ["package.json", "src/index.ts"],
        detectedFramework: "node",
        db: mockDb,
      })

      expect(result.isBlocked).toBe(false)
    })
  })

  describe("evaluateRepositoryPolicy - blocked legacy WordPress", () => {
    it("returns isBlocked: true, ruleCode, CVE references, and Marketplace alternatives for wp-config.php", async () => {
      const evaluator = new DetectorRuleEvaluator()
      const result = await evaluator.evaluateRepositoryPolicy({
        files: [
          "wp-config.php",
          "wp-content/themes/twentyten/style.css",
          "index.php",
        ],
      })

      expect(result.isBlocked).toBe(true)
      expect(result.ruleCode).toBe("RULE-BLOCK-WP-LEGACY")
      expect(result.title).toBeTruthy()
      expect(result.reason).toContain("wp-config.php")
      expect(result.cveReferences).toBeDefined()
      expect(result.cveReferences?.length).toBeGreaterThan(0)
      expect(result.cveReferences?.some((cve) => cve.startsWith("CVE-"))).toBe(
        true
      )

      const alternatives = result.suggestedAlternatives
      expect(alternatives).toBeDefined()
      expect(alternatives?.length).toBeGreaterThanOrEqual(2)

      const marketplaceAlt = alternatives?.find((a) => a.type === "marketplace")
      expect(marketplaceAlt).toBeDefined()
      expect(marketplaceAlt?.target).toBe("pfn-app-wordpress")
      expect(marketplaceAlt?.title).toContain("WordPress")

      const dockerfileAlt = alternatives?.find((a) => a.type === "dockerfile")
      expect(dockerfileAlt).toBeDefined()
      expect(dockerfileAlt?.target).toBe("Dockerfile")
    })

    it("matches blocked rule when files match wp-content/ directory structure", async () => {
      const evaluator = new DetectorRuleEvaluator()
      const result = await evaluator.evaluateRepositoryPolicy({
        files: ["wp-content/plugins/akismet/akismet.php", "index.php"],
      })

      expect(result.isBlocked).toBe(true)
      expect(result.ruleCode).toBe("RULE-BLOCK-WP-LEGACY")
    })

    it("matches blocked rule when framework is detected as wordpress", async () => {
      const evaluator = new DetectorRuleEvaluator()
      const result = await evaluator.evaluateRepositoryPolicy({
        files: ["index.php"],
        detectedFramework: "wordpress",
      })

      expect(result.isBlocked).toBe(true)
      expect(result.ruleCode).toBe("RULE-BLOCK-WP-LEGACY")
    })

    it("evaluates custom database DetectorRule with BLOCK status and priority", async () => {
      const customRules = [
        {
          id: "rule-custom-wp",
          name: "RULE-BLOCK-WP-LEGACY",
          description: "Block unmanaged WordPress installations",
          patternJson: { files: ["wp-config.php"] },
          implicationsJson: {
            ruleCode: "RULE-BLOCK-WP-LEGACY",
            status: "blocked",
            impact: "BLOCK",
            action: "BLOCK",
            title: "Custom WordPress Policy",
            reason:
              "Legacy WordPress installations are prohibited on multi-tenant clusters.",
            cveReferences: ["CVE-2024-27956", "CVE-2023-32243"],
            suggestedAlternatives: [
              {
                type: "marketplace" as const,
                title: "Managed WP 1-Click",
                description: "Deploy from Marketplace",
                target: "pfn-app-wordpress",
              },
            ],
          },
          isActive: true,
          priority: 500,
        },
      ]

      const mockDb = createMockDb(customRules)
      const result = await detectorRuleEvaluator.evaluateRepositoryPolicy({
        files: ["wp-config.php"],
        db: mockDb,
      })

      expect(result.isBlocked).toBe(true)
      expect(result.ruleCode).toBe("RULE-BLOCK-WP-LEGACY")
      expect(result.title).toBe("Custom WordPress Policy")
      expect(result.reason).toContain(
        "Legacy WordPress installations are prohibited"
      )
      expect(result.cveReferences).toEqual(["CVE-2024-27956", "CVE-2023-32243"])
      expect(result.suggestedAlternatives?.[0]?.target).toBe(
        "pfn-app-wordpress"
      )
    })

    it("uses default WordPress CVE references and marketplace alternatives when omitted from implications", async () => {
      const customRules = [
        {
          id: "bare_wp_rule",
          name: "WordPress Bare Rule",
          patternJson: { files: ["wp-config.php"] },
          implicationsJson: { action: "BLOCK" },
          isActive: true,
          priority: 200,
        },
      ]
      const mockDb = createMockDb(customRules)
      const result = await detectorRuleEvaluator.evaluateRepositoryPolicy({
        files: ["wp-config.php"],
        db: mockDb,
      })
      expect(result.isBlocked).toBe(true)
      expect(result.cveReferences).toEqual(["CVE-2024-27956", "CVE-2023-32243"])
      expect(result.suggestedAlternatives?.[0]?.type).toBe("marketplace")
    })

    it("evaluates non-WordPress blocking rule with fallback ruleCode, reason, and Dockerfile alternatives", async () => {
      const customRules = [
        {
          id: "banned_script",
          name: "Banned Script Rule",
          patternJson: {
            files: ["   ", "insecure-script.sh"],
          },
          implicationsJson: {
            action: "BLOCK",
            cves: ["CVE-2025-99999"],
          },
          isActive: true,
          priority: 100,
        },
      ]

      const mockDb = createMockDb(customRules)
      const result = await detectorRuleEvaluator.evaluateRepositoryPolicy({
        files: ["nested/dir/insecure-script.sh"],
        db: mockDb,
      })

      expect(result.isBlocked).toBe(true)
      expect(result.ruleCode).toBe("RULE-BLOCK-BANNED_SCRIPT")
      expect(result.title).toBe("Banned Script Rule")
      expect(result.reason).toBe("Deployment blocked by platform policy")
      expect(result.cveReferences).toEqual(["CVE-2025-99999"])
      expect(result.suggestedAlternatives).toEqual([
        {
          type: "dockerfile",
          title: "Containerized Deployment (Dockerfile)",
          description:
            "Package your application inside a custom isolated Dockerfile.",
          target: "Dockerfile",
        },
      ])
    })

    it("matches directory pattern inside nested paths with trailing slash and without trailing slash", async () => {
      const customRules = [
        {
          id: "bad_dir_rule",
          name: "RULE-BLOCK-BAD-DIR",
          patternJson: {
            files: ["bad_dir/", "isolated_dir"],
          },
          implicationsJson: {
            impact: "BLOCK",
            message: "Contains prohibited directory",
          },
          isActive: true,
          priority: 300,
        },
      ]

      const mockDb = createMockDb(customRules)
      const resultWithTrailing =
        await detectorRuleEvaluator.evaluateRepositoryPolicy({
          files: ["apps/api/bad_dir/index.js"],
          db: mockDb,
        })
      expect(resultWithTrailing.isBlocked).toBe(true)
      expect(resultWithTrailing.ruleCode).toBe("RULE-BLOCK-BAD-DIR")
      expect(resultWithTrailing.reason).toBe("Contains prohibited directory")

      const resultWithoutTrailing =
        await detectorRuleEvaluator.evaluateRepositoryPolicy({
          files: ["apps/api/isolated_dir/main.go"],
          db: mockDb,
        })
      expect(resultWithoutTrailing.isBlocked).toBe(true)
    })

    it("matches frameworks through pattern.frameworkId, pattern.frameworks, and implications.framework", async () => {
      const customRules = [
        {
          id: "framework_id_rule",
          name: "RULE-BLOCK-FW-ID",
          patternJson: { frameworkId: "banned_framework_1" },
          implicationsJson: { action: "BLOCK" },
          isActive: true,
          priority: 50,
        },
        {
          id: "frameworks_arr_rule",
          name: "RULE-BLOCK-FW-ARR",
          patternJson: {
            frameworks: ["banned_framework_2", "banned_framework_3"],
          },
          implicationsJson: { action: "BLOCK" },
          isActive: true,
          priority: 60,
        },
        {
          id: "implications_fw_rule",
          name: "RULE-BLOCK-IMP-FW",
          patternJson: {},
          implicationsJson: {
            framework: "banned_framework_4",
            action: "BLOCK",
          },
          isActive: true,
          priority: 70,
        },
      ]

      const mockDb = createMockDb(customRules)
      const res1 = await detectorRuleEvaluator.evaluateRepositoryPolicy({
        files: [],
        detectedFramework: "banned_framework_1",
        db: mockDb,
      })
      expect(res1.isBlocked).toBe(true)
      expect(res1.ruleCode).toBe("RULE-BLOCK-FW-ID")

      const res2 = await detectorRuleEvaluator.evaluateRepositoryPolicy({
        files: [],
        detectedFramework: "banned_framework_2",
        db: mockDb,
      })
      expect(res2.isBlocked).toBe(true)
      expect(res2.ruleCode).toBe("RULE-BLOCK-FW-ARR")

      const res3 = await detectorRuleEvaluator.evaluateRepositoryPolicy({
        files: [],
        detectedFramework: "banned_framework_4",
        db: mockDb,
      })
      expect(res3.isBlocked).toBe(true)
      expect(res3.ruleCode).toBe("RULE-BLOCK-IMP-FW")
    })

    it("skips inactive rules, non-blocking rules (WARN, HINT), and respects priority ordering", async () => {
      const customRules = [
        {
          id: "inactive_rule",
          name: "RULE-INACTIVE",
          patternJson: { files: ["forbidden.txt"] },
          implicationsJson: { action: "BLOCK" },
          isActive: false,
          priority: 999,
        },
        {
          id: "warn_rule",
          name: "RULE-WARN",
          patternJson: { files: ["forbidden.txt"] },
          implicationsJson: { action: "WARN", status: "warning" },
          isActive: true,
          priority: 900,
        },
        {
          id: "hint_rule",
          name: "RULE-HINT",
          patternJson: { files: ["forbidden.txt"] },
          implicationsJson: { action: "HINT", impact: "HINT" },
          isActive: true,
          priority: 850,
        },
        {
          id: "high_priority_block",
          name: "RULE-BLOCK-HIGH",
          patternJson: { files: ["forbidden.txt"] },
          implicationsJson: { action: "BLOCK" },
          isActive: true,
          priority: 200,
        },
        {
          id: "low_priority_block",
          name: "RULE-BLOCK-LOW",
          patternJson: { files: ["forbidden.txt"] },
          implicationsJson: { action: "BLOCK" },
          isActive: true,
          priority: 10,
        },
      ]

      const mockDb = createMockDb(customRules)
      const result = await detectorRuleEvaluator.evaluateRepositoryPolicy({
        files: ["forbidden.txt"],
        db: mockDb,
      })

      expect(result.isBlocked).toBe(true)
      expect(result.ruleCode).toBe("RULE-BLOCK-HIGH")
    })
  })

  describe("createPolicyEvaluationTool - AI SDK Tool Execution", () => {
    it("creates an AI SDK tool definition that executes policy evaluation", async () => {
      const evaluator = new DetectorRuleEvaluator()
      const traceSteps: AiDetectionToolTrace[] = []
      const onStep = (item: AiDetectionToolTrace) => {
        traceSteps.push(item)
      }

      const policyTool = evaluator.createPolicyEvaluationTool(undefined, {
        onStep,
      })

      expect(policyTool).toBeDefined()
      expect(typeof policyTool.execute).toBe("function")
      if (!policyTool.execute) {
        throw new Error("policyTool.execute must be defined")
      }

      // Execute on clean files
      const cleanResult = (await policyTool.execute(
        {
          files: ["package.json", "src/index.ts"],
          framework: "nextjs",
        },
        { toolCallId: "call_clean", messages: [] }
      )) as PolicyRuleEvaluationResult

      expect(cleanResult.isBlocked).toBe(false)
      expect(traceSteps.length).toBe(1)
      expect(traceSteps[0]?.name).toBe("evaluate_detector_rules")
      expect(traceSteps[0]?.outcome).toBe("completed")

      // Execute on blocked WordPress files
      const blockedResult = (await policyTool.execute(
        {
          files: ["wp-config.php"],
        },
        { toolCallId: "call_blocked", messages: [] }
      )) as PolicyRuleEvaluationResult

      expect(blockedResult.isBlocked).toBe(true)
      expect(blockedResult.ruleCode).toBe("RULE-BLOCK-WP-LEGACY")
      expect(traceSteps.length).toBe(2)
      expect(traceSteps[1]?.matchedRuleId).toBe("RULE-BLOCK-WP-LEGACY")

      // Execute without options (no onStep callback) and empty inputs
      const toolWithoutOptions = evaluator.createPolicyEvaluationTool()
      if (!toolWithoutOptions.execute) {
        throw new Error("toolWithoutOptions.execute must be defined")
      }
      const emptyResult = (await toolWithoutOptions.execute(
        {},
        { toolCallId: "call_empty", messages: [] }
      )) as PolicyRuleEvaluationResult
      expect(emptyResult.isBlocked).toBe(false)
    })
  })

  describe("graceful DB failure fallback", () => {
    it("returns isBlocked: false without throwing when DB query fails", async () => {
      const failingDb = {
        detectorRule: {
          findMany: mock(async () => {
            throw new Error("Connection refused: 5432")
          }),
        },
      } as unknown as PrismaClient

      const evaluator = new DetectorRuleEvaluator()
      const result = await evaluator.evaluateRepositoryPolicy({
        files: ["wp-config.php"],
        db: failingDb,
      })

      expect(result).toEqual({ isBlocked: false })
      expect(failingDb.detectorRule.findMany).toHaveBeenCalledTimes(1)
    })

    it("handles database client without detectorRule model gracefully", async () => {
      const emptyDb = {} as unknown as PrismaClient
      const evaluator = new DetectorRuleEvaluator()
      const result = await evaluator.evaluateRepositoryPolicy({
        files: ["package.json"],
        db: emptyDb,
      })

      expect(result.isBlocked).toBe(false)
    })
  })
})
