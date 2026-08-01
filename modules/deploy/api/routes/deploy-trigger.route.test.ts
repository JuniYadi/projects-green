import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

const mockWithAuth = mock(async () => ({
  user: { id: "user-123", email: "test@example.com" },
  organizationId: "org-1",
  role: "admin",
  roles: ["admin"],
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mock(async () => "member"),
}))

const stackRecord = {
  id: "stack-1",
  organizationId: "org-1",
  status: "FAILED",
  metadataJson: null,
  billingMode: "PACKAGE",
  resourcePlanId: "starter",
  hourlyCost: null,
  branchName: "main",
}

const mockPrisma = {
  $transaction: mock(async (callback: (tx: typeof mockPrisma) => unknown) =>
    callback(mockPrisma)
  ),
  applicationStack: {
    findUnique: mock(async () => ({ ...stackRecord })),
    findUniqueOrThrow: mock(async () => ({ ...stackRecord })),
    update: mock(async () => ({ ...stackRecord })),
  },
  applicationDeployment: {
    count: mock(async () => 1),
    create: mock(async () => ({ id: "deployment-2", status: "QUEUED" })),
  },
  applicationDeployEvent: {
    create: mock(async () => ({ id: "event-1" })),
  },
  applicationDeploymentLog: {
    create: mock(async () => ({ id: "log-1" })),
  },
  billingAccount: {
    findUnique: mock(async () => ({
      id: "billing-1",
      organizationId: "org-1",
      currency: "USD",
      balance: new Prisma.Decimal("100.00"),
    })),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const mockRollbackDeployment = mock(async () => ({
  deploymentId: "deployment-rollback",
  status: "QUEUED" as const,
}))

mock.module("../../deploy-rollback.service", () => ({
  rollbackDeployment: mockRollbackDeployment,
  getRollbackOptions: mock(async () => []),
}))

const { deployTriggerRoutes } = await import("./deploy-trigger.route")

const post = (body: unknown = {}) =>
  deployTriggerRoutes.handle(
    new Request("http://localhost/deploy/trigger/stack-1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )

const postRollback = (body: unknown = {}) =>
  deployTriggerRoutes.handle(
    new Request("http://localhost/deploy/rollback/stack-1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )

const setStack = (value: unknown) => {
  mockPrisma.applicationStack.findUnique.mockResolvedValue(value as never)
  mockPrisma.applicationStack.findUniqueOrThrow.mockResolvedValue(
    value as never
  )
}

const resetMocks = () => {
  mockWithAuth.mockClear()
  mockPrisma.$transaction.mockClear()
  mockPrisma.applicationStack.findUnique.mockClear()
  mockPrisma.applicationStack.findUniqueOrThrow.mockClear()
  mockPrisma.applicationStack.update.mockClear()
  mockPrisma.applicationDeployment.count.mockClear()
  mockPrisma.applicationDeployment.create.mockClear()
  mockPrisma.applicationDeployEvent.create.mockClear()
  mockPrisma.applicationDeploymentLog.create.mockClear()
  mockPrisma.billingAccount.findUnique.mockClear()
  mockRollbackDeployment.mockClear()
  setStack({ ...stackRecord })
  mockPrisma.applicationDeployment.count.mockResolvedValue(1 as never)
  mockPrisma.applicationDeployment.create.mockResolvedValue({
    id: "deployment-2",
    status: "QUEUED",
  } as never)
  mockPrisma.billingAccount.findUnique.mockResolvedValue({
    id: "billing-1",
    organizationId: "org-1",
    currency: "USD",
    balance: new Prisma.Decimal("100.00"),
  } as never)
}

describe("POST /deploy/trigger/:stackId", () => {
  beforeEach(resetMocks)

  it("triggers retry from failed stack context", async () => {
    const response = await post()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      data: { deploymentId: "deployment-2", status: "QUEUED" },
    })
    expect(mockPrisma.applicationDeployment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stackId: "stack-1",
        organizationId: "org-1",
        attempt: 2,
        triggerType: "MANUAL",
      }),
    })
  })

  it("rejects unauthenticated requests", async () => {
    mockWithAuth.mockResolvedValueOnce({ user: null } as never)

    const response = await post()

    expect(response.status).toBe(401)
    expect(mockPrisma.applicationStack.findUnique).not.toHaveBeenCalled()
  })

  it("requires an active organization", async () => {
    mockWithAuth.mockResolvedValueOnce({
      user: { id: "user-123" },
      organizationId: null,
    } as never)

    const response = await post()

    expect(response.status).toBe(403)
    expect(mockPrisma.applicationStack.findUnique).not.toHaveBeenCalled()
  })

  it("rejects members without deploy permission", async () => {
    mockWithAuth.mockResolvedValueOnce({
      user: { id: "user-123" },
      organizationId: "org-1",
      role: "member",
      roles: ["member"],
    } as never)

    const response = await post()

    expect(response.status).toBe(403)
    expect(mockPrisma.applicationStack.findUnique).not.toHaveBeenCalled()
  })

  it("returns 404 when stack does not exist", async () => {
    setStack(null)

    const response = await post()

    expect(response.status).toBe(404)
    expect(mockPrisma.applicationDeployment.create).not.toHaveBeenCalled()
  })

  it("rejects stacks from another organization", async () => {
    setStack({ ...stackRecord, organizationId: "org-other" })

    const response = await post()

    expect(response.status).toBe(403)
    expect(mockPrisma.applicationDeployment.create).not.toHaveBeenCalled()
  })

  it("blocks suspended stacks", async () => {
    setStack({
      ...stackRecord,
      metadataJson: { billingState: "SUSPENDED" },
    })

    const response = await post()

    expect(response.status).toBe(402)
    expect(mockPrisma.applicationDeployment.create).not.toHaveBeenCalled()
  })

  it("blocks PAYG stacks with insufficient balance", async () => {
    setStack({
      ...stackRecord,
      billingMode: "PAYG",
      resourcePlanId: "payg",
      hourlyCost: new Prisma.Decimal("1"),
    })
    mockPrisma.billingAccount.findUnique.mockResolvedValue({
      id: "billing-1",
      organizationId: "org-1",
      currency: "USD",
      balance: new Prisma.Decimal("0"),
    } as never)

    const response = await post({ paygBufferHours: 24 })

    expect(response.status).toBe(402)
    expect(mockPrisma.applicationDeployment.create).not.toHaveBeenCalled()
  })

  it("rejects PAYG stacks missing hourly cost", async () => {
    setStack({
      ...stackRecord,
      billingMode: "PAYG",
      resourcePlanId: "payg",
      hourlyCost: null,
    })

    const response = await post()

    expect(response.status).toBe(422)
    expect(mockPrisma.applicationDeployment.create).not.toHaveBeenCalled()
  })

  it("does not trigger while stack deployment is in progress", async () => {
    setStack({ ...stackRecord, status: "BUILDING" })

    const response = await post()

    expect(response.status).toBe(409)
    expect(mockPrisma.applicationDeployment.create).not.toHaveBeenCalled()
  })
})

describe("POST /deploy/rollback/:stackId", () => {
  beforeEach(resetMocks)

  it("returns 409 when deployment is already in progress", async () => {
    setStack({ ...stackRecord, status: "BUILDING" })
    mockRollbackDeployment.mockRejectedValueOnce(
      new Error("A deployment is already in progress for this stack")
    )

    const response = await postRollback({ targetDeploymentId: "dep-old" })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      ok: false,
      error: "STACK_DEPLOY_IN_PROGRESS",
      message: "A deployment is already in progress for this stack",
    })
  })
})
