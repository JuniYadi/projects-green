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
    it("hides verbose AI schema details from API errors", async () => {
      const app = new Elysia().use(
        createFrameworkDetectionRoutes(
          async () => {
            throw new Error("should not be called")
          },
          async () => {
            throw new Error(
              'Detection failed: AI returned an invalid decision schema: [{"path":["confidence"]}]'
            )
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

      const body = (await response.json()) as { message: string }

      expect(body.message).toBe(
        "Automatic detection could not validate the AI response. Retry detection or configure build settings manually."
      )
    })

    it("returns 422 when AI resolver throws invalid schema with active rules", async () => {
      const app = new Elysia().use(
        createFrameworkDetectionRoutes(
          async () => {
            throw new Error("should not be called")
          },
          async () => {
            throw new Error(
              "Detection failed: invalid-schema: missing primaryFrameworkId"
            )
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
      expect(body.message).toContain("Detection failed")
    })

    it("returns blocked result when BLOCK rule matches without calling AI", async () => {
      const app = new Elysia().use(
        createFrameworkDetectionRoutes(
          async () => {
            throw new Error("should not be called")
          },
          async () => ({
            primaryFramework: {
              id: "wordpress",
              name: "WordPress",
              ecosystem: "php",
              confidence: 0,
              reasons: ["Blocked by admin rule: Block WordPress"],
            },
            requiredDependencies: [],
            alternatives: [],
            confidence: 0,
            decision: {
              status: "blocked",
              message: "Deployment blocked by admin rule: Block WordPress",
              isLaunchable: false,
            },
            evidence: [
              {
                type: "file",
                value: "blocked",
                detail:
                  'Blocked by rule "Block WordPress": matched files wp-config.php',
              },
            ],
            warnings: ["Framework blocked by rule: Block WordPress"],
            source: {
              repoUrl: "https://github.com/test-org/test-repo",
              ref: "main",
            },
          })
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
        decision?: { status: string; isLaunchable: boolean }
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.primaryFramework?.id).toBe("wordpress")
      expect(body.decision?.status).toBe("blocked")
      expect(body.decision?.isLaunchable).toBe(false)
    })

    it("returns success result when HINT rule is advisory and AI resolves", async () => {
      const app = new Elysia().use(
        createFrameworkDetectionRoutes(
          async () => {
            throw new Error("should not be called")
          },
          async () => ({
            primaryFramework: {
              id: "laravel",
              name: "Laravel",
              ecosystem: "php",
              confidence: 0.95,
              reasons: ["artisan and composer.json found"],
            },
            requiredDependencies: [
              {
                id: "php",
                kind: "runtime",
                requiredFor: "app_runtime",
                confidence: 0.95,
                reason: "AI agent identified this runtime requirement",
              },
            ],
            alternatives: [],
            confidence: 0.95,
            decision: {
              status: "success",
              message: "Ready to deploy.",
              isLaunchable: true,
            },
            evidence: [
              {
                type: "ai",
                value: "tool-calling-detection",
                detail: "AI agent selected laravel with confidence 0.95",
              },
            ],
            warnings: [],
            source: {
              repoUrl: "https://github.com/test-org/test-repo",
              ref: "main",
            },
          })
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
        decision?: { status: string; isLaunchable: boolean }
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.primaryFramework?.id).toBe("laravel")
      expect(body.decision?.status).toBe("success")
      expect(body.decision?.isLaunchable).toBe(true)
    })
  })
})
