import { describe, expect, it } from "bun:test"
import {
  createRegistryS3Client,
  listAllKeysWithClient,
  deleteRegistryKeyWithClient,
  readManifestJsonWithClient,
} from "./registry-s3"

describe("registry-s3 helpers", () => {
  it("creates registry S3 client instance", () => {
    const client = createRegistryS3Client({
      bucket: "registry-apac.pfnapp.com",
      endpoint: "https://r2.cloudflarestorage.com",
      accessKeyId: "key",
      secretAccessKey: "secret",
      region: "auto",
    })
    expect(client).toBeDefined()
  })

  it("lists all keys using client pagination", async () => {
    const mockClient = {
      list: async (opts: { continuationToken?: string }) => {
        if (!opts.continuationToken) {
          return {
            contents: [{ key: "v2/app/manifests/1" }],
            isTruncated: true,
            nextContinuationToken: "token-1",
          }
        }
        return {
          contents: [{ key: "v2/app/manifests/2" }],
          isTruncated: false,
        }
      },
    } as unknown as import("bun").S3Client

    const keys = await listAllKeysWithClient(mockClient, "v2/app/manifests/")
    expect(keys).toEqual(["v2/app/manifests/1", "v2/app/manifests/2"])
  })

  it("deletes registry key with client gracefully", async () => {
    const mockClient = {
      file: () => ({
        delete: async () => {},
      }),
    } as unknown as import("bun").S3Client

    const ok = await deleteRegistryKeyWithClient(
      mockClient,
      "v2/app/blobs/sha256:123"
    )
    expect(ok).toBe(true)
  })

  it("reads and parses manifest JSON with client", async () => {
    const mockClient = {
      file: () => ({
        text: async () => JSON.stringify({ schemaVersion: 2, layers: [] }),
      }),
    } as unknown as import("bun").S3Client

    const manifest = await readManifestJsonWithClient(
      mockClient,
      "v2/app/manifests/1"
    )
    expect(manifest).toEqual({ schemaVersion: 2, layers: [] })
  })

  it("returns null when manifest file cannot be read or parsed", async () => {
    const mockClient = {
      file: () => ({
        text: async () => {
          throw new Error("Not found")
        },
      }),
    } as unknown as import("bun").S3Client

    const manifest = await readManifestJsonWithClient(
      mockClient,
      "v2/app/manifests/missing"
    )
    expect(manifest).toBeNull()
  })
})
