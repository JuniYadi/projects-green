import { describe, expect, it, beforeEach } from "bun:test"
import { storageS3Routes } from "./storage-s3.route"

describe("modules/storage/api/storage-s3.route", () => {
  beforeEach(() => {
    process.env.APP_KEY = "test_master_secret_32_bytes_long_123456"
  })

  it("returns 401 when unauthorized", async () => {
    const res = await storageS3Routes.handle(
      new Request("http://localhost/storage/s3/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "a.png", mimeType: "image/png" }),
      })
    )
    expect(res.status).toBe(401)
  })
})
