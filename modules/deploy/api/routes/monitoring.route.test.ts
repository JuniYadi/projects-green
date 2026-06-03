import { describe, expect, it, mock, beforeEach } from "bun:test"
import { monitoringRoutes } from "./monitoring.route"

// Mock withAuth to return authenticated user with orgSlug
const mockWithAuth = mock(async () => ({
  user: {
    id: "user-123",
    email: "test@example.com",
    metadata: { orgSlug: "test-org" } as Record<string, string>,
  },
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

const buildRequest = (path: string) =>
  new Request(`http://localhost${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
  })

describe("monitoringRoutes", () => {
  beforeEach(() => {
    mockWithAuth.mockClear()
  })

  it("returns logs for a deployment", async () => {
    const response = await monitoringRoutes.handle(
      buildRequest("/deploy/logs/deploy-123")
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean; data: unknown[] }
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
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

  it("returns 403 for logs when orgSlug is missing from metadata", async () => {
    mockWithAuth.mockResolvedValueOnce({
      user: {
        id: "user-123",
        email: "test@example.com",
        metadata: {} as Record<string, string>,
      },
    })

    const response = await monitoringRoutes.handle(
      buildRequest("/deploy/logs/deploy-123")
    )

    expect(response.status).toBe(403)
    const body = (await response.json()) as { error: string }
    expect(body.error).toBe("FORBIDDEN")
  })
})
