import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"

// ── Mock auth ───────────────────────────────────────────

let mockAuthValue: {
  user: { id: string; email: string } | null
  organizationId?: string
} = {
  user: null,
}

const mockWithAuth = mock(async () => mockAuthValue)

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
  getWorkOS: () => ({ organizations: {}, userManagement: {} }),
}))

// ── Mock Bun.S3Client ───────────────────────────────────

const mockS3Write = mock()
const mockS3Presign = mock(() => "https://s3.example.com/presigned-url")

class MockS3Client {
  write = mockS3Write
  presign = mockS3Presign
}

// Attach mock S3Client to global Bun
;(Bun as Record<string, unknown>).S3Client = MockS3Client

// ── Import route after mocks ────────────────────────────

const { createUploadScreenshotRoutes } =
  await import("./upload-screenshot.route")

function app() {
  return new Elysia().use(createUploadScreenshotRoutes()).compile()
}

describe("UploadScreenshotRoute POST /upload-screenshot", () => {
  beforeEach(() => {
    mockAuthValue = { user: null }
    mockS3Write.mockReset()
    mockS3Presign.mockReset()
    mockS3Presign.mockReturnValue("https://s3.example.com/presigned-url")

    process.env.S3_REGION = "ap-southeast-1"
    process.env.S3_BUCKET = "test-bucket"
    process.env.S3_ACCESS_KEY_ID = "test-key"
    process.env.S3_SECRET_ACCESS_KEY = "test-secret"
    process.env.S3_ENDPOINT = "https://s3.ap-southeast-1.amazonaws.com"
  })

  it("returns 401 when organizationId is missing", async () => {
    mockAuthValue = { user: { id: "u-1", email: "u@example.com" } }

    const formData = new FormData()
    formData.append(
      "file",
      new File(["test content"], "screenshot.png", { type: "image/png" })
    )

    const res = await app().handle(
      new Request("http://localhost/upload-screenshot", {
        method: "POST",
        body: formData,
      })
    )

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("UNAUTHORIZED")
    expect(json.message).toBe("Organization required")
  })

  it("returns 400 when file is invalid type (not png or jpeg)", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-1",
    }

    const formData = new FormData()
    formData.append(
      "file",
      new File(["test content"], "doc.pdf", { type: "application/pdf" })
    )

    const res = await app().handle(
      new Request("http://localhost/upload-screenshot", {
        method: "POST",
        body: formData,
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("INVALID_TYPE")
    expect(json.message).toBe("Only PNG and JPG files are allowed")
  })

  it("returns 400 when file size exceeds 10MB", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-1",
    }

    const oversizedBuffer = new Uint8Array(10 * 1024 * 1024 + 1)
    const formData = new FormData()
    formData.append(
      "file",
      new File([oversizedBuffer], "large.png", { type: "image/png" })
    )

    const res = await app().handle(
      new Request("http://localhost/upload-screenshot", {
        method: "POST",
        body: formData,
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("FILE_TOO_LARGE")
    expect(json.message).toBe("File size must be under 10MB")
  })

  it("returns 530 / 503 when S3 configuration is missing", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-1",
    }
    delete process.env.S3_BUCKET

    const formData = new FormData()
    formData.append(
      "file",
      new File(["image-data"], "test.png", { type: "image/png" })
    )

    const res = await app().handle(
      new Request("http://localhost/upload-screenshot", {
        method: "POST",
        body: formData,
      })
    )

    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("S3_CONFIG_ERROR")
  })

  it("uploads PNG screenshot successfully and returns presigned URL", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-1",
    }
    mockS3Write.mockResolvedValueOnce(undefined)

    const formData = new FormData()
    formData.append(
      "file",
      new File(["valid-png-data"], "receipt.png", { type: "image/png" })
    )

    const res = await app().handle(
      new Request("http://localhost/upload-screenshot", {
        method: "POST",
        body: formData,
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.url).toBe("https://s3.example.com/presigned-url")
    expect(json.key).toMatch(
      /^payment-screenshots\/org-1\/\d+-[a-f0-9-]+\.png$/
    )
    expect(mockS3Write).toHaveBeenCalled()
    expect(mockS3Presign).toHaveBeenCalledWith(
      expect.stringMatching(/^payment-screenshots\/org-1\//),
      { expiresIn: 30 * 24 * 60 * 60 }
    )
  })

  it("uploads JPEG screenshot successfully", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-2",
    }
    mockS3Write.mockResolvedValueOnce(undefined)

    const formData = new FormData()
    formData.append(
      "file",
      new File(["valid-jpeg-data"], "receipt.jpg", { type: "image/jpeg" })
    )

    const res = await app().handle(
      new Request("http://localhost/upload-screenshot", {
        method: "POST",
        body: formData,
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.key).toMatch(
      /^payment-screenshots\/org-2\/\d+-[a-f0-9-]+\.jpg$/
    )
  })

  it("returns 500 when S3 write throws an error", async () => {
    mockAuthValue = {
      user: { id: "u-1", email: "u@example.com" },
      organizationId: "org-1",
    }
    mockS3Write.mockRejectedValueOnce(new Error("S3 Upload Failed"))

    const formData = new FormData()
    formData.append(
      "file",
      new File(["valid-png-data"], "receipt.png", { type: "image/png" })
    )

    const res = await app().handle(
      new Request("http://localhost/upload-screenshot", {
        method: "POST",
        body: formData,
      })
    )

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("UPLOAD_FAILED")
  })
})
