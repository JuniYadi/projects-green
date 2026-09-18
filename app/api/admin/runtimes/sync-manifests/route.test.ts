import { beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))
mock.module("@/lib/prisma", () => ({
  prisma: {
    appRuntimeManifest: {
      upsert: mock(
        async ({
          where,
          create,
        }: {
          where: { frameworkId: string }
          create: { version: string; manifestJson: unknown }
        }) => ({
          id: "man-1",
          frameworkId: where.frameworkId,
          version: create.version,
          manifestJson: create.manifestJson,
          createdAt: new Date("2026-09-19T00:00:00.000Z"),
          updatedAt: new Date("2026-09-19T00:00:00.000Z"),
        })
      ),
    },
  },
}))

const { POST } = await import("./route")

const sampleManifest = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  runtime: "laravel",
  framework: "Laravel",
  version: "8.4",
  baseImage: "ghcr.io/pfnapp/base/frameworks/laravel:8.4-alpine",
  ports: { default: 8080, protocol: "HTTP" },
  security: { runAsUser: 10001, runAsGroup: 10001, readOnlyRoot: false },
  probes: {
    liveness: { path: "/healthz", port: 8080 },
    readiness: { path: "/healthz", port: 8080 },
  },
  tunables: [],
}

describe("POST /api/admin/runtimes/sync-manifests", () => {
  beforeEach(() => {
    process.env.RUNTIME_MANIFEST_SYNC_SECRET = "test-secret"
  })

  it("authorizes and synchronizes runtime manifests", async () => {
    const req = new Request("http://localhost/api/admin/runtimes/sync-manifests", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-runtime-sync-token": "test-secret",
      },
      body: JSON.stringify(sampleManifest),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.count).toBe(1)
  })

  it("returns 401 when missing valid credentials", async () => {
    const req = new Request("http://localhost/api/admin/runtimes/sync-manifests", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-runtime-sync-token": "wrong",
      },
      body: JSON.stringify(sampleManifest),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("UNAUTHORIZED")
  })

  it("returns 400 for invalid manifest schema", async () => {
    const req = new Request("http://localhost/api/admin/runtimes/sync-manifests", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-runtime-sync-token": "test-secret",
      },
      body: JSON.stringify({ invalid: true }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("INVALID_MANIFEST")
  })
})
