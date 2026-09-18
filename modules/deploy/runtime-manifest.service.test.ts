import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PrismaClient } from "@prisma/client"

import {
  RuntimeManifestService,
  createFallbackManifest,
} from "./runtime-manifest.service"

const validLaravelManifest = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  runtime: "laravel",
  framework: "Laravel",
  version: "8.4",
  baseImage: "ghcr.io/pfnapp/base/frameworks/laravel:8.4-alpine",
  ports: {
    default: 8080,
    protocol: "HTTP",
  },
  security: {
    runAsUser: 10001,
    runAsGroup: 10001,
    readOnlyRoot: false,
  },
  probes: {
    liveness: { path: "/healthz", port: 8080 },
    readiness: { path: "/healthz", port: 8080 },
  },
  tunables: [
    {
      key: "PHP_UPLOAD_MAX_FILESIZE",
      label: "Max Upload Size",
      type: "bytes_string" as const,
      default: "64M",
      description: "Max upload file size",
      troubleshooting: "Increase if 413 occurs",
      relatedKeys: ["PHP_POST_MAX_SIZE"],
      presets: ["32M", "64M", "100M"],
    },
    {
      key: "CONTAINER_ROLE",
      label: "Container Role",
      type: "select" as const,
      default: "app",
      options: ["app", "worker", "horizon", "scheduler", "all"],
      description: "Workload role",
      troubleshooting: "Set to worker for queues",
    },
  ],
}

describe("RuntimeManifestService", () => {
  let mockDb: {
    appRuntimeManifest: {
      upsert: ReturnType<typeof mock>
      findUnique: ReturnType<typeof mock>
      findMany: ReturnType<typeof mock>
    }
  }
  let service: RuntimeManifestService

  beforeEach(() => {
    mockDb = {
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
        findUnique: mock(
          async ({ where }: { where: { frameworkId: string } }) => {
            if (where.frameworkId === "laravel") {
              return {
                id: "man-laravel",
                frameworkId: "laravel",
                version: "8.4",
                manifestJson: validLaravelManifest,
                createdAt: new Date("2026-09-19T00:00:00.000Z"),
                updatedAt: new Date("2026-09-19T00:00:00.000Z"),
              }
            }
            return null
          }
        ),
        findMany: mock(async () => [
          {
            id: "man-laravel",
            frameworkId: "laravel",
            version: "8.4",
            manifestJson: validLaravelManifest,
            createdAt: new Date("2026-09-19T00:00:00.000Z"),
            updatedAt: new Date("2026-09-19T00:00:00.000Z"),
          },
        ]),
      },
    }
    service = new RuntimeManifestService(mockDb as unknown as PrismaClient)
  })

  it("upserts a valid manifest and maps to record DTO", async () => {
    const result = await service.upsertManifest(validLaravelManifest)
    expect(result.frameworkId).toBe("laravel")
    expect(result.version).toBe("8.4")
    expect(result.manifest.ports.default).toBe(8080)
    expect(result.manifest.tunables).toHaveLength(2)
    expect(mockDb.appRuntimeManifest.upsert).toHaveBeenCalled()
  })

  it("throws validation error for invalid manifest structure", async () => {
    expect(
      service.upsertManifest({
        runtime: "", // empty
      })
    ).rejects.toThrow()
  })

  it("syncs an array of manifests", async () => {
    const nextjsManifest = {
      ...validLaravelManifest,
      runtime: "nextjs",
      framework: "Next.js",
      version: "15",
    }
    const results = await service.syncManifests([
      validLaravelManifest,
      nextjsManifest,
    ])
    expect(results).toHaveLength(2)
    expect(results[0].frameworkId).toBe("laravel")
    expect(results[1].frameworkId).toBe("nextjs")
  })

  it("returns stored manifest from DB if found", async () => {
    const manifest = await service.getRuntimeManifest("laravel")
    expect(manifest.runtime).toBe("laravel")
    expect(manifest.framework).toBe("Laravel")
    expect(manifest.version).toBe("8.4")
    expect(manifest.tunables[0].key).toBe("PHP_UPLOAD_MAX_FILESIZE")
  })

  it("falls back to local platform contract when not found in DB", async () => {
    const manifest = await service.getRuntimeManifest("bun")
    expect(manifest.runtime).toBe("bun")
    expect(manifest.ports.default).toBe(8080)
    expect(manifest.tunables.some((t) => t.key === "BUN_ENV")).toBe(true)
  })

  it("returns tunables list for framework", async () => {
    const tunables = await service.getRuntimeTunables("laravel")
    expect(tunables.length).toBeGreaterThanOrEqual(2)
    expect(tunables[0].key).toBe("PHP_UPLOAD_MAX_FILESIZE")
  })

  it("lists all manifests", async () => {
    const list = await service.listManifests()
    expect(list).toHaveLength(1)
    expect(list[0].frameworkId).toBe("laravel")
  })

  it("formats tunables for AI prompt", async () => {
    const prompt = await service.formatTunablesForPrompt("laravel")
    expect(prompt).toContain("Platform Runtime Operational Contract")
    expect(prompt).toContain("PHP_UPLOAD_MAX_FILESIZE")
    expect(prompt).toContain("CONTAINER_ROLE")
  })

  it("creates fallback manifest correctly", () => {
    const fallback = createFallbackManifest("nextjs")
    expect(fallback.runtime).toBe("nextjs")
    expect(fallback.ports.default).toBe(8080)
    expect(fallback.security.runAsUser).toBe(10001)
  })
})
