import { describe, expect, it } from "bun:test"
import { Elysia } from "elysia"

import { createFrameworkDetectionRoutes } from "@/modules/framework-detection/api/framework-detection.route"
import type { DetectionResult } from "@/modules/framework-detection/framework-detection.types"

const createMockDetectionResult = (
  frameworkId: string = "laravel"
): DetectionResult => ({
  primaryFramework: {
    id: frameworkId,
    name: frameworkId === "laravel" ? "Laravel" : "Next.js",
    ecosystem: frameworkId === "laravel" ? "php" : "node",
    confidence: 0.92,
    reasons: ["artisan file exists"],
  },
  requiredDependencies: [
    {
      id: "node",
      kind: "toolchain",
      requiredFor: "asset_build",
      confidence: 0.9,
      reason: "Node lockfile present",
    },
  ],
  alternatives: [],
  confidence: 0.92,
  decision: {
    status: "success",
    message: "Ready to deploy.",
    isLaunchable: true,
  },
  evidence: [],
  warnings: [],
  source: {
    repoUrl: "https://example.com/repo.git",
  },
})

describe("frameworkDetectionRoutes", () => {
  describe("POST /framework-detection (Git Clone Mode)", () => {
    it("returns 400 for invalid payload", async () => {
      const app = new Elysia().use(
        createFrameworkDetectionRoutes(async () => {
          throw new Error("should not be called")
        })
      )

      const response = await app.handle(
        new Request("http://localhost/framework-detection", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            repoUrl: "not-a-url",
          }),
        })
      )

      const body = (await response.json()) as {
        ok: boolean
        error: string
        fieldErrors?: Record<string, string[]>
      }

      expect(response.status).toBe(400)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INVALID_PAYLOAD")
      expect(body.fieldErrors?.repoUrl?.length).toBeGreaterThan(0)
    })

    it("returns detection output for valid payload", async () => {
      const app = new Elysia().use(
        createFrameworkDetectionRoutes(async () =>
          createMockDetectionResult("laravel")
        )
      )

      const response = await app.handle(
        new Request("http://localhost/framework-detection", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            repoUrl: "https://example.com/repo.git",
          }),
        })
      )

      const body = (await response.json()) as {
        ok: boolean
        primaryFramework?: { id: string }
        requiredDependencies?: Array<{ id: string }>
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.primaryFramework?.id).toBe("laravel")
      expect(body.requiredDependencies?.[0]?.id).toBe("node")
    })

    it("returns 422 when detection fails", async () => {
      const app = new Elysia().use(
        createFrameworkDetectionRoutes(async () => {
          throw new Error("Repository not found")
        })
      )

      const response = await app.handle(
        new Request("http://localhost/framework-detection", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            repoUrl: "https://example.com/repo.git",
          }),
        })
      )

      const body = (await response.json()) as {
        ok: boolean
        error: string
        message: string
      }

      expect(response.status).toBe(422)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("DETECTION_FAILED")
      expect(body.message).toBe("Repository not found")
    })
  })

  describe("POST /framework-detection/github (GitHub API Mode)", () => {
    it("returns 400 for invalid payload", async () => {
      const app = new Elysia().use(
        createFrameworkDetectionRoutes(
          async () => {
            throw new Error("should not be called")
          },
          async () => {
            throw new Error("should not be called")
          }
        )
      )

      const response = await app.handle(
        new Request("http://localhost/framework-detection/github", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            owner: "test-org",
            // Missing required fields
          }),
        })
      )

      const body = (await response.json()) as {
        ok: boolean
        error: string
        fieldErrors?: Record<string, string[]>
      }

      expect(response.status).toBe(400)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INVALID_PAYLOAD")
    })

    it("returns detection output for valid GitHub API payload", async () => {
      const app = new Elysia().use(
        createFrameworkDetectionRoutes(
          async () => {
            throw new Error("should not be called")
          },
          async () => createMockDetectionResult("nextjs")
        )
      )

      const response = await app.handle(
        new Request("http://localhost/framework-detection/github", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            installationId: 12345,
            owner: "test-org",
            repo: "test-repo",
          }),
        })
      )

      const body = (await response.json()) as {
        ok: boolean
        primaryFramework?: { id: string }
        requiredDependencies?: Array<{ id: string }>
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.primaryFramework?.id).toBe("nextjs")
      expect(body.requiredDependencies?.[0]?.id).toBe("node")
    })

    it("returns 422 when GitHub API detection fails", async () => {
      const app = new Elysia().use(
        createFrameworkDetectionRoutes(
          async () => {
            throw new Error("should not be called")
          },
          async () => {
            throw new Error("GitHub API rate limit exceeded")
          }
        )
      )

      const response = await app.handle(
        new Request("http://localhost/framework-detection/github", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            installationId: 12345,
            owner: "test-org",
            repo: "test-repo",
          }),
        })
      )

      const body = (await response.json()) as {
        ok: boolean
        error: string
        message: string
      }

      expect(response.status).toBe(422)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("DETECTION_FAILED")
      expect(body.message).toBe("GitHub API rate limit exceeded")
    })
  })
})
