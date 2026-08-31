import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import fs from "node:fs"
import { workosNodeMock } from "../../../../test/workos-node-mock"
const mockAuthContext = {
  current: null as {
    organizationId?: string
    type: string
    userId?: string
  } | null,
}

mock.module("@workos-inc/node", () => workosNodeMock)

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

const mockDeviceFindFirst = mock(() => Promise.resolve(null))
const mockDeviceFindUniqueOrThrow = mock(() => Promise.resolve({}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findFirst: mockDeviceFindFirst,
      findUniqueOrThrow: mockDeviceFindUniqueOrThrow,
    },
  },
}))

const mockUploadAndSave = mock(() =>
  Promise.resolve({
    id: "med-1",
    metaMediaId: "meta-123",
    fileName: "doc.pdf",
    mimeType: "application/pdf",
    fileSize: 1024,
    createdAt: new Date(),
    expiresAt: new Date(),
  })
)
const mockListMedia = mock(() => Promise.resolve([]))
const mockGetMetadata = mock(() => Promise.resolve(null))
const mockDeleteLocal = mock(() => Promise.resolve())
const mockDownloadAndSave = mock(() => Promise.resolve())
const mockGetStoragePath = mock(() => "/tmp/media.pdf")
const mockExpiryStatus = mock(() => "active")

mock.module("../media.service", () => ({
  uploadAndSave: mockUploadAndSave,
  listMedia: mockListMedia,
  getMetadata: mockGetMetadata,
  deleteLocal: mockDeleteLocal,
  downloadAndSave: mockDownloadAndSave,
  getStoragePath: mockGetStoragePath,
  expiryStatus: mockExpiryStatus,
}))

mock.module("@/lib/whatsapp/meta-cloud/device-client", () => ({
  WhatsAppDeviceClient: {
    fromDevice: mock(async () => ({
      deleteMedia: mock(async () => {}),
    })),
  },
}))

const { mediaRoutes } = await import("./media.route")

function createTestApp() {
  return new Elysia().use(mediaRoutes)
}

describe("media.route", () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    mockAuthContext.current = null
    mockDeviceFindFirst.mockClear()
    mockDeviceFindUniqueOrThrow.mockClear()
    mockUploadAndSave.mockClear()
    mockListMedia.mockClear()
    mockGetMetadata.mockClear()
    mockDeleteLocal.mockClear()
    mockDownloadAndSave.mockClear()
    app = createTestApp()
  })

  describe("POST /media (Upload)", () => {
    it("returns 401 when unauthenticated", async () => {
      const res = await app.handle(
        new Request("http://localhost/media", {
          method: "POST",
        })
      )
      expect(res.status).toBe(401)
    })

    it("returns 400 when not multipart/form-data", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }

      const res = await app.handle(
        new Request("http://localhost/media", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        })
      )
      expect(res.status).toBe(400)
    })

    it("uploads file successfully for valid device and mime type", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      mockDeviceFindFirst.mockResolvedValueOnce({
        id: "dev-1",
        organizationId: "org-1",
      } as unknown as never)

      const form = new FormData()
      form.append(
        "file",
        new File(["dummy content"], "report.pdf", { type: "application/pdf" })
      )
      form.append("deviceId", "dev-1")

      const res = await app.handle(
        new Request("http://localhost/media", {
          method: "POST",
          body: form,
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(mockUploadAndSave).toHaveBeenCalled()
    })
  })

  describe("GET /media (List)", () => {
    it("lists media records", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      mockListMedia.mockResolvedValueOnce([
        { id: "med-1", fileName: "doc.pdf", organizationId: "org-1" },
      ] as unknown as never)

      const res = await app.handle(new Request("http://localhost/media"))

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })
  })

  describe("GET /media/:id (Metadata)", () => {
    it("returns 404 if media not found", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      mockGetMetadata.mockResolvedValueOnce(null)

      const res = await app.handle(
        new Request("http://localhost/media/med-404")
      )

      expect(res.status).toBe(404)
    })

    it("returns metadata when found", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      mockGetMetadata.mockResolvedValueOnce({
        id: "med-1",
        organizationId: "org-1",
        fileName: "doc.pdf",
        mimeType: "application/pdf",
        fileSize: 1024,
        createdAt: new Date(),
        expiresAt: new Date(),
      } as unknown as never)

      const res = await app.handle(new Request("http://localhost/media/med-1"))

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.media.id).toBe("med-1")
    })
  })
  describe("GET /media/:id/download", () => {
    it("serves image/sticker with inline Content-Disposition for preview", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      const tmpFile = "/tmp/test-sticker.webp"
      fs.writeFileSync(tmpFile, Buffer.from("fake-webp-binary"))
      mockGetMetadata.mockResolvedValueOnce({
        id: "med-sticker-1",
        organizationId: "org-1",
        mimeType: "image/webp",
        fileSize: 16,
        storePath: tmpFile,
      } as unknown as never)
      mockGetStoragePath.mockReturnValueOnce(tmpFile)

      const res = await app.handle(
        new Request("http://localhost/media/med-sticker-1/download")
      )

      expect(res.status).toBe(200)
      expect(res.headers.get("Content-Type")).toBe("image/webp")
      expect(res.headers.get("Content-Disposition")).toContain("inline")
      expect(res.headers.get("Cache-Control")).toContain("public")
      fs.unlinkSync(tmpFile)
    })

    it("forces attachment Content-Disposition when ?download=true is passed", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      const tmpFile = "/tmp/test-image.png"
      fs.writeFileSync(tmpFile, Buffer.from("fake-png-binary"))
      mockGetMetadata.mockResolvedValueOnce({
        id: "med-img-1",
        organizationId: "org-1",
        mimeType: "image/png",
        fileSize: 15,
        storePath: tmpFile,
      } as unknown as never)
      mockGetStoragePath.mockReturnValueOnce(tmpFile)

      const res = await app.handle(
        new Request("http://localhost/media/med-img-1/download?download=true")
      )

      expect(res.status).toBe(200)
      expect(res.headers.get("Content-Type")).toBe("image/png")
      expect(res.headers.get("Content-Disposition")).toContain("attachment")
      fs.unlinkSync(tmpFile)
    })
  })

  describe("DELETE /media/:id", () => {
    it("deletes media from local storage and Meta", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      mockGetMetadata.mockResolvedValueOnce({
        id: "med-1",
        organizationId: "org-1",
        metaMediaId: "meta-123",
        deviceId: "dev-1",
      } as unknown as never)
      mockDeviceFindUniqueOrThrow.mockResolvedValueOnce({
        id: "dev-1",
        tokenEncrypted: "token",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/media/med-1", {
          method: "DELETE",
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ ok: true })
      expect(mockDeleteLocal).toHaveBeenCalledWith("med-1")
    })
  })
})
