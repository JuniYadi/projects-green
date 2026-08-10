import { describe, expect, it, mock } from "bun:test"
import type { AiDeploymentSession, PrismaClient } from "@prisma/client"

mock.module("@/lib/prisma", () => ({ prisma: {} }))

import {
  AiDeploymentSessionStatus,
  AiDeploymentSourceType,
} from "@prisma/client"
import type { AiSourceInspectionRequestDTO } from "./ai-source-inspection.dto"
import type { DetectionResult } from "@/modules/framework-detection/framework-detection.types"

const { AiSourceInspectionService, normalizeGithubSource } =
  await import("./ai-source-inspection.service")
const { FrameworkDetectionError } =
  await import("@/modules/framework-detection/framework-detection.service")

const actor = { organizationId: "org-1", userId: "user-1" }

const session = (
  overrides: Partial<AiDeploymentSession> = {}
): AiDeploymentSession => ({
  id: "session-1",
  organizationId: "org-1",
  workosUserId: "user-1",
  status: AiDeploymentSessionStatus.COLLECTING,
  sourceType: AiDeploymentSourceType.SOURCE,
  currentPlanVersion: 1,
  currentPlanHash: null,
  plan: null,
  serverContext: null,
  executionRefs: null,
  blockedReason: null,
  confirmedBy: null,
  confirmedAt: null,
  confirmationPlanHash: null,
  idempotencyKey: null,
  expiresAt: new Date("2026-08-11T00:00:00.000Z"),
  createdAt: new Date("2026-08-10T00:00:00.000Z"),
  updatedAt: new Date("2026-08-10T00:00:00.000Z"),
  ...overrides,
})

const detection = (): DetectionResult => ({
  primaryFramework: {
    id: "nextjs",
    name: "Next.js",
    ecosystem: "node" as const,
    confidence: 0.96,
    reasons: ["next dependency is present"],
  },
  requiredDependencies: [
    {
      id: "node" as const,
      kind: "runtime" as const,
      requiredFor: "app_runtime" as const,
      confidence: 0.9,
      reason: "JavaScript lockfile indicates Node runtime is required",
    },
  ],
  alternatives: [],
  confidence: 0.96,
  decision: {
    status: "success" as const,
    message: "Ready to deploy.",
    isLaunchable: true,
  },
  evidence: [
    {
      type: "file" as const,
      value: "package.json",
      detail: "package.json manifest",
    },
  ],
  warnings: [],
  source: {
    repoUrl: "https://github.com/acme/storefront",
    ref: "main",
  },
  inspectionLogId: "inspection-1",
  frameworkVersion: "16.1.0",
  defaultPort: 3000,
})

const safePlan = () => ({
  version: 1,
  source: {
    kind: "git" as const,
    url: "https://github.com/acme/storefront",
    host: "github.com",
    ref: "main",
    templateId: null,
  },
  access: {
    state: "public" as const,
    displayLabel: "Public GitHub repository",
  },
  detection: {
    runtime: "node",
    framework: "nextjs",
    version: "16.1.0",
    commands: [],
    port: 3000,
    confidence: 0.96,
    evidence: [
      {
        kind: "file",
        summary: "package.json manifest",
        reference: "package.json",
      },
    ],
  },
  configuration: {
    appName: "storefront",
    branchOrRef: "main",
    environment: "production" as const,
    envRequirements: [],
  },
  dependencies: [],
  resources: {
    package: "pro",
    server: null,
    region: null,
    cpu: 500,
    memory: 1024,
    storage: null,
  },
  domain: { mode: "auto" as const, hostname: null, tls: true },
  billing: {
    quoteReference: null,
    currency: null,
    estimate: null,
    interval: null,
  },
  execution: {
    ready: true,
    steps: [
      {
        key: "resolve_source",
        label: "Source verified",
        status: "ready" as const,
        evidenceReference: "https://github.com/acme/storefront",
      },
      {
        key: "inspect_runtime",
        label: "Runtime inspected",
        status: "ready" as const,
        evidenceReference: "inspection-log:inspection-1",
      },
      {
        key: "validate_plan",
        label: "Plan validated",
        status: "ready" as const,
        evidenceReference: null,
      },
      {
        key: "await_confirmation",
        label: "Awaiting confirmation",
        status: "pending" as const,
        evidenceReference: null,
      },
    ],
  },
  unresolved: [],
  provenance: {
    analyzer: "framework-detector",
    sourceReference: "inspection-1",
    analyzedAt: "2026-08-10T00:00:00.000Z",
  },
})

const createHarness = (
  overrides: {
    publicAccess?:
      | { accessible: true }
      | {
          accessible: false
          reason: "private_or_missing" | "ref_not_found" | "unavailable"
        }
    connection?: unknown
    detectPublic?: typeof detection
    detectGithub?: typeof detection
    initialSession?: Partial<AiDeploymentSession>
  } = {}
) => {
  let current = session(overrides.initialSession)
  const create = mock(async () => {
    current = session()
    return current
  })
  const get = mock(async () => current)
  const transition = mock(
    async (input: {
      status: AiDeploymentSessionStatus
      plan?: unknown
      blockedReason?: string | null
      serverContext?: unknown
    }) => {
      current = session({
        ...current,
        status: input.status,
        plan: input.status === "PLAN_READY" ? safePlan() : current.plan,
        blockedReason: input.blockedReason ?? null,
        serverContext: input.serverContext ?? current.serverContext,
      })
      return current
    }
  )
  const db = {
    githubRepositoryConnection: {
      findFirst: mock(async () => overrides.connection ?? null),
    },
    detectorRule: {
      findMany: mock(async () => []),
    },
  } as unknown as PrismaClient
  const detectPublic = mock(async () => detection())
  const detectGithub = mock(async () => detection())
  const service = new AiSourceInspectionService({
    db,
    sessions: { create, get, transition },
    checkPublicAccess: async () =>
      overrides.publicAccess ?? { accessible: true },
    detectPublic,
    detectGithub,
    now: () => new Date("2026-08-10T00:00:00.000Z"),
  })

  return { service, create, get, transition, detectPublic, detectGithub, db }
}

const inspectRequest = (
  overrides: Partial<AiSourceInspectionRequestDTO> = {}
): AiSourceInspectionRequestDTO => ({
  sourceUrl: "https://github.com/acme/storefront",
  ref: "main",
  ...overrides,
})

describe("normalizeGithubSource", () => {
  it("normalizes GitHub HTTPS URLs and query refs", () => {
    expect(
      normalizeGithubSource({
        sourceUrl: "HTTPS://github.com/acme/storefront.git?ref=release",
      })
    ).toEqual({
      ok: true,
      source: {
        url: "https://github.com/acme/storefront",
        host: "github.com",
        owner: "acme",
        repo: "storefront",
        ref: "release",
        subdir: null,
      },
    })
  })

  it("rejects non-GitHub or non-HTTPS sources", () => {
    expect(
      normalizeGithubSource({ sourceUrl: "https://gitlab.com/acme/app" }).ok
    ).toBe(false)
    expect(
      normalizeGithubSource({ sourceUrl: "http://github.com/acme/app" }).ok
    ).toBe(false)
    expect(
      normalizeGithubSource({
        sourceUrl: "https://github.com/acme/app/tree/main",
      }).ok
    ).toBe(false)
  })
})

describe("AiSourceInspectionService", () => {
  it("returns not_supported without creating a session", async () => {
    const harness = createHarness()

    const result = await harness.service.inspect({
      actor,
      request: inspectRequest({ sourceUrl: "https://gitlab.com/acme/app" }),
    })

    expect(result.status).toBe("not_supported")
    expect(result.session).toBeNull()
    expect(harness.create).not.toHaveBeenCalled()
    expect(
      harness.db.githubRepositoryConnection.findFirst
    ).not.toHaveBeenCalled()
  })

  it("inspects a public source once and reaches PLAN_READY", async () => {
    const harness = createHarness()

    const result = await harness.service.inspect({
      actor,
      request: inspectRequest(),
    })

    expect(result.status).toBe("plan_ready")
    expect(result.access?.state).toBe("public")
    expect(result.plan?.source.url).toBe("https://github.com/acme/storefront")
    expect(result.evidenceReferences).toContain("package.json")
    expect(harness.detectPublic).toHaveBeenCalledTimes(1)
    expect(harness.detectGithub).not.toHaveBeenCalled()
    expect(harness.transition).toHaveBeenCalledWith(
      expect.objectContaining({ status: "INSPECTING" })
    )
    expect(harness.transition).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PLAN_READY" })
    )
  })

  it("uses an existing tenant connection for private access", async () => {
    const harness = createHarness({
      publicAccess: { accessible: false, reason: "private_or_missing" },
      connection: {
        id: "connection-1",
        enabled: true,
        defaultBranch: "main",
        isPrivate: true,
        installation: {
          githubInstallationId: BigInt(123),
          organizationId: "org-1",
          status: "active",
        },
      },
    })

    const result = await harness.service.inspect({
      actor,
      request: inspectRequest({ ref: undefined }),
    })

    expect(result.status).toBe("plan_ready")
    expect(result.access?.state).toBe("credential")
    expect(result.source?.ref).toBe("main")
    expect(harness.detectGithub).toHaveBeenCalledTimes(1)
    expect(harness.detectGithub).toHaveBeenCalledWith(
      expect.objectContaining({ installationId: 123, ref: "main" }),
      expect.anything()
    )
  })

  it("blocks a valid private source that needs a connection", async () => {
    const harness = createHarness({
      publicAccess: { accessible: false, reason: "private_or_missing" },
    })

    const result = await harness.service.inspect({
      actor,
      request: inspectRequest(),
    })

    expect(result.status).toBe("blocked")
    expect(result.access?.state).toBe("connection_required")
    expect(result.manualOverride).toBeNull()
    expect(result.session?.status).toBe("BLOCKED")
    expect(harness.detectGithub).not.toHaveBeenCalled()
  })

  it("blocks a missing public ref as denied access", async () => {
    const harness = createHarness({
      publicAccess: { accessible: false, reason: "ref_not_found" },
    })

    const result = await harness.service.inspect({
      actor,
      request: inspectRequest(),
    })

    expect(result.status).toBe("blocked")
    expect(result.access?.state).toBe("denied")
    expect(result.session?.serverContext).toMatchObject({
      inspection: { reasonCode: "SOURCE_REF_NOT_FOUND" },
    })
    expect(harness.detectPublic).not.toHaveBeenCalled()
  })

  it("does not reuse a ready plan after access is revoked", async () => {
    const harness = createHarness({
      initialSession: {
        status: AiDeploymentSessionStatus.PLAN_READY,
        plan: safePlan(),
        serverContext: {
          source: {
            url: "https://github.com/acme/storefront",
            host: "github.com",
            owner: "acme",
            repo: "storefront",
            ref: "main",
            subdir: null,
          },
          inspection: {
            outcome: "plan_ready",
            reasonCode: null,
            evidenceReferences: ["package.json"],
          },
        },
      },
      publicAccess: { accessible: false, reason: "private_or_missing" },
    })

    const result = await harness.service.inspect({
      actor,
      request: inspectRequest({ sessionId: "session-1" }),
    })

    expect(result.status).toBe("blocked")
    expect(result.access?.state).toBe("connection_required")
    expect(result.plan).toBeNull()
    expect(harness.transition).toHaveBeenCalledWith(
      expect.objectContaining({ status: "COLLECTING" })
    )
  })

  it("maps detection failure to a recoverable manual override", async () => {
    const harness = createHarness()
    harness.detectPublic.mockRejectedValue(new Error("provider returned error"))

    const result = await harness.service.inspect({
      actor,
      request: inspectRequest(),
    })

    expect(result.status).toBe("manual_override_required")
    expect(result.manualOverride?.reasonCode).toBe("DETECTION_FAILED")
    expect(result.manualOverride?.fields).toContain("buildCommand")
    expect(result.session?.status).toBe("BLOCKED")
  })

  it("persists inspection-log evidence when detection fails", async () => {
    const harness = createHarness()
    harness.detectPublic.mockRejectedValue(
      new FrameworkDetectionError(
        "DETECTION_PROVIDER_ERROR",
        "provider returned error",
        "inspection-failure"
      )
    )

    const result = await harness.service.inspect({
      actor,
      request: inspectRequest(),
    })

    expect(result.evidenceReferences).toEqual([
      "inspection-log:inspection-failure",
    ])
    expect(result.session?.serverContext).toMatchObject({
      inspection: {
        evidenceReferences: ["inspection-log:inspection-failure"],
      },
    })
  })

  it("does not silently promote provider fallback results to a ready plan", async () => {
    const harness = createHarness()
    harness.detectPublic.mockResolvedValue({
      ...detection(),
      warnings: [
        "AI provider failed; deterministic GitHub evidence fallback used",
      ],
    })

    const result = await harness.service.inspect({
      actor,
      request: inspectRequest(),
    })

    expect(result.status).toBe("manual_override_required")
    expect(result.manualOverride?.reasonCode).toBe("DETECTION_PROVIDER_ERROR")
  })

  it("scopes repository lookup to the acting tenant", async () => {
    const harness = createHarness({
      publicAccess: { accessible: false, reason: "private_or_missing" },
    })

    await harness.service.inspect({
      actor,
      request: inspectRequest(),
    })

    expect(
      harness.db.githubRepositoryConnection.findFirst
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          installation: {
            OR: [
              { organizationId: "org-1" },
              { organizationId: null, workosUserId: "user-1" },
            ],
          },
        }),
      })
    )
  })
})
