import { describe, expect, it, mock } from "bun:test"
import {
  applyManualSettings,
  confirmDeploy,
  getDeploymentStatus,
  getGithubInstallUrl,
  getSession,
  inspectSource,
  selectResource,
  setEnvValues,
} from "./ai-deploy.api"

describe("ai-deploy.api", () => {
  it("inspectSource sends POST to /api/deploy/ai-sessions/inspect", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({ ok: true, data: { status: "plan_ready" } }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    }) as unknown as typeof fetch

    try {
      const result = await inspectSource("https://github.com/laravel/laravel")
      expect(result.status).toBe("plan_ready")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("getSession sends GET to /api/deploy/ai-sessions/:sessionId", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          data: { id: "sess-1", status: "PLAN_READY" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    }) as unknown as typeof fetch

    try {
      const result = await getSession("sess-1")
      expect(result.id).toBe("sess-1")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("applyManualSettings sends POST to /api/deploy/ai-sessions/:sessionId/manual-settings", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          data: { id: "sess-1", status: "PLAN_READY" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    }) as unknown as typeof fetch

    try {
      const result = await applyManualSettings("sess-1", {
        language: "Node.js",
        framework: "Next.js",
        runtimeVersion: "20",
        packageManager: "npm",
        buildCommand: "npm run build",
        startCommand: "npm run start",
        port: 3000,
        useDockerfile: false,
        dockerfilePath: null,
      })
      expect(result.id).toBe("sess-1")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("setEnvValues sends POST to /api/deploy/ai-sessions/:sessionId/environment-values", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          data: { id: "sess-1", status: "PLAN_READY" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    }) as unknown as typeof fetch

    try {
      const result = await setEnvValues("sess-1", [
        { key: "NODE_ENV", value: "production" },
      ])
      expect(result.id).toBe("sess-1")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("selectResource sends POST to /api/deploy/ai-sessions/:sessionId/resource-selection", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          data: { id: "sess-1", status: "PLAN_READY" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    }) as unknown as typeof fetch

    try {
      const result = await selectResource("sess-1", { resourcePlanId: "pro" })
      expect(result.id).toBe("sess-1")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("confirmDeploy sends POST to /api/deploy/ai-sessions/:sessionId/confirm", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          data: { id: "sess-1", status: "CONFIRMED" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    }) as unknown as typeof fetch

    try {
      const result = await confirmDeploy("sess-1", 1, "hash-123", "idemp-123")
      expect(result.status).toBe("CONFIRMED")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("getDeploymentStatus sends GET to /api/deploy/status/:deployId", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            status: "DEPLOYED",
            manifestPushed: true,
            argocdSynced: true,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    }) as unknown as typeof fetch

    try {
      const result = await getDeploymentStatus("deploy-123")
      expect(result.status).toBe("DEPLOYED")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("getGithubInstallUrl returns correct endpoint", () => {
    const url = getGithubInstallUrl()
    expect(url).toContain("/api/integrations/github/install/start")
  })

  it("throws error when API returns ok: false", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      )
    }) as unknown as typeof fetch

    try {
      expect(
        inspectSource("https://github.com/laravel/laravel")
      ).rejects.toThrow()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
