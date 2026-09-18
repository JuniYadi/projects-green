import { describe, expect, it, mock } from "bun:test"

import {
  createRuntimeKnowledgeTools,
  GET_RUNTIME_TUNABLES_SCHEMA,
} from "./runtime-knowledge.tool"

describe("runtime-knowledge.tool", () => {
  it("validates input schema", () => {
    const valid = GET_RUNTIME_TUNABLES_SCHEMA.safeParse({ framework: "laravel" })
    expect(valid.success).toBe(true)

    const invalid = GET_RUNTIME_TUNABLES_SCHEMA.safeParse({})
    expect(invalid.success).toBe(false)
  })

  it("executes get_runtime_tunables tool and returns tunables and operational info", async () => {
    const mockService = {
      getRuntimeManifest: mock(async (fw: string) => ({
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
        ],
      })),
    }

    const tools = createRuntimeKnowledgeTools({
      manifestService:
        mockService as unknown as import("@/modules/deploy/runtime-manifest.service").RuntimeManifestService,
    })

    const result = (await tools.get_runtime_tunables.execute?.(
      { framework: "laravel" },
      { messages: [], toolCallId: "call-1" }
    )) as {
      framework: string
      runtime: string
      ports: { default: number }
      security: { runAsUser: number }
      tunables: Array<{ key: string }>
      summary: string
    }

    expect(result.framework).toBe("Laravel")
    expect(result.runtime).toBe("laravel")
    expect(result.ports.default).toBe(8080)
    expect(result.security.runAsUser).toBe(10001)
    expect(result.tunables).toHaveLength(1)
    expect(result.tunables[0].key).toBe("PHP_UPLOAD_MAX_FILESIZE")
    expect(result.summary).toContain("PHP_UPLOAD_MAX_FILESIZE")
  })

  it("works with default service fallback for bun and nextjs", async () => {
    const tools = createRuntimeKnowledgeTools()

    const result = (await tools.get_runtime_tunables.execute?.(
      { framework: "bun" },
      { messages: [], toolCallId: "call-2" }
    )) as {
      runtime: string
      ports: { default: number }
      security: { runAsUser: number }
      tunables: Array<{ key: string }>
    }

    expect(result.runtime).toBe("bun")
    expect(result.ports.default).toBe(8080)
    expect(result.security.runAsUser).toBe(10001)
    expect(result.tunables.some((t: any) => t.key === "BUN_ENV")).toBe(true)
  })
})
