import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"

// ── Mock AuthKit, Prisma, and Services ─────────────────

const mockAuth: {
  user: { id: string; email: string } | null
  organizationId: string | null
} = {
  user: { id: "user_1", email: "user@example.com" },
  organizationId: "org_1",
}

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mock(async () => mockAuth),
}))

const mockPrisma = {
  applicationStack: {
    findFirst: mock(),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const mockCheckPublicSourceUpdate = mock()

mock.module("../../public-source.service", () => ({
  checkPublicSourceUpdate: mockCheckPublicSourceUpdate,
}))

// Test seam: dynamic import after mock.module to ensure mock resolution
const { publicSourceRoutes } = await import("./public-source.route")

describe("publicSourceRoutes", () => {
  const app = new Elysia().use(publicSourceRoutes).compile()

  beforeEach(() => {
    mockAuth.user = { id: "user_1", email: "user@example.com" }
    mockAuth.organizationId = "org_1"

    mockPrisma.applicationStack.findFirst.mockReset()
    mockCheckPublicSourceUpdate.mockReset()
  })

  describe("POST /deploy/public-source/:stackId/check", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockAuth.user = null

      const res = await app.handle(
        new Request("http://localhost/deploy/public-source/stack_1/check", {
          method: "POST",
        })
      )

      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("UNAUTHORIZED")
    })

    it("returns 401 when organizationId is missing", async () => {
      mockAuth.organizationId = null

      const res = await app.handle(
        new Request("http://localhost/deploy/public-source/stack_1/check", {
          method: "POST",
        })
      )

      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("UNAUTHORIZED")
    })

    it("returns 404 when stack is not found or has no publicSourceUrl", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce(null)

      const res = await app.handle(
        new Request("http://localhost/deploy/public-source/stack_1/check", {
          method: "POST",
        })
      )

      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("PUBLIC_SOURCE_NOT_FOUND")
    })

    it("returns 404 when stack exists but publicSourceUrl is empty", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "stack_1",
        organizationId: "org_1",
        sourceType: "PUBLIC",
        publicSourceUrl: null,
        publicSourceRef: "main",
        branchName: "main",
        deployments: [],
      })

      const res = await app.handle(
        new Request("http://localhost/deploy/public-source/stack_1/check", {
          method: "POST",
        })
      )

      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("PUBLIC_SOURCE_NOT_FOUND")
    })

    it("returns 200 with update data when update check succeeds", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "stack_1",
        organizationId: "org_1",
        sourceType: "PUBLIC",
        publicSourceUrl: "https://github.com/example/repo",
        publicSourceRef: "main",
        branchName: "main",
        deployments: [
          { commitSha: "abcdef1234567890abcdef1234567890abcdef12" },
        ],
      })
      mockCheckPublicSourceUpdate.mockResolvedValueOnce({
        remoteSha: "1234567890abcdef1234567890abcdef12345678",
        updateAvailable: true,
      })

      const res = await app.handle(
        new Request("http://localhost/deploy/public-source/stack_1/check", {
          method: "POST",
        })
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.data.remoteSha).toBe(
        "1234567890abcdef1234567890abcdef12345678"
      )
      expect(json.data.updateAvailable).toBe(true)

      expect(mockCheckPublicSourceUpdate).toHaveBeenCalledWith({
        url: "https://github.com/example/repo",
        ref: "main",
        deployedSha: "abcdef1234567890abcdef1234567890abcdef12",
      })
    })

    it("falls back to branchName when publicSourceRef is null", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "stack_1",
        organizationId: "org_1",
        sourceType: "PUBLIC",
        publicSourceUrl: "https://github.com/example/repo",
        publicSourceRef: null,
        branchName: "production",
        deployments: [],
      })
      mockCheckPublicSourceUpdate.mockResolvedValueOnce({
        remoteSha: "abcdef1234567890abcdef1234567890abcdef12",
        updateAvailable: true,
      })

      const res = await app.handle(
        new Request("http://localhost/deploy/public-source/stack_1/check", {
          method: "POST",
        })
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)

      expect(mockCheckPublicSourceUpdate).toHaveBeenCalledWith({
        url: "https://github.com/example/repo",
        ref: "production",
        deployedSha: undefined,
      })
    })

    it("returns 502 when checkPublicSourceUpdate throws an error", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "stack_1",
        organizationId: "org_1",
        sourceType: "PUBLIC",
        publicSourceUrl: "https://github.com/example/repo",
        publicSourceRef: "main",
        branchName: "main",
        deployments: [],
      })
      mockCheckPublicSourceUpdate.mockRejectedValueOnce(
        new Error("Git remote check failed")
      )

      const res = await app.handle(
        new Request("http://localhost/deploy/public-source/stack_1/check", {
          method: "POST",
        })
      )

      expect(res.status).toBe(502)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("PUBLIC_SOURCE_CHECK_FAILED")
    })
  })
})
