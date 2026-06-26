import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test"
import { mock } from "bun:test"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"

// ─── Mocks — must be before any imports ──────────────────────────────────────

const mockTx = {
  whatsappMedia: {
    findUnique: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  },
  whatsappDevice: {
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockTx,
}))

const mockClientInstance = {
  completeUploadMedia: vi.fn(),
  getMedia: vi.fn(),
  downloadMedia: vi.fn(),
  deleteMedia: vi.fn(),
}

mock.module("@/lib/whatsapp/meta-cloud/device-client", () => ({
  WhatsAppDeviceClient: {
    fromDevice: vi.fn(() => mockClientInstance),
  },
}))

const { uploadAndSave, downloadAndSave, deleteLocal, isExpired, expiryStatus } =
  await import("./media.service")

describe("media.service", () => {
  // ponytail: temp dir for each test to avoid cross-test FS pollution
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "media-test-"))
    process.chdir(tmpDir)
  })

  afterEach(() => {
    vi.clearAllMocks()
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  describe("isExpired", () => {
    it("returns false when expiresAt is null", () => {
      expect(isExpired({ expiresAt: null })).toBe(false)
    })

    it("returns true when expiresAt is in the past", () => {
      const past = new Date(Date.now() - 86_400_000)
      expect(isExpired({ expiresAt: past })).toBe(true)
    })

    it("returns false when expiresAt is in the future", () => {
      const future = new Date(Date.now() + 86_400_000)
      expect(isExpired({ expiresAt: future })).toBe(false)
    })
  })

  describe("expiryStatus", () => {
    it("returns green when more than 5 days left", () => {
      const record = {
        downloadedAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 86_400_000),
      }
      expect(expiryStatus(record)).toBe("green")
    })

    it("returns yellow when 1-5 days left", () => {
      const record = {
        downloadedAt: new Date(),
        expiresAt: new Date(Date.now() + 3 * 86_400_000),
      }
      expect(expiryStatus(record)).toBe("yellow")
    })

    it("returns red when expired", () => {
      const record = {
        downloadedAt: new Date(),
        expiresAt: new Date(Date.now() - 86_400_000),
      }
      expect(expiryStatus(record)).toBe("red")
    })

    it("returns red when not downloaded", () => {
      const record = { downloadedAt: null, expiresAt: null }
      expect(expiryStatus(record)).toBe("red")
    })
  })

  describe("uploadAndSave", () => {
    it("uploads and creates a media record", async () => {
      mockTx.whatsappDevice.findUniqueOrThrow.mockResolvedValue({
        id: "device-1",
        tokenEncrypted: "enc-token",
        whatsappPhoneId: "phone-1",
        whatsappBusinessAccountId: "waba-1",
        organizationId: "org-1",
      })

      mockClientInstance.completeUploadMedia.mockResolvedValue({
        mediaId: "media-1",
      })

      mockTx.whatsappMedia.create.mockResolvedValue({
        id: "record-1",
        organizationId: "org-1",
        deviceId: "device-1",
        metaMediaId: "media-1",
        mimeType: "image/jpeg",
        fileSize: 1024,
        storePath: path.join(tmpDir, "storage", "device-1", "media-1", "photo.jpg"),
        downloadedAt: new Date(),
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        sha256: null,
      })

      const result = await uploadAndSave(
        "device-1",
        "org-1",
        new ArrayBuffer(1024),
        "photo.jpg",
        "image/jpeg"
      )

      expect(result.metaMediaId).toBe("media-1")
      expect(mockClientInstance.completeUploadMedia).toHaveBeenCalled()
    })
  })

  describe("downloadAndSave", () => {
    it("returns existing record if already downloaded and file exists", async () => {
      const storePath = path.join(tmpDir, "existing-file")
      fs.writeFileSync(storePath, Buffer.alloc(10))

      mockTx.whatsappMedia.findUnique.mockResolvedValue({
        id: "record-1",
        storePath,
        metaMediaId: "media-1",
        deviceId: "device-1",
        mimeType: "image/jpeg",
        fileSize: 100,
        downloadedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
        organizationId: "org-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        sha256: null,
      })

      const result = await downloadAndSave("device-1", "org-1", "media-1")
      expect(result.metaMediaId).toBe("media-1")
    })
  })

  describe("deleteLocal", () => {
    it("deletes the record from DB and removes storage dir", async () => {
      const storePath = path.join(tmpDir, "delete-me")
      fs.writeFileSync(storePath, Buffer.alloc(10))

      mockTx.whatsappMedia.findUnique.mockResolvedValue({
        id: "record-1",
        storePath,
        metaMediaId: "media-1",
        deviceId: "device-1",
        mimeType: "image/jpeg",
        fileSize: 100,
        downloadedAt: new Date(),
        expiresAt: new Date(),
        organizationId: "org-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        sha256: null,
      })

      mockTx.whatsappMedia.delete.mockResolvedValue({})

      await deleteLocal("media-1")
      expect(mockTx.whatsappMedia.delete).toHaveBeenCalled()
      expect(fs.existsSync(storePath)).toBe(false)
    })
  })
})
