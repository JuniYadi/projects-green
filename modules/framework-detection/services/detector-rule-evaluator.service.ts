import type { PrismaClient } from "@prisma/client"
import { tool } from "ai"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { AiDetectionToolTrace } from "../framework-detection.trace"

export type PolicyRuleEvaluationResult = {
  isBlocked: boolean
  ruleCode?: string
  title?: string
  reason?: string
  cveReferences?: string[]
  suggestedAlternatives?: Array<{
    type: "marketplace" | "dockerfile" | "version_upgrade"
    title: string
    description: string
    target?: string
  }>
}

type DetectorRulePattern = {
  files?: string[]
  framework?: string
  frameworkId?: string
  frameworks?: string[]
  dependencies?: string[]
}

type DetectorRuleImplications = {
  impact?: string
  status?: string
  action?: string
  framework?: string
  ruleCode?: string
  code?: string
  title?: string
  reason?: string
  message?: string
  cveReferences?: string[]
  cves?: string[]
  suggestedAlternatives?: PolicyRuleEvaluationResult["suggestedAlternatives"]
  alternatives?: PolicyRuleEvaluationResult["suggestedAlternatives"]
}

type DetectorRuleRecord = {
  id: string
  name: string
  description?: string | null
  patternJson: unknown
  implicationsJson: unknown
  isActive: boolean
  priority: number
}

const DEFAULT_WP_BLOCK_RULE: DetectorRuleRecord = {
  id: "rule-block-wp-legacy",
  name: "RULE-BLOCK-WP-LEGACY",
  description: "Block unmanaged legacy PHP/WordPress standalone code",
  patternJson: {
    files: ["wp-config.php", "wp-content/"],
    framework: "wordpress",
  },
  implicationsJson: {
    ruleCode: "RULE-BLOCK-WP-LEGACY",
    status: "blocked",
    impact: "BLOCK",
    action: "BLOCK",
    title: "Block unmanaged legacy PHP/WordPress standalone code",
    reason: "Ditemukan file wp-config.php dan core lama yang rentan CVE.",
    cveReferences: ["CVE-2024-27956", "CVE-2023-32243"],
    suggestedAlternatives: [
      {
        type: "marketplace",
        title: "1-Click Managed WordPress",
        description:
          "Gunakan 1-Click Managed WordPress di App Marketplace (/console/app/marketplace).",
        target: "pfn-app-wordpress",
      },
      {
        type: "dockerfile",
        title: "Isolated Custom Dockerfile",
        description:
          "Bungkus aplikasi Anda ke dalam Dockerfile yang terisolasi dengan aman.",
        target: "Dockerfile",
      },
    ],
  },
  priority: 200,
  isActive: true,
}

export class DetectorRuleEvaluator {
  async evaluateRepositoryPolicy(params: {
    files: string[]
    detectedFramework?: string
    db?: PrismaClient
  }): Promise<PolicyRuleEvaluationResult> {
    const { files = [], detectedFramework, db } = params

    let rules: DetectorRuleRecord[] = []
    let dbFailed = false

    try {
      if (db) {
        if (db.detectorRule?.findMany) {
          rules = (await db.detectorRule.findMany({
            where: { isActive: true },
            orderBy: { priority: "desc" },
          })) as DetectorRuleRecord[]
        }
      } else {
        try {
          if (prisma?.detectorRule?.findMany) {
            rules = (await prisma.detectorRule.findMany({
              where: { isActive: true },
              orderBy: { priority: "desc" },
            })) as DetectorRuleRecord[]
          }
        } catch {
          rules = [DEFAULT_WP_BLOCK_RULE]
        }
      }
    } catch (error) {
      dbFailed = true
      console.warn(
        "DetectorRuleEvaluator: failed to load detector rules from database",
        error
      )
    }

    if (dbFailed) {
      return { isBlocked: false }
    }

    if (rules.length === 0) {
      rules = [DEFAULT_WP_BLOCK_RULE]
    }

    const sortedRules = [...rules].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    )

    for (const rule of sortedRules) {
      if (rule.isActive === false) continue

      const implications = (rule.implicationsJson ??
        {}) as DetectorRuleImplications
      const status = String(implications.status ?? "").toLowerCase()
      const impact = String(implications.impact ?? "").toUpperCase()
      const action = String(implications.action ?? "").toUpperCase()
      const isBlocking =
        status === "blocked" || impact === "BLOCK" || action === "BLOCK"

      if (!isBlocking) continue

      const pattern = (rule.patternJson ?? {}) as DetectorRulePattern
      let matches = false

      if (detectedFramework) {
        const fw = detectedFramework.toLowerCase()
        const pFw =
          typeof pattern.framework === "string"
            ? pattern.framework.toLowerCase()
            : null
        const pFwId =
          typeof pattern.frameworkId === "string"
            ? pattern.frameworkId.toLowerCase()
            : null
        const iFw =
          typeof implications.framework === "string"
            ? implications.framework.toLowerCase()
            : null
        const pFws = Array.isArray(pattern.frameworks)
          ? pattern.frameworks.map((f) => String(f).toLowerCase())
          : []

        if (pFw === fw || pFwId === fw || iFw === fw || pFws.includes(fw)) {
          matches = true
        }
      }

      if (
        !matches &&
        Array.isArray(pattern.files) &&
        pattern.files.length > 0
      ) {
        for (const patternFile of pattern.files) {
          const rawPattern = String(patternFile).trim()
          if (!rawPattern) continue

          const matched = files.some((repoFile) => {
            if (repoFile === rawPattern) return true
            if (repoFile.endsWith(`/${rawPattern}`)) return true
            if (
              rawPattern.endsWith("/") &&
              (repoFile.startsWith(rawPattern) ||
                repoFile.includes(`/${rawPattern}`))
            ) {
              return true
            }
            if (
              !rawPattern.endsWith("/") &&
              (repoFile.startsWith(`${rawPattern}/`) ||
                repoFile.includes(`/${rawPattern}/`))
            ) {
              return true
            }
            return false
          })

          if (matched) {
            matches = true
            break
          }
        }
      }

      if (matches) {
        let ruleCode =
          implications.ruleCode ??
          implications.code ??
          (rule.name.startsWith("RULE-") ? rule.name : undefined)

        const isWp =
          rule.name.toLowerCase().includes("wordpress") ||
          ruleCode?.toLowerCase().includes("wp") ||
          (Array.isArray(pattern.files) &&
            pattern.files.some((f) => String(f).includes("wp-"))) ||
          detectedFramework?.toLowerCase() === "wordpress"

        if (!ruleCode) {
          ruleCode = isWp
            ? "RULE-BLOCK-WP-LEGACY"
            : `RULE-BLOCK-${rule.id.toUpperCase()}`
        }

        const title =
          implications.title ??
          rule.name ??
          "Deployment Blocked by Platform Policy"

        const reason =
          implications.reason ??
          implications.message ??
          rule.description ??
          (isWp
            ? "Ditemukan file wp-config.php dan core lama yang rentan CVE."
            : "Deployment blocked by platform policy")

        let cveReferences = Array.isArray(implications.cveReferences)
          ? implications.cveReferences
          : Array.isArray(implications.cves)
            ? implications.cves
            : []

        if (cveReferences.length === 0 && isWp) {
          cveReferences = ["CVE-2024-27956", "CVE-2023-32243"]
        }

        let suggestedAlternatives =
          implications.suggestedAlternatives ?? implications.alternatives

        if (!suggestedAlternatives || suggestedAlternatives.length === 0) {
          if (isWp) {
            suggestedAlternatives = [
              {
                type: "marketplace",
                title: "1-Click Managed WordPress",
                description:
                  "Gunakan 1-Click Managed WordPress di App Marketplace (/console/app/marketplace).",
                target: "pfn-app-wordpress",
              },
              {
                type: "dockerfile",
                title: "Containerized Deployment (Dockerfile)",
                description:
                  "Bungkus aplikasi Anda ke dalam Dockerfile yang terisolasi dengan aman.",
                target: "Dockerfile",
              },
            ]
          } else {
            suggestedAlternatives = [
              {
                type: "dockerfile",
                title: "Containerized Deployment (Dockerfile)",
                description:
                  "Package your application inside a custom isolated Dockerfile.",
                target: "Dockerfile",
              },
            ]
          }
        }

        return {
          isBlocked: true,
          ruleCode,
          title,
          reason,
          cveReferences,
          suggestedAlternatives,
        }
      }
    }

    return { isBlocked: false }
  }

  createPolicyEvaluationTool(
    db?: PrismaClient,
    options?: { onStep?: (traceItem: AiDetectionToolTrace) => void }
  ) {
    return tool({
      description:
        "Evaluate repository files and detected framework against platform security and deployment governance rules.",
      inputSchema: z.object({
        files: z
          .array(z.string())
          .optional()
          .describe("List of relative file paths in the repository"),
        framework: z
          .string()
          .optional()
          .describe(
            "Detected framework identifier (e.g. 'wordpress', 'nextjs')"
          ),
      }),
      execute: async ({
        files,
        framework,
      }: {
        files?: string[]
        framework?: string
      }): Promise<PolicyRuleEvaluationResult> => {
        const start = Date.now()
        const result = await this.evaluateRepositoryPolicy({
          files: files ?? [],
          detectedFramework: framework,
          db,
        })
        const durationMs = Date.now() - start
        options?.onStep?.({
          name: "evaluate_detector_rules",
          inputSummary: {
            fileCount: files?.length ?? 0,
            framework,
          },
          outcome: "completed",
          status: "completed",
          durationMs,
          matchedRuleId: result.ruleCode,
        })
        return result
      },
    })
  }
}

export const detectorRuleEvaluator = new DetectorRuleEvaluator()
