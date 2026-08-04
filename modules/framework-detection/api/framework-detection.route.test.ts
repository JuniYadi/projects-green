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

    it("returns classified safe provider failure with inspection log correlation", async () => {
      const app = new Elysia().use(
        createFrameworkDetectionRoutes(
          async () => {
            throw new Error("should not be called")
          },
          async () => {
            throw Object.assign(
              new Error(
                "The detection provider is unavailable. Configure build settings manually."
              ),
              {
                code: "DETECTION_TRANSIENT_PROVIDER_ERROR",
                inspectionLogId: "inspection-123",
                rawBody: '{"api_key":"secret"}',
              }
            )
          }
        )
      )

      const response = await app.handle(
        new Request("http://localhost/framework-detection/github", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        inspectionLogId?: string
      }

      expect(response.status).toBe(422)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("DETECTION_TRANSIENT_PROVIDER_ERROR")
      expect(body.message).toBe(
        "The detection provider is unavailable. Configure build settings manually."
      )
      expect(body.inspectionLogId).toBe("inspection-123")
      expect(JSON.stringify(body)).not.toContain("secret")
    })
    it("hides verbose AI schema details from API errors", async () => {
      const app = new Elysia().use(
        createFrameworkDetectionRoutes(
          async () => {
            throw new Error("should not be called")
          },
          async () => {
            throw Object.assign(
              new Error(
                "Automatic detection could not validate the AI response. Retry detection or configure build settings manually."
              ),
              {
                code: "DETECTION_SCHEMA_ERROR",
                inspectionLogId: "inspection-schema",
              }
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
        inspectionLogId?: string
      }

      expect(response.status).toBe(422)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("DETECTION_SCHEMA_ERROR")
      expect(body.inspectionLogId).toBe("inspection-schema")
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
            throw Object.assign(
              new Error(
                "Automatic detection could not validate the AI response. Retry detection or configure build settings manually."
              ),
              { code: "DETECTION_SCHEMA_ERROR" }
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
      expect(body.error).toBe("DETECTION_SCHEMA_ERROR")
      expect(body.message).toBe(
        "Automatic detection could not validate the AI response. Retry detection or configure build settings manually."
      )
    })
    it.each([
      [
        "config",
        "OPENAI_API_KEY is not configured",
        "DETECTION_CONFIG_ERROR",
        "Automatic detection is not configured. Configure build settings manually.",
      ],
      [
        "schema",
        "invalid decision schema",
        "DETECTION_SCHEMA_ERROR",
        "Automatic detection could not validate the AI response. Retry detection or configure build settings manually.",
      ],
      [
        "transient",
        "request timeout",
        "DETECTION_TRANSIENT_PROVIDER_ERROR",
        "Automatic detection provider is temporarily unavailable. Retry detection or configure build settings manually.",
      ],
      [
        "provider",
        "provider returned error",
        "DETECTION_PROVIDER_ERROR",
        "Unable to detect frameworks for this repository.",
      ],
    ] as const)(
      "classifies %s heuristic failures safely",
      async (_name, message, error, safeMessage) => {
        const app = new Elysia().use(
          createFrameworkDetectionRoutes(
            async () => {
              throw new Error("should not be called")
            },
            async () => {
              throw new Error(message)
            }
          )
        )

        const response = await app.handle(
          new Request("http://localhost/framework-detection/github", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
        expect(body.error).toBe(error)
        expect(body.message).toBe(safeMessage)
      }
    )

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
    it.each(["unsupported", "low_confidence"] as const)(
      "returns %s policy verdict as ok true",
      async (status) => {
        const app = new Elysia().use(
          createFrameworkDetectionRoutes(
            async () => {
              throw new Error("should not be called")
            },
            async () => ({
              ...createMockDetectionResult("unknown"),
              primaryFramework: null,
              confidence: status === "unsupported" ? 0 : 0.4,
              decision: {
                status,
                message:
                  status === "unsupported"
                    ? "No supported framework detected."
                    : "Detection confidence is too low.",
                isLaunchable: false,
              },
              evidence: [
                {
                  type: "file" as const,
                  value: "composer.json",
                  detail: "root",
                },
              ],
            })
          )
        )

        const response = await app.handle(
          new Request("http://localhost/framework-detection/github", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              installationId: 12345,
              owner: "test-org",
              repo: "test-repo",
            }),
          })
        )
        const body = (await response.json()) as {
          ok: boolean
          decision?: { status: string; message: string }
          evidence?: Array<{ value: string }>
        }

        expect(response.status).toBe(200)
        expect(body.ok).toBe(true)
        expect(body.decision?.status).toBe(status)
        expect(body.evidence?.[0]?.value).toBe("composer.json")
      }
    )
  })
})
