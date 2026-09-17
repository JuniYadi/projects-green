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
