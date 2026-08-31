import { describe, it, expect } from "bun:test"
import {
  isPrivateCdnUrl,
  detectAssetType,
  fetchPresignedUrl,
} from "./cdn-asset"

describe("CDNAsset utilities", () => {
  it("detects private CDN and storage URLs accurately", () => {
    expect(
      isPrivateCdnUrl(
        "https://cdn.pfnapp.id/4c64eaa7963df6e3dc3b01f96129d0ef/2026/08/28384543444474696_media.webp"
      )
    ).toBe(true)
    expect(isPrivateCdnUrl("__stored:media_123")).toBe(true)
    expect(isPrivateCdnUrl("https://my-bucket.s3.amazonaws.com/test.jpg")).toBe(
      true
    )
    expect(isPrivateCdnUrl("https://images.unsplash.com/photo-123.jpg")).toBe(
      false
    )
    expect(isPrivateCdnUrl(null)).toBe(false)
  })

  it("detects asset type from URL and filename", () => {
    expect(
      detectAssetType(
        "https://cdn.pfnapp.id/2026/08/28384543444474696_media.webp"
      )
    ).toBe("sticker")
    expect(detectAssetType("https://example.com/photo.jpg")).toBe("image")
    expect(detectAssetType("https://example.com/invoice.pdf")).toBe("document")
    expect(detectAssetType("https://example.com/audio.ogg")).toBe("audio")
    expect(detectAssetType("https://example.com/video.mp4")).toBe("video")
  })

  it("resolves __stored: format correctly", async () => {
    const res = await fetchPresignedUrl("__stored:med_12345")
    expect(res).toBe("/api/whatsapp/media/med_12345/download")
  })
})
