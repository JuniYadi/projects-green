import { describe, expect, it } from "bun:test"
import type { Prisma } from "@prisma/client"

import {
  toDetectedFrameworkDTO,
  toRequiredDependencyDTO,
  toDetectionEvidenceDTO,
  toDetectionResultDTO,
  toInspectionLogDTO,
  toRuntimeMappingDTO,
  toDetectorRuleDTO,
} from "@/modules/framework-detection/framework-detection.dto"
import type {
  DetectedFramework,
  RequiredDependency,
  DetectionEvidence,
  DetectionResult,
} from "@/modules/framework-detection/framework-detection.types"

describe("framework-detection.dto", () => {
  describe("toDetectedFrameworkDTO", () => {
    it("maps DetectedFramework to DTO", () => {
      const input: DetectedFramework = {
        id: "laravel",
        name: "Laravel",
        ecosystem: "php",
        confidence: 0.92,
        reasons: ["artisan file exists", "composer.json present"],
      }

      const result = toDetectedFrameworkDTO(input)

      expect(result).toEqual({
        id: "laravel",
        name: "Laravel",
        ecosystem: "php",
        confidence: 0.92,
        reasons: ["artisan file exists", "composer.json present"],
      })
    })
  })

  describe("toRequiredDependencyDTO", () => {
    it("maps RequiredDependency to DTO", () => {
      const input: RequiredDependency = {
        id: "node",
        kind: "runtime",
        requiredFor: "app_runtime",
        confidence: 0.9,
        reason: "JavaScript lockfile detected",
      }

      const result = toRequiredDependencyDTO(input)

      expect(result).toEqual({
        id: "node",
        kind: "runtime",
        requiredFor: "app_runtime",
        confidence: 0.9,
        reason: "JavaScript lockfile detected",
      })
    })
  })

  describe("toDetectionEvidenceDTO", () => {
    it("maps DetectionEvidence to DTO", () => {
      const input: DetectionEvidence = {
        type: "file",
        value: "package.json",
        detail: "Node.js manifest",
      }

      const result = toDetectionEvidenceDTO(input)

      expect(result).toEqual({
        type: "file",
        value: "package.json",
        detail: "Node.js manifest",
      })
    })

    it("handles missing detail", () => {
      const input: DetectionEvidence = {
        type: "lockfile",
        value: "bun.lock",
      }

      const result = toDetectionEvidenceDTO(input)

      expect(result).toEqual({
        type: "lockfile",
        value: "bun.lock",
        detail: undefined,
      })
    })
  })

  describe("toDetectionResultDTO", () => {
    it("maps DetectionResult to DTO", () => {
      const input: DetectionResult = {
        primaryFramework: {
          id: "nextjs",
          name: "Next.js",
          ecosystem: "node",
          confidence: 0.95,
          reasons: ["next dependency found"],
        },
        requiredDependencies: [
          {
            id: "node",
            kind: "runtime",
            requiredFor: "app_runtime",
            confidence: 0.9,
            reason: "Node runtime required",
          },
        ],
        alternatives: [
          {
            id: "react",
            name: "React",
            ecosystem: "node",
            confidence: 0.3,
            reasons: ["react dependency"],
          },
        ],
        confidence: 0.95,
        decision: {
          status: "success",
          message: "Ready to deploy.",
          isLaunchable: true,
        },
        evidence: [
          {
            type: "dependency",
            value: "next",
            detail: "package.json dependency",
          },
        ],
        warnings: [],
        source: {
          repoUrl: "https://github.com/org/repo",
          ref: "main",
          subdir: "frontend",
        },
      }

      const result = toDetectionResultDTO(input)

      expect(result.primaryFramework?.id).toBe("nextjs")
      expect(result.requiredDependencies).toHaveLength(1)
      expect(result.requiredDependencies[0].id).toBe("node")
      expect(result.alternatives).toHaveLength(1)
      expect(result.alternatives[0].id).toBe("react")
      expect(result.evidence).toHaveLength(1)
      expect(result.source.repoUrl).toBe("https://github.com/org/repo")
      expect(result.decision).toEqual({
        status: "success",
        message: "Ready to deploy.",
        isLaunchable: true,
      })
    })

    it("handles null primaryFramework", () => {
      const input: DetectionResult = {
        primaryFramework: null,
        requiredDependencies: [],
        alternatives: [],
        confidence: 0,
        decision: {
          status: "unsupported",
          message: "We couldn't verify a supported framework in this repository.",
          isLaunchable: false,
        },
        evidence: [],
        warnings: ["No framework detected"],
        source: {
          repoUrl: "https://github.com/org/repo",
        },
      }

      const result = toDetectionResultDTO(input)

      expect(result.primaryFramework).toBeNull()
      expect(result.confidence).toBe(0)
      expect(result.warnings).toEqual(["No framework detected"])
      expect(result.decision.status).toBe("unsupported")
      expect(result.decision.isLaunchable).toBe(false)
    })
  })

  describe("toInspectionLogDTO", () => {
    it("maps InspectionLog to DTO", () => {
      const input: Prisma.DetectorInspectionLogGetPayload<object> = {
        id: "log-123",
        installationId: BigInt(12345),
        repoUrl: "https://github.com/org/repo",
        ref: "main",
        detectedFramework: "laravel",
        confidence: 0.92,
        enforcedRuntimes: [{ runtimeId: "php", version: "8.2" }],
        toolCalls: [],
        reasoning: ["artisan found"],
        warnings: [],
        durationMs: 1500,
        status: "success",
        blockedByRuleId: null,
        errorMessage: null,
        createdAt: new Date("2026-01-01"),
      }

      const result = toInspectionLogDTO(input)

      expect(result.id).toBe("log-123")
      expect(result.detectedFramework).toBe("laravel")
      expect(result.enforcedRuntimes).toEqual([{ runtimeId: "php", version: "8.2" }])
      expect(result.status).toBe("success")
    })
  })

  describe("toRuntimeMappingDTO", () => {
    it("maps RuntimeMapping to DTO", () => {
      const input: Prisma.DetectorRuntimeMappingGetPayload<object> = {
        id: "mapping-1",
        frameworkId: "laravel",
        frameworkVersion: "10",
        runtimeId: "php",
        runtimeVersion: "8.2",
        buildVersion: "node-20",
        isActive: true,
        priority: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = toRuntimeMappingDTO(input)

      expect(result).toEqual({
        id: "mapping-1",
        frameworkId: "laravel",
        frameworkVersion: "10",
        runtimeId: "php",
        runtimeVersion: "8.2",
        buildVersion: "node-20",
        isActive: true,
        priority: 10,
      })
    })

    it("handles null frameworkVersion", () => {
      const input: Prisma.DetectorRuntimeMappingGetPayload<object> = {
        id: "mapping-2",
        frameworkId: "nextjs",
        frameworkVersion: null,
        runtimeId: "node",
        runtimeVersion: "20",
        buildVersion: null,
        isActive: true,
        priority: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = toRuntimeMappingDTO(input)

      expect(result.frameworkVersion).toBeNull()
      expect(result.buildVersion).toBeNull()
    })
  })

  describe("toDetectorRuleDTO", () => {
    it("maps DetectorRule to DTO", () => {
      const input: Prisma.DetectorRuleGetPayload<object> = {
        id: "rule-1",
        name: "Laravel Artisan Rule",
        description: "Detect Laravel by artisan file",
        patternJson: { files: ["artisan"] },
        implicationsJson: { framework: "laravel", impact: "HINT" },
        confidenceWeight: 0.9,
        isActive: true,
        priority: 10,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
      }

      const result = toDetectorRuleDTO(input)

      expect(result).toEqual({
        id: "rule-1",
        name: "Laravel Artisan Rule",
        description: "Detect Laravel by artisan file",
        patternJson: { files: ["artisan"] },
        implicationsJson: { framework: "laravel", impact: "HINT" },
        confidenceWeight: 0.9,
        isActive: true,
        priority: 10,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
      })
    })

    it("handles null description", () => {
      const input: Prisma.DetectorRuleGetPayload<object> = {
        id: "rule-2",
        name: "Block Rule",
        description: null,
        patternJson: { files: ["blocked.txt"] },
        implicationsJson: { impact: "BLOCK" },
        confidenceWeight: 1.0,
        isActive: false,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = toDetectorRuleDTO(input)

      expect(result.description).toBeNull()
      expect(result.isActive).toBe(false)
    })
  })
})
