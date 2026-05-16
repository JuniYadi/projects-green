import { describe, expect, it } from "bun:test"
import { Elysia } from "elysia"

import { createFrameworkDetectionRoutes } from "@/modules/framework-detection/api/framework-detection.route"

describe("frameworkDetectionRoutes", () => {
  it("returns 400 for invalid payload", async () => {
    const app = new Elysia().use(createFrameworkDetectionRoutes(async () => {
      throw new Error("should not be called")
    }))

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
      createFrameworkDetectionRoutes(async () => ({
        primaryFramework: {
          id: "laravel",
          name: "Laravel",
          ecosystem: "php",
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
        evidence: [],
        warnings: [],
        source: {
          repoUrl: "https://example.com/repo.git",
        },
      }))
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
})
