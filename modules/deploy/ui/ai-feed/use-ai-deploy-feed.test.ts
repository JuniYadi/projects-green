import { describe, expect, it, mock } from "bun:test"
import { renderHook, act } from "@testing-library/react"
import { useAiDeployFeed } from "./use-ai-deploy-feed"
import type { AiDeploymentSessionDTO, AiInspectionDTO } from "./ai-deploy.types"
import type { DeploymentStatusDTO } from "./ai-deploy.api"

let mockInspectResponse: AiInspectionDTO = {
  status: "plan_ready",
  source: {
    url: "https://github.com/laravel/laravel",
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
      url: "https://github.com/laravel/laravel",
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
    deploymentId: "deploy-test",
    currentPlanVersion: 1,
    currentPlanHash: "hash-123",
    plan: {
      version: 1,
      source: {
        kind: "git",
        url: "https://github.com/laravel/laravel",
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
    blockedReason: null,
    confirmedAt: null,
    confirmationPlanHash: null,
    expiresAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
}

let mockDeploymentStatus: DeploymentStatusDTO = {
  status: "DEPLOYED",
  manifestPushed: true,
  argocdSynced: true,
  failureReason: null,
  attempt: 1,
}

mock.module("./ai-deploy.api", () => ({
  inspectSource: mock(async () => mockInspectResponse),
  getGithubInstallUrl: () => "/api/integrations/github/install/start",
  applyManualSettings: mock(async () => ({
    ...mockInspectResponse.session,
    status: "PLAN_READY" as const,
  })),
  setEnvValues: mock(async () => ({
    ...mockInspectResponse.session,
    status: "PLAN_READY" as const,
  })),
  selectResource: mock(async () => ({
    ...mockInspectResponse.session,
    status: "PLAN_READY" as const,
  })),
  confirmDeploy: mock(async () => ({
    ...mockInspectResponse.session,
    status: "CONFIRMED" as const,
    deploymentId: "deploy-test",
  })),
  getDeploymentStatus: mock(async () => mockDeploymentStatus),
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

  it("handles connection_required and denied access states", async () => {
    mockInspectResponse = {
      ...mockInspectResponse,
      access: {
        state: "connection_required",
        displayLabel: "Connect required",
      },
      status: "manual_override_required",
      manualOverride: {
        message: "Need config",
        fields: ["framework"],
        required: true,
        reasonCode: "ACCESS_REQUIRED",
        evidenceReferences: [],
      },
    }

    const { result } = renderHook(() => useAiDeployFeed())
    await act(async () => {
      await result.current.submit("https://github.com/private/repo")
    })

    expect(result.current.items.some((i) => i.kind === "access_required")).toBe(
      true
    )

    mockInspectResponse = {
      ...mockInspectResponse,
      access: { state: "denied", displayLabel: "Denied" },
      status: "blocked",
      manualOverride: {
        message: "Denied",
        fields: [],
        required: true,
        reasonCode: "ACCESS_DENIED",
        evidenceReferences: [],
      },
    }

    await act(async () => {
      await result.current.submit("https://github.com/denied/repo")
    })

    expect(result.current.items.some((i) => i.kind === "access_denied")).toBe(
      true
    )
    expect(
      result.current.items.some((i) => i.kind === "detection_failed")
    ).toBe(true)
  })

  it("handles not_supported inspection status", async () => {
    mockInspectResponse = {
      ...mockInspectResponse,
      access: { state: "public", displayLabel: "Public" },
      status: "not_supported",
      manualOverride: {
        message: "Unsupported repo",
        fields: [],
        required: true,
        reasonCode: "DETECTION_UNSUPPORTED",
        evidenceReferences: [],
      },
    }

    const { result } = renderHook(() => useAiDeployFeed())
    await act(async () => {
      await result.current.submit("https://github.com/other/repo")
    })

    expect(result.current.items.some((i) => i.kind === "not_supported")).toBe(
      true
    )
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
    mockInspectResponse = {
      ...mockInspectResponse,
      status: "plan_ready",
    }
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

  it("sets environment values and updates session", async () => {
    mockInspectResponse = {
      ...mockInspectResponse,
      status: "plan_ready",
    }
    const { result } = renderHook(() => useAiDeployFeed())

    await act(async () => {
      await result.current.submit("https://github.com/laravel/laravel")
    })

    await act(async () => {
      await result.current.setEnvValues([
        { key: "APP_KEY", value: "secret123" },
      ])
    })

    expect(result.current.session?.id).toBe("sess-test")
  })

  it("selects resource plan and updates session", async () => {
    mockInspectResponse = {
      ...mockInspectResponse,
      status: "plan_ready",
    }
    const { result } = renderHook(() => useAiDeployFeed())

    await act(async () => {
      await result.current.submit("https://github.com/laravel/laravel")
    })

    await act(async () => {
      await result.current.selectResource({ resourcePlanId: "pro" })
    })

    expect(result.current.session?.id).toBe("sess-test")
  })

  it("executes confirm and tracks live deployment status", async () => {
    mockInspectResponse = {
      ...mockInspectResponse,
      status: "plan_ready",
    }
    mockDeploymentStatus = {
      status: "DEPLOYED",
      manifestPushed: true,
      argocdSynced: true,
      failureReason: null,
      attempt: 1,
    }

    const { result } = renderHook(() => useAiDeployFeed())

    await act(async () => {
      await result.current.submit("https://github.com/laravel/laravel")
    })

    await act(async () => {
      await result.current.confirm("idemp-123")
    })

    expect(result.current.items.some((i) => i.kind === "deploying")).toBe(true)
    expect(result.current.items.some((i) => i.kind === "live")).toBe(true)
  })

  it("executes confirm and tracks failed deployment status", async () => {
    mockInspectResponse = {
      ...mockInspectResponse,
      status: "plan_ready",
    }
    mockDeploymentStatus = {
      status: "FAILED",
      manifestPushed: false,
      argocdSynced: false,
      failureReason: "Build failed",
      attempt: 1,
    }

    const { result } = renderHook(() => useAiDeployFeed())

    await act(async () => {
      await result.current.submit("https://github.com/laravel/laravel")
    })

    await act(async () => {
      await result.current.confirm("idemp-456")
    })

    expect(result.current.items.some((i) => i.kind === "failed")).toBe(true)
  })

  it("supports retrying last submitted URL", async () => {
    mockInspectResponse = {
      ...mockInspectResponse,
      status: "plan_ready",
    }
    const { result } = renderHook(() => useAiDeployFeed())

    await act(async () => {
      await result.current.submit("https://github.com/laravel/laravel")
    })

    await act(async () => {
      await result.current.retry()
    })

    expect(result.current.items.length).toBeGreaterThan(0)
  })

  it("connectGithub opens popup and cancelGithubConnect closes it", () => {
    const originalOpen = window.open
    const mockWindow = {
      closed: false,
      close: mock(() => {}),
    } as unknown as Window
    window.open = mock(() => mockWindow)

    const { result } = renderHook(() => useAiDeployFeed())

    act(() => {
      result.current.connectGithub()
    })
    expect(result.current.githubPopupPending).toBe(true)

    act(() => {
      result.current.cancelGithubConnect()
    })
    expect(result.current.githubPopupPending).toBe(false)
    expect(mockWindow.close).toHaveBeenCalled()

    window.open = originalOpen
  })
})
