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
  adminDeleteStack,
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
type DeleteStackFn = typeof adminDeleteStack

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

const mockDeleteStack = mock(async () => ({
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
  mockDeleteStack.mockClear()
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
      adminDeleteStack: mockDeleteStack as unknown as DeleteStackFn,
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

  it("terminates stack and returns result with accurate flags", async () => {
    const res = await makeApp().handle(
      new Request("http://localhost/admin/app-hosting/stacks/stack_1", {
        method: "DELETE",
      })
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: {
        gitopsDeleted: boolean
        argocdDeleted: boolean
        stockReleased: boolean
      }
    }
    expect(body.ok).toBe(true)
    expect(body.data.gitopsDeleted).toBe(true)
    expect(body.data.argocdDeleted).toBe(true)
    expect(body.data.stockReleased).toBe(true)
    expect(mockDeleteStack).toHaveBeenCalledWith("stack_1")
  })

  it("returns accurate flags when argocd delete fails", async () => {
    mockDeleteStack.mockResolvedValueOnce({
      gitopsDeleted: true,
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
      data: { argocdDeleted: boolean }
    }
    expect(body.ok).toBe(true)
    expect(body.data.argocdDeleted).toBe(false)
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
})
