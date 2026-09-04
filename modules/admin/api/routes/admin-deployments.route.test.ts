import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import type {
  AdminActorContext,
  AdminApiError,
  requireSuperAdmin,
} from "@/modules/admin/api/admin.guards"
import type {
  AdminDeploymentDTO,
  listAdminDeployments,
} from "@/modules/deploy/admin-deployments.service"

mock.module("server-only", () => ({}))
mock.module("@/modules/admin/api/admin.guards", () => ({
  requireSuperAdmin: mock(async () => ({
    ok: true,
    userId: "user_admin",
    platformRole: "super_admin",
  })),
}))

const { createAdminDeploymentsRoutes } =
  await import("./admin-deployments.route")

type GuardFn = typeof requireSuperAdmin
type ListDeploymentsFn = typeof listAdminDeployments

const mockDeployment: AdminDeploymentDTO = {
  id: "dep_123",
  stackId: "stack_1",
  stackSlug: "my-web-app",
  stackName: "My Web App",
  organizationId: "org_alpha",
  status: "RUNNING",
  triggerType: "MANUAL",
  commitSha: "a1b2c3d",
  commitMessage: "feat: add landing hero",
  commitAuthor: "Alice",
  branchName: "main",
  startedAt: "2026-09-01T10:00:00.000Z",
  completedAt: "2026-09-01T10:02:00.000Z",
  durationMs: 120000,
  failureReason: null,
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T10:02:00.000Z",
  eventsCount: 5,
}

const mockListAdminDeployments = mock(async () => ({
  data: [mockDeployment],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
}))

const mockGuard = mock<() => Promise<AdminActorContext | AdminApiError>>(
  async () => ({
    ok: true,
    userId: "user_admin",
    platformRole: "super_admin",
  })
)

beforeEach(() => {
  mockListAdminDeployments.mockClear()
  mockGuard.mockClear()
})

describe("GET /admin/deployments", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGuard.mockResolvedValueOnce({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Authentication required",
    })

    const app = new Elysia().use(
      createAdminDeploymentsRoutes({
        requireSuperAdmin: mockGuard as unknown as GuardFn,
        listAdminDeployments:
          mockListAdminDeployments as unknown as ListDeploymentsFn,
      })
    )

    const res = await app.handle(
      new Request("http://localhost/admin/deployments")
    )
    expect(res.status).toBe(200)
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

    const app = new Elysia().use(
      createAdminDeploymentsRoutes({
        requireSuperAdmin: mockGuard as unknown as GuardFn,
        listAdminDeployments:
          mockListAdminDeployments as unknown as ListDeploymentsFn,
      })
    )

    const res = await app.handle(
      new Request("http://localhost/admin/deployments")
    )
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("FORBIDDEN")
  })

  it("passes organizationId, query, and status filters to service", async () => {
    const app = new Elysia().use(
      createAdminDeploymentsRoutes({
        requireSuperAdmin: mockGuard as unknown as GuardFn,
        listAdminDeployments:
          mockListAdminDeployments as unknown as ListDeploymentsFn,
      })
    )

    const res = await app.handle(
      new Request(
        "http://localhost/admin/deployments?organizationId=org_alpha&query=my-web-app&status=RUNNING&page=2&limit=10"
      )
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: AdminDeploymentDTO[]
      pagination: { page: number }
    }
    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe("dep_123")
    expect(body.pagination.page).toBe(1)

    expect(mockListAdminDeployments).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      organizationId: "org_alpha",
      query: "my-web-app",
      status: "RUNNING",
    })
  })
})
