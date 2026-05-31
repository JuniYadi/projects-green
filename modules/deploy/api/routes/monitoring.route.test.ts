import { Elysia } from "elysia"
import { describe, expect, it } from "bun:test"
import { monitoringRoutes } from "./monitoring.route"

const buildRequest = (path: string) =>
  new Request(`http://localhost${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
  })

describe("monitoringRoutes", () => {
  it("returns logs for a deployment", async () => {
    const response = await monitoringRoutes.handle(
      buildRequest("/deploy/logs/deploy-123")
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean; data: unknown[] }
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeGreaterThan(0)
  })

  it("returns events for a deployment", async () => {
    const response = await monitoringRoutes.handle(
      buildRequest("/deploy/events/deploy-123")
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean; data: unknown[] }
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
  })

  it("returns status for a deployment", async () => {
    const response = await monitoringRoutes.handle(
      buildRequest("/deploy/status/deploy-123")
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      ok: boolean
      data: { status: string }
    }
    expect(body.ok).toBe(true)
    expect(body.data.status).toBeDefined()
  })
})
