import { describe, expect, it, mock } from "bun:test"
import { renderHook, act } from "@testing-library/react"
import { useAiDeployFeed } from "./use-ai-deploy-feed"

mock.module("./ai-deploy.api", () => ({
  inspectSource: mock(async (url: string) => ({
    status: "plan_ready",
    source: {
      url,
      host: "github.com",
      owner: "laravel",
      repo: "laravel",
      ref: "main",
      subdir: null,
    },
    access: { state: "public", displayLabel: "Public" },
    detection: {
      framework: "laravel",
      frameworkVersion: "11",
      primaryEngine: "php",
      primaryEngineVersion: "8.2",
      buildCommand: null,
      startCommand: null,
      defaultPort: 80,
      useDockerfile: false,
      dockerfilePath: null,
      confidence: 0.95,
      status: "detected",
      evidence: [],
    },
    plan: {
      version: 1,
      source: {
        kind: "git",
        url,
        host: "github.com",
        ref: "main",
        templateId: null,
      },
      access: { state: "verified", displayLabel: "Public" },
      detection: {
        runtime: "php",
        framework: "laravel",
        version: "11",
        commands: [],
        port: 80,
        confidence: 0.95,
        evidence: [],
      },
      configuration: {
        appName: "laravel",
        branchOrRef: "main",
        environment: "production",
        envRequirements: [],
      },
      dependencies: [],
      resources: {
        package: "payg",
        server: null,
        region: null,
        cpu: 500,
        memory: 1024,
        storage: null,
      },
      domain: { mode: "auto", hostname: "laravel.pfn.app", tls: true },
      billing: {
        quoteReference: null,
        currency: "USD",
        estimate: 0.035,
        interval: "hour",
      },
      execution: { ready: true, steps: [] },
      unresolved: [],
      provenance: {
        analyzer: "ai",
        sourceReference: null,
        analyzedAt: new Date().toISOString(),
      },
    },
    manualOverride: null,
    evidenceReferences: [],
    session: {
      id: "sess-test",
      status: "PLAN_READY",
      sourceType: "SOURCE",
      stackId: null,
      deploymentId: null,
      currentPlanVersion: 1,
      currentPlanHash: "hash-123",
      plan: null,
      blockedReason: null,
      confirmedAt: null,
      confirmationPlanHash: null,
      expiresAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })),
  getGithubInstallUrl: () => "/api/integrations/github/install/start",
  applyManualSettings: mock(async () => ({
    id: "sess-test",
    status: "PLAN_READY",
  })),
  setEnvValues: mock(async () => ({ id: "sess-test", status: "PLAN_READY" })),
  selectResource: mock(async () => ({ id: "sess-test", status: "PLAN_READY" })),
  confirmDeploy: mock(async () => ({
    id: "sess-test",
    status: "CONFIRMED",
    deploymentId: "deploy-test",
  })),
  getDeploymentStatus: mock(async () => ({
    status: "DEPLOYED",
    manifestPushed: true,
    argocdSynced: true,
    failureReason: null,
    attempt: 1,
  })),
}))

describe("useAiDeployFeed", () => {
  it("initializes with empty items and no session", () => {
    const { result } = renderHook(() => useAiDeployFeed())
    expect(result.current.items).toEqual([])
    expect(result.current.session).toBeNull()
    expect(result.current.isInspecting).toBe(false)
  })

  it("submits valid GitHub URL and pushes feed items", async () => {
    const { result } = renderHook(() => useAiDeployFeed())

    await act(async () => {
      await result.current.submit("https://github.com/laravel/laravel")
    })

    expect(result.current.items.length).toBeGreaterThan(0)
    expect(result.current.items.some((i) => i.kind === "plan_ready")).toBe(true)
    expect(result.current.session?.id).toBe("sess-test")
  })

  it("handles non-GitHub URL by pushing not_supported item", async () => {
    const { result } = renderHook(() => useAiDeployFeed())

    await act(async () => {
      await result.current.submit("https://gitlab.com/test/repo")
    })

    expect(result.current.items.some((i) => i.kind === "not_supported")).toBe(
      true
    )
  })

  it("resets state when reset is called", async () => {
    const { result } = renderHook(() => useAiDeployFeed())

    await act(async () => {
      await result.current.submit("https://github.com/laravel/laravel")
    })
    expect(result.current.items.length).toBeGreaterThan(0)

    act(() => {
      result.current.reset()
    })
    expect(result.current.items).toEqual([])
    expect(result.current.session).toBeNull()
  })

  it("applies manual settings and updates session", async () => {
    const { result } = renderHook(() => useAiDeployFeed())

    await act(async () => {
      await result.current.submit("https://github.com/laravel/laravel")
    })

    await act(async () => {
      await result.current.applyManualSettings({
        language: "PHP",
        framework: "Laravel",
        runtimeVersion: "8.2",
        packageManager: "composer",
        buildCommand: "composer install",
        startCommand: "php artisan serve",
        port: 80,
        useDockerfile: false,
        dockerfilePath: null,
      })
    })

    expect(result.current.session?.id).toBe("sess-test")
  })

  it("selects resource plan and updates session", async () => {
    const { result } = renderHook(() => useAiDeployFeed())

    await act(async () => {
      await result.current.submit("https://github.com/laravel/laravel")
    })

    await act(async () => {
      await result.current.selectResource({ resourcePlanId: "pro" })
    })

    expect(result.current.session?.id).toBe("sess-test")
  })
})
