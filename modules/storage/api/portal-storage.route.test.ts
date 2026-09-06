import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

const mockAuthContext = {
  current: null as { type: string; userId: string; email: string } | null,
}
const mockPlatformRole = {
  current: "super_admin" as string,
}

const mockGetAdminMetrics = mock()
const mockListAdminFiles = mock()
const mockGetAdminViewUrl = mock()
const mockForceDeleteFile = mock()

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: async () => mockPlatformRole.current,
}))

mock.module("../storage.service", () => ({
  StorageService: {
    getAdminMetrics: mockGetAdminMetrics,
    listAdminFiles: mockListAdminFiles,
    getAdminViewUrl: mockGetAdminViewUrl,
    forceDeleteFile: mockForceDeleteFile,
  },
}))

// Dynamic import required so mock.module takes effect before module evaluation in Bun
const { portalStorageRoutes } = await import("./portal-storage.route")

describe("modules/storage/api/portal-storage.route", () => {
  let app: { handle: (request: Request) => Promise<Response> }
  beforeEach(() => {
    app = new Elysia().use(portalStorageRoutes)
    mockAuthContext.current = {
      type: "workos",
      userId: "user_admin_1",
      email: "admin@example.com",
    }
    mockPlatformRole.current = "super_admin"
    mockGetAdminMetrics.mockReset()
    mockListAdminFiles.mockReset()
    mockGetAdminViewUrl.mockReset()
    mockForceDeleteFile.mockReset()
  })

  describe("Authentication and Role Guards", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuthContext.current = null
      const res = await app.handle(
        new Request("http://localhost/portal/storage/metrics")
      )
      expect(res.status).toBe(401)
    })

    it("returns 401 when auth type is not workos", async () => {
      mockAuthContext.current = {
        type: "api_key",
        userId: "user_1",
        email: "user@example.com",
      }
      const res = await app.handle(
        new Request("http://localhost/portal/storage/metrics")
      )
      expect(res.status).toBe(401)
    })

    it("returns 403 when user is not super_admin", async () => {
      mockPlatformRole.current = "member"
      const res = await app.handle(
        new Request("http://localhost/portal/storage/metrics")
      )
      expect(res.status).toBe(403)
    })
  })

  describe("GET /portal/storage/metrics", () => {
    it("returns admin metrics", async () => {
      mockGetAdminMetrics.mockResolvedValueOnce({
        totalFiles: 120,
        totalBytes: 500000,
        activeFiles: 110,
      })

      const res = await app.handle(
        new Request("http://localhost/portal/storage/metrics")
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.totalFiles).toBe(120)
      expect(mockGetAdminMetrics).toHaveBeenCalledTimes(1)
    })
  })

  describe("GET /portal/storage/files", () => {
    it("parses query parameters and returns files list", async () => {
      mockListAdminFiles.mockResolvedValueOnce({
        items: [{ id: "f_1", filename: "test.png" }],
        total: 1,
        page: 2,
        pageSize: 10,
      })

      const res = await app.handle(
        new Request(
          "http://localhost/portal/storage/files?page=2&pageSize=10&purpose=avatar&status=ACTIVE&startDate=2026-01-01&endDate=2026-02-01"
        )
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.items.length).toBe(1)
      expect(mockListAdminFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          pageSize: 10,
          purpose: "avatar",
          status: "ACTIVE",
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      )
    })
  })

  describe("GET /portal/storage/files/:id/view-url", () => {
    it("returns view URL for valid file id", async () => {
      mockGetAdminViewUrl.mockResolvedValueOnce({
        url: "https://s3.example.com/view/f_1",
      })

      const res = await app.handle(
        new Request("http://localhost/portal/storage/files/f_1/view-url")
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.url).toBe("https://s3.example.com/view/f_1")
    })

    it("returns 404 when file is not found", async () => {
      mockGetAdminViewUrl.mockRejectedValueOnce(new Error("File not found"))

      const res = await app.handle(
        new Request("http://localhost/portal/storage/files/f_unknown/view-url")
      )
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data).toEqual({ error: "File not found" })
    })
  })

  describe("DELETE /portal/storage/files/:id", () => {
    it("deletes file and returns result", async () => {
      mockForceDeleteFile.mockResolvedValueOnce({ success: true })

      const res = await app.handle(
        new Request("http://localhost/portal/storage/files/f_1", {
          method: "DELETE",
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ success: true })
    })

    it("returns 404 when deleting missing file", async () => {
      mockForceDeleteFile.mockRejectedValueOnce(new Error("File not found"))

      const res = await app.handle(
        new Request("http://localhost/portal/storage/files/f_missing", {
          method: "DELETE",
        })
      )
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data).toEqual({ error: "File not found" })
    })
  })
})
