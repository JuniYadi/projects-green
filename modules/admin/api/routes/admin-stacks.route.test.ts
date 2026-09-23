import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import type {
  AdminActorContext,
  AdminApiError,
  requireSuperAdmin,
} from "@/modules/admin/api/admin.guards"
import type {
  AdminStackDTO,
  listAdminStacks,
  adminSuspendStack,
  adminResumeStack,
  adminDeployStack,
  adminDeleteStack,
  adminPurgeTerminatedStack,
} from "@/modules/deploy/admin-stacks.service"

mock.module("server-only", () => ({}))
mock.module("@/modules/admin/api/admin.guards", () => ({
  requireSuperAdmin: mock(async () => ({
    ok: true,
    userId: "user_admin",
    platformRole: "super_admin",
  })),
}))

const { createAdminStacksRoutes } = await import("./admin-stacks.route")

type GuardFn = typeof requireSuperAdmin
type ListStacksFn = typeof listAdminStacks
type SuspendStackFn = typeof adminSuspendStack
type ResumeStackFn = typeof adminResumeStack
type DeployStackFn = typeof adminDeployStack
type DeleteStackFn = typeof adminDeleteStack
type PurgeStackFn = typeof adminPurgeTerminatedStack

const mockStack: AdminStackDTO = {
  id: "stack_1",
  slug: "landing-web",
  name: "Landing Web",
  framework: "nextjs",
  organizationId: "org_alpha",
  organizationName: "Alpha Corp",
  status: "RUNNING",
  subdomain: "landing-web",
  customDomain: null,
  clusterName: "prod-cluster",
  clusterCode: "prod",
  cpu: 500,
  memory: 512,
  replicas: 1,
  billingMode: "PAYG",
  billingState: "ACTIVE",
  suspended: false,
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T10:00:00.000Z",
  lastDeployedAt: "2026-09-01T10:00:00.000Z",
  deploymentsCount: 3,
  terminatedAt: null,
  scheduledPurgeAt: null,
}

const mockListAdminStacks = mock(async () => ({
  data: [mockStack],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
}))

const mockSuspendStack = mock(async () => ({
  gitopsPushed: true,
  argocdSynced: true,
}))

const mockResumeStack = mock(async () => ({
  gitopsPushed: true,
  argocdSynced: true,
}))

const mockDeployStack = mock(async () => ({
  deploymentId: "deploy_123",
  status: "QUEUED",
}))

const mockDeleteStack = mock(async () => ({
  gitopsDeleted: true,
  argocdDeleted: true,
  stockReleased: true,
}))

const mockPurgeStack = mock(async () => ({
  gitopsDeleted: true,
  argocdDeleted: true,
  stockReleased: true,
}))

const mockGuard = mock<() => Promise<AdminActorContext | AdminApiError>>(
  async () => ({
    ok: true,
    userId: "user_admin",
    platformRole: "super_admin",
  })
)

beforeEach(() => {
  mockListAdminStacks.mockClear()
  mockSuspendStack.mockClear()
  mockResumeStack.mockClear()
  mockDeployStack.mockClear()
  mockDeleteStack.mockClear()
  mockPurgeStack.mockClear()
  mockGuard.mockClear()
  mockGuard.mockResolvedValue({
    ok: true,
    userId: "user_admin",
    platformRole: "super_admin",
  })
})

function makeApp() {
  return new Elysia().use(
    createAdminStacksRoutes({
      requireSuperAdmin: mockGuard as unknown as GuardFn,
      listAdminStacks: mockListAdminStacks as unknown as ListStacksFn,
      adminSuspendStack: mockSuspendStack as unknown as SuspendStackFn,
      adminResumeStack: mockResumeStack as unknown as ResumeStackFn,
      adminDeployStack: mockDeployStack as unknown as DeployStackFn,
      adminDeleteStack: mockDeleteStack as unknown as DeleteStackFn,
      adminPurgeTerminatedStack: mockPurgeStack as unknown as PurgeStackFn,
    })
  )
}

describe("GET /admin/app-hosting/stacks", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGuard.mockResolvedValueOnce({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Authentication required",
    })

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks")
    )
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("returns 403 when not super_admin", async () => {
    mockGuard.mockResolvedValueOnce({
      ok: false,
      error: "FORBIDDEN",
      message: "Super admin access required",
    })

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks")
    )
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("FORBIDDEN")
  })

  it("lists stacks and passes filters to service", async () => {
    const res = await makeApp().handle(
      new Request(
        "http://localhost/admin/app-hosting/stacks?organizationId=org_alpha&query=landing&status=RUNNING&page=1&limit=20"
      )
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: AdminStackDTO[]
      pagination: { total: number }
    }
    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].slug).toBe("landing-web")
    expect(body.pagination.total).toBe(1)

    expect(mockListAdminStacks).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      organizationId: "org_alpha",
      query: "landing",
      status: "RUNNING",
    })
  })
})

describe("POST /admin/app-hosting/stacks/:id/suspend", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGuard.mockResolvedValueOnce({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Authentication required",
    })

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1/suspend", {
        method: "POST",
      })
    )
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("suspends stack and returns result", async () => {
    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1/suspend", {
        method: "POST",
      })
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      message: string
      data: { gitopsPushed: boolean; argocdSynced: boolean }
    }
    expect(body.ok).toBe(true)
    expect(body.data.gitopsPushed).toBe(true)
    expect(body.data.argocdSynced).toBe(true)
    expect(body.message).toBe("Stack suspended successfully")
    expect(mockSuspendStack).toHaveBeenCalledWith("stack_1")
  })

  it("returns partial warning message when gitops push failed", async () => {
    mockSuspendStack.mockResolvedValueOnce({
      gitopsPushed: false,
      argocdSynced: false,
    })

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1/suspend", {
        method: "POST",
      })
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; message: string }
    expect(body.ok).toBe(true)
    expect(body.message).toContain("GitOps push failed")
  })

  it("returns 404 when stack not found", async () => {
    mockSuspendStack.mockRejectedValueOnce(
      new Error("NOT_FOUND: Stack stack_x not found")
    )

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_x/suspend", {
        method: "POST",
      })
    )

    expect(res.status).toBe(404)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("NOT_FOUND")
  })
})

describe("POST /admin/app-hosting/stacks/:id/resume", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGuard.mockResolvedValueOnce({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Authentication required",
    })

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1/resume", {
        method: "POST",
      })
    )
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("resumes stack and returns result", async () => {
    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1/resume", {
        method: "POST",
      })
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      message: string
      data: { gitopsPushed: boolean; argocdSynced: boolean }
    }
    expect(body.ok).toBe(true)
    expect(body.data.gitopsPushed).toBe(true)
    expect(body.data.argocdSynced).toBe(true)
    expect(body.message).toBe("Stack resumed successfully")
    expect(mockResumeStack).toHaveBeenCalledWith("stack_1")
  })

  it("returns partial warning message when gitops push failed", async () => {
    mockResumeStack.mockResolvedValueOnce({
      gitopsPushed: false,
      argocdSynced: false,
    })

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1/resume", {
        method: "POST",
      })
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; message: string }
    expect(body.ok).toBe(true)
    expect(body.message).toContain("GitOps push failed")
  })

  it("returns 404 when stack not found", async () => {
    mockResumeStack.mockRejectedValueOnce(
      new Error("NOT_FOUND: Stack stack_x not found")
    )

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_x/resume", {
        method: "POST",
      })
    )

    expect(res.status).toBe(404)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("NOT_FOUND")
  })

  it("returns 409 when stack already terminated", async () => {
    mockResumeStack.mockRejectedValueOnce(
      new Error("ALREADY_TERMINATED: Stack stack_1 is already terminated")
    )

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1/resume", {
        method: "POST",
      })
    )

    expect(res.status).toBe(409)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ALREADY_TERMINATED")
  })
})

describe("POST /admin/app-hosting/stacks/:id/deploy", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGuard.mockResolvedValueOnce({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Authentication required",
    })

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1/deploy", {
        method: "POST",
      })
    )
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("triggers deployment for stack and returns deployment data", async () => {
    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1/deploy", {
        method: "POST",
      })
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      message: string
      data: { deploymentId: string; status: string }
    }
    expect(body.ok).toBe(true)
    expect(body.data.deploymentId).toBe("deploy_123")
    expect(body.data.status).toBe("QUEUED")
    expect(mockDeployStack).toHaveBeenCalledWith("stack_1")
  })

  it("returns 404 when stack not found", async () => {
    mockDeployStack.mockRejectedValueOnce(
      new Error("NOT_FOUND: Stack stack_x not found")
    )

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_x/deploy", {
        method: "POST",
      })
    )

    expect(res.status).toBe(404)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("NOT_FOUND")
  })

  it("returns 409 when stack is already terminated", async () => {
    mockDeployStack.mockRejectedValueOnce(
      new Error("ALREADY_TERMINATED: Stack stack_term is already terminated")
    )

    const res = await makeApp().handle(
      new Request(
        "http://localhost/admin/app-hosting/stacks/stack_term/deploy",
        {
          method: "POST",
        }
      )
    )

    expect(res.status).toBe(409)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ALREADY_TERMINATED")
  })
})

describe("DELETE /admin/app-hosting/stacks/:id", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGuard.mockResolvedValueOnce({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Authentication required",
    })

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1", {
        method: "DELETE",
      })
    )
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("terminates stack and returns deletion flags with database retained", async () => {
    mockDeleteStack.mockResolvedValueOnce({
      gitopsDeleted: true,
      argocdDeleted: true,
      stockReleased: true,
    })

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1", {
        method: "DELETE",
      })
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      message: string
      data: {
        gitopsDeleted: boolean
        argocdDeleted: boolean
        stockReleased: boolean
      }
    }
    expect(body.ok).toBe(true)
    expect(body.message).toContain("terminated immediately in GitOps")
    expect(body.message).toContain("Record retained in database")
    expect(body.data.gitopsDeleted).toBe(true)
    expect(body.data.argocdDeleted).toBe(true)
    expect(mockDeleteStack).toHaveBeenCalledWith("stack_1")
  })

  it("returns accurate flags when gitops delete fails", async () => {
    mockDeleteStack.mockResolvedValueOnce({
      gitopsDeleted: false,
      argocdDeleted: false,
      stockReleased: true,
    })

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1", {
        method: "DELETE",
      })
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: { gitopsDeleted: boolean }
    }
    expect(body.ok).toBe(true)
    expect(body.data.gitopsDeleted).toBe(false)
  })

  it("returns 502 when gitops delete fails", async () => {
    mockDeleteStack.mockRejectedValueOnce(
      new Error("GITOPS_DELETE_FAILED: Failed to delete GitOps manifests")
    )

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1", {
        method: "DELETE",
      })
    )

    expect(res.status).toBe(502)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("GITOPS_DELETE_FAILED")
  })

  it("returns 404 when stack not found", async () => {
    mockDeleteStack.mockRejectedValueOnce(
      new Error("NOT_FOUND: Stack stack_x not found")
    )

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_x", {
        method: "DELETE",
      })
    )

    expect(res.status).toBe(404)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("NOT_FOUND")
  })

  it("returns 409 when stack is already terminated", async () => {
    mockDeleteStack.mockRejectedValueOnce(
      new Error("ALREADY_TERMINATED: Stack landing-web is already terminated")
    )

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1", {
        method: "DELETE",
      })
    )

    expect(res.status).toBe(409)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ALREADY_TERMINATED")
  })
})

describe("POST /admin/app-hosting/stacks/:id/purge", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGuard.mockResolvedValueOnce({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Authentication required",
    })

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1/purge", {
        method: "POST",
      })
    )
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("purges stack and returns result", async () => {
    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1/purge", {
        method: "POST",
      })
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      message: string
      data: {
        gitopsDeleted: boolean
        argocdDeleted: boolean
        stockReleased: boolean
      }
    }
    expect(body.ok).toBe(true)
    expect(body.message).toBe("Stack purged")
    expect(body.data.gitopsDeleted).toBe(true)
    expect(body.data.stockReleased).toBe(true)
    expect(mockPurgeStack).toHaveBeenCalledWith("stack_1")
  })

  it("returns 404 when stack not found", async () => {
    mockPurgeStack.mockRejectedValueOnce(
      new Error("NOT_FOUND: Stack stack_x not found")
    )

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_x/purge", {
        method: "POST",
      })
    )

    expect(res.status).toBe(404)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("NOT_FOUND")
  })

  it("returns 409 when stack is not in TERMINATED state", async () => {
    mockPurgeStack.mockRejectedValueOnce(
      new Error("NOT_TERMINATED: Stack landing-web is not terminated")
    )

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1/purge", {
        method: "POST",
      })
    )

    expect(res.status).toBe(409)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("NOT_TERMINATED")
  })
})

describe("500 INTERNAL_ERROR paths", () => {
  it("returns 500 when listStacks throws non-NOT_FOUND error", async () => {
    mockListAdminStacks.mockRejectedValueOnce(
      new Error("Database connection lost")
    )

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks")
    )

    expect(res.status).toBe(500)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INTERNAL_ERROR")
  })

  it("returns 500 when suspendStack throws non-NOT_FOUND error", async () => {
    mockSuspendStack.mockRejectedValueOnce(
      new Error("GitOps repo not accessible")
    )

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1/suspend", {
        method: "POST",
      })
    )

    expect(res.status).toBe(500)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INTERNAL_ERROR")
  })

  it("returns 500 when resumeStack throws non-NOT_FOUND error", async () => {
    mockResumeStack.mockRejectedValueOnce(
      new Error("GitOps repo not accessible")
    )

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1/resume", {
        method: "POST",
      })
    )

    expect(res.status).toBe(500)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INTERNAL_ERROR")
  })

  it("returns 500 when deployStack throws non-NOT_FOUND error", async () => {
    mockDeployStack.mockRejectedValueOnce(
      new Error("Pipeline worker unavailable")
    )

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1/deploy", {
        method: "POST",
      })
    )

    expect(res.status).toBe(500)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INTERNAL_ERROR")
  })

  it("returns 500 when deleteStack throws non-NOT_FOUND error", async () => {
    mockDeleteStack.mockRejectedValueOnce(new Error("DB constraint violation"))

    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1", {
        method: "DELETE",
      })
    )

    expect(res.status).toBe(500)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INTERNAL_ERROR")
  })
})
