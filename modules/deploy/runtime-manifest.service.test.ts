import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PrismaClient } from "@prisma/client"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

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

  it("creates fallback manifest with runtime-explicit base images", () => {
    const nextFallback = createFallbackManifest("nextjs")
    expect(nextFallback.runtime).toBe("nextjs")
    expect(nextFallback.baseImage).toBe(
      "ghcr.io/pfnapp/base/frameworks/nextjs:node22-alpine"
    )
    expect(nextFallback.ports.default).toBe(8080)
    expect(nextFallback.security.runAsUser).toBe(10001)

    const laravelFallback = createFallbackManifest("laravel")
    expect(laravelFallback.baseImage).toBe(
      "ghcr.io/pfnapp/base/frameworks/laravel:php8.4-alpine"
    )

    const nestFallback = createFallbackManifest("nestjs")
    expect(nestFallback.baseImage).toBe(
      "ghcr.io/pfnapp/base/frameworks/nestjs:node22-alpine"
    )
  })

  it("upserts a manifest containing supportedFrameworkVersions and runtimeMatrix", async () => {
    const manifestWithMatrix = {
      ...validLaravelManifest,
      version: "11",
      supportedFrameworkVersions: ["10", "11", "12", "13"],
      runtimeMatrix: {
        "laravel-13": { php: ["8.2", "8.3", "8.4", "8.5"], default: "8.4" },
        "laravel-12": { php: ["8.2", "8.3", "8.4"], default: "8.3" },
        "laravel-11": { php: ["8.2", "8.3", "8.4"], default: "8.3" },
        "laravel-10": { php: ["8.1", "8.2", "8.3"], default: "8.2" },
      },
      baseImage: "ghcr.io/pfnapp/base/frameworks/laravel:php8.4-alpine",
    }

    const record = await service.upsertManifest(manifestWithMatrix)
    expect(record.manifest.version).toBe("11")
    expect(record.manifest.supportedFrameworkVersions).toEqual([
      "10",
      "11",
      "12",
      "13",
    ])
    expect(record.manifest.runtimeMatrix?.["laravel-11"]?.default).toBe("8.3")
    expect(record.manifest.baseImage).toBe(
      "ghcr.io/pfnapp/base/frameworks/laravel:php8.4-alpine"
    )
  })

  it("finds local base-image manifests when not present in DB", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "base-image-test-"))
    const patchDir = path.join(tmpDir, "patches", "hermes-agent")
    fs.mkdirSync(patchDir, { recursive: true })

    const hermesManifest = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      runtime: "hermes-agent",
      framework: "Hermes Agent",
      version: "1.0",
      baseImage: "ghcr.io/pfnapp/hermes-agent:v2026.9.14",
      ports: { default: 9119, protocol: "HTTP" },
      security: { runAsUser: 10001, runAsGroup: 10001, readOnlyRoot: false },
      probes: {
        liveness: { path: "/healthz", port: 9119 },
        readiness: { path: "/healthz", port: 9119 },
      },
      tunables: [
        {
          key: "HERMES_DASHBOARD_BASIC_AUTH_SECRET",
          label: "Hermes Secret",
          type: "string",
          required: false,
        },
      ],
    }
    fs.writeFileSync(
      path.join(patchDir, "runtime-manifest.json"),
      JSON.stringify(hermesManifest)
    )

    const origEnv = process.env.BASE_IMAGE_PATH
    try {
      process.env.BASE_IMAGE_PATH = tmpDir
      const manifest = await service.getRuntimeManifest("hermes-agent")
      expect(manifest.runtime).toBe("hermes-agent")
      expect(manifest.ports.default).toBe(9119)
      expect(
        manifest.tunables.some(
          (t) => t.key === "HERMES_DASHBOARD_BASIC_AUTH_SECRET"
        )
      ).toBe(true)
      expect(mockDb.appRuntimeManifest.upsert).toHaveBeenCalled()
    } finally {
      process.env.BASE_IMAGE_PATH = origEnv
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it("warns and returns local manifest when DB upsert fails", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "base-image-test-"))
    const patchDir = path.join(tmpDir, "patches", "hermes-agent")
    fs.mkdirSync(patchDir, { recursive: true })

    const hermesManifest = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      runtime: "hermes-agent",
      framework: "Hermes Agent",
      version: "1.0",
      baseImage: "ghcr.io/pfnapp/hermes-agent:v2026.9.14",
      ports: { default: 9119, protocol: "HTTP" },
      security: { runAsUser: 10001, runAsGroup: 10001, readOnlyRoot: false },
      probes: {
        liveness: { path: "/healthz", port: 9119 },
        readiness: { path: "/healthz", port: 9119 },
      },
      tunables: [],
    }
    fs.writeFileSync(
      path.join(patchDir, "runtime-manifest.json"),
      JSON.stringify(hermesManifest)
    )

    mockDb.appRuntimeManifest.upsert.mockRejectedValueOnce(
      new Error("DB disk full")
    )
    const warnSpy = mock(() => {})
    const origWarn = console.warn
    console.warn = warnSpy as unknown as typeof console.warn

    const origEnv = process.env.BASE_IMAGE_PATH
    try {
      process.env.BASE_IMAGE_PATH = tmpDir
      const manifest = await service.getRuntimeManifest("hermes-agent")
      expect(manifest.runtime).toBe("hermes-agent")
      expect(manifest.ports.default).toBe(9119)
      expect(warnSpy).toHaveBeenCalledWith(
        "manifest upsert failed",
        expect.any(Error)
      )
    } finally {
      console.warn = origWarn
      process.env.BASE_IMAGE_PATH = origEnv
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it("handles corrupted or unparseable local manifest gracefully", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "base-image-test-"))
    const patchDir = path.join(tmpDir, "patches", "broken-agent")
    fs.mkdirSync(patchDir, { recursive: true })
    fs.writeFileSync(
      path.join(patchDir, "runtime-manifest.json"),
      "{ invalid json here ... "
    )

    const origEnv = process.env.BASE_IMAGE_PATH
    try {
      process.env.BASE_IMAGE_PATH = tmpDir
      const manifest = await service.getRuntimeManifest("broken-agent")
      expect(manifest.runtime).toBe("broken-agent")
      expect(manifest.ports.default).toBe(8080)
    } finally {
      process.env.BASE_IMAGE_PATH = origEnv
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
