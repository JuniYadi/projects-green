import { beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))
mock.module("@/lib/prisma", () => ({
  prisma: {
    appRuntimeManifest: {
      upsert: mock(async ({ where, create }: any) => ({
        id: "man-1",
        frameworkId: where.frameworkId,
        version: create.version,
        manifestJson: create.manifestJson,
        createdAt: new Date("2026-09-19T00:00:00.000Z"),
        updatedAt: new Date("2026-09-19T00:00:00.000Z"),
      })),
    },
  },
}))

const {
  createRuntimeManifestSyncRoutes,
} = await import("./runtime-manifest-sync.route")

const { POST: nextRouteHandler } =
  await import("@/app/api/admin/runtimes/sync-manifests/route")

const { createJenkinsWebhookHeaders } =
  await import("@/modules/deploy/jenkins-webhook-auth")

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

describe("runtime-manifest-sync.route", () => {
  let mockService: {
    listManifests: ReturnType<typeof mock>
    getRuntimeManifest: ReturnType<typeof mock>
    syncManifests: ReturnType<typeof mock>
  }
  let app: ReturnType<typeof createRuntimeManifestSyncRoutes>

  beforeEach(() => {
    process.env.RUNTIME_MANIFEST_SYNC_SECRET = "test-sync-secret"
    mockService = {
      listManifests: mock(async () => [
        {
          id: "man-1",
          frameworkId: "laravel",
          version: "8.4",
          manifest: sampleManifest,
          createdAt: "2026-09-19T00:00:00.000Z",
          updatedAt: "2026-09-19T00:00:00.000Z",
        },
      ]),
      getRuntimeManifest: mock(async (fw: string) => ({
        ...sampleManifest,
        runtime: fw,
      })),
      syncManifests: mock(async (_payload: unknown) => [
        {
          id: "man-1",
          frameworkId: "laravel",
          version: "8.4",
          manifest: sampleManifest,
          createdAt: "2026-09-19T00:00:00.000Z",
          updatedAt: "2026-09-19T00:00:00.000Z",
        },
      ]),
    }
    app = createRuntimeManifestSyncRoutes({
      manifestService:
        mockService as unknown as import("@/modules/deploy/runtime-manifest.service").RuntimeManifestService,
    })
  })

  it("GET /admin/runtimes/manifests returns all manifests when authorized", async () => {
    const res = await app.handle(
      new Request("http://localhost/admin/runtimes/manifests", {
        headers: {
          "x-runtime-sync-token": "test-sync-secret",
        },
      })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data).toHaveLength(1)
  })

  it("GET /admin/runtimes/manifests rejects unauthorized requests", async () => {
    const res = await app.handle(
      new Request("http://localhost/admin/runtimes/manifests")
    )
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("UNAUTHORIZED")
  })

  it("GET /admin/runtimes/manifests?framework=laravel returns specific manifest when authorized", async () => {
    const res = await app.handle(
      new Request("http://localhost/admin/runtimes/manifests?framework=laravel", {
        headers: {
          "x-runtime-sync-token": "test-sync-secret",
        },
      })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.runtime).toBe("laravel")
  })

  it("POST /admin/runtimes/sync-manifests authorizes via x-runtime-sync-token header", async () => {
    const res = await app.handle(
      new Request("http://localhost/admin/runtimes/sync-manifests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-runtime-sync-token": "test-sync-secret",
        },
        body: JSON.stringify(sampleManifest),
      })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(mockService.syncManifests).toHaveBeenCalled()
  })

  it("POST /admin/runtimes/sync-manifests authorizes via Bearer token", async () => {
    const res = await app.handle(
      new Request("http://localhost/admin/runtimes/sync-manifests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-sync-secret",
        },
        body: JSON.stringify(sampleManifest),
      })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })

  it("POST /admin/runtimes/sync-manifests authorizes via HMAC signature", async () => {
    const rawBody = JSON.stringify(sampleManifest)
    const headers = createJenkinsWebhookHeaders(rawBody, "test-sync-secret")

    const res = await app.handle(
      new Request("http://localhost/admin/runtimes/sync-manifests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...headers,
        },
        body: rawBody,
      })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })

  it("POST /admin/runtimes/sync-manifests rejects unauthorized requests", async () => {
    const res = await app.handle(
      new Request("http://localhost/admin/runtimes/sync-manifests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-runtime-sync-token": "wrong-secret",
        },
        body: JSON.stringify(sampleManifest),
      })
    )
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("UNAUTHORIZED")
  })

  it("POST /admin/runtimes/sync-manifests returns 400 when sync fails with invalid schema", async () => {
    mockService.syncManifests.mockImplementationOnce(async () => {
      throw new Error("Invalid manifest schema: ports.default required")
    })

    const res = await app.handle(
      new Request("http://localhost/admin/runtimes/sync-manifests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-runtime-sync-token": "test-sync-secret",
        },
        body: JSON.stringify({ invalid: true }),
      })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("INVALID_MANIFEST")
  })

  it("Next.js route handler handles POST /api/admin/runtimes/sync-manifests", async () => {
    const req = new Request("http://localhost/api/admin/runtimes/sync-manifests", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-runtime-sync-token": "test-sync-secret",
      },
      body: JSON.stringify(sampleManifest),
    })

    const res = await nextRouteHandler(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})
