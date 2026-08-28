import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"

// ── Mock admin guards ───────────────────────────────────

let mockAdminResult: { ok: boolean; error?: string; message?: string } = {
  ok: true,
}

const mockRequireSuperAdmin = mock(
  async (set: { status?: number | string }) => {
    if (!mockAdminResult.ok) {
      set.status = 403
      return mockAdminResult
    }
    return { ok: true, user: { id: "admin_user_1" } }
  }
)

mock.module("@/modules/admin/api/admin.guards", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}))

// ── Mock workos-directory ───────────────────────────────

const mockGetCachedUsers = mock()
const mockGetCachedOrganizations = mock()

mock.module("@/lib/workos-directory", () => ({
  getCachedUsers: mockGetCachedUsers,
  getCachedOrganizations: mockGetCachedOrganizations,
}))

// ── Import route after mocks ────────────────────────────

const { createWorkOSDirectoryRoutes } = await import("./workos-directory.route")

const app = new Elysia().use(createWorkOSDirectoryRoutes()).compile()

describe("WorkOSDirectoryRoute POST /workos-directory/resolve", () => {
  beforeEach(() => {
    mockAdminResult = { ok: true }
    mockRequireSuperAdmin.mockClear()
    mockGetCachedUsers.mockReset()
    mockGetCachedOrganizations.mockReset()
  })

  it("returns 403 when not super admin", async () => {
    mockAdminResult = {
      ok: false,
      error: "SUPER_ADMIN_REQUIRED",
      message: "Super admin access required.",
    }

    const res = await app.handle(
      new Request("http://localhost/workos-directory/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: ["user_1"] }),
      })
    )

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("SUPER_ADMIN_REQUIRED")
  })

  it("returns 422 for invalid request body shape", async () => {
    const res = await app.handle(
      new Request("http://localhost/workos-directory/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: "not-an-array" }),
      })
    )

    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json).toBeDefined()
  })

  it("resolves empty lists to empty maps without calling directory functions", async () => {
    const res = await app.handle(
      new Request("http://localhost/workos-directory/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.users).toEqual({})
    expect(json.orgs).toEqual({})
    expect(mockGetCachedUsers).not.toHaveBeenCalled()
    expect(mockGetCachedOrganizations).not.toHaveBeenCalled()
  })

  it("resolves users and organizations successfully", async () => {
    const userMap = new Map([
      [
        "user_1",
        {
          id: "user_1",
          name: "Alice",
          email: "alice@example.com",
          avatarUrl: "https://avatar.com/1.png",
        },
      ],
    ])
    const orgMap = new Map([
      [
        "org_1",
        {
          id: "org_1",
          name: "Acme Corp",
        },
      ],
    ])

    mockGetCachedUsers.mockResolvedValueOnce(userMap)
    mockGetCachedOrganizations.mockResolvedValueOnce(orgMap)

    const res = await app.handle(
      new Request("http://localhost/workos-directory/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: ["user_1"],
          orgIds: ["org_1"],
        }),
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.users.user_1).toEqual({
      id: "user_1",
      name: "Alice",
      email: "alice@example.com",
      avatarUrl: "https://avatar.com/1.png",
    })
    expect(json.orgs.org_1).toEqual({
      id: "org_1",
      name: "Acme Corp",
    })
    expect(mockGetCachedUsers).toHaveBeenCalledWith(["user_1"])
    expect(mockGetCachedOrganizations).toHaveBeenCalledWith(["org_1"])
  })
})
