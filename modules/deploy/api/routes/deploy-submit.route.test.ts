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

// Leaf-only mock: every sibling service (createOrUpdateStack, triggerDeploy,
// AppHostingBillingService, BillingTransactionService) runs for real against
// this prisma mock. Mocking those services directly would pollute their own
// test files under the shared --coverage process (see AGENTS.md mock rules).
const stackRecord = {
  id: "stack-1",
  organizationId: "org-1",
  name: "console-next-app",
  slug: "console-next-app",
  status: "IDLE",
  branchName: "main",
}

const mockPrisma = {
  $transaction: mock(async (fn: (tx: typeof mockPrisma) => unknown) =>
    fn(mockPrisma)
  ),
  githubRepositoryConnection: {
    findFirst: mock(async () => ({
      id: "conn-1",
      githubRepositoryId: BigInt("555"),
      repoName: "console-next-app",
      enabled: true,
    })),
  },
  billingAccount: {
    findUnique: mock(async () => ({
      id: "ba-1",
      organizationId: "org-1",
      currency: "USD",
      balance: new Prisma.Decimal("100.00"),
    })),
  },
  applicationStack: {
    findUnique: mock(async () => null),
    findUniqueOrThrow: mock(async () => ({ ...stackRecord })),
    create: mock(async () => ({ ...stackRecord })),
    update: mock(async () => ({ ...stackRecord })),
  },
  applicationDeployment: {
    count: mock(async () => 0),
    create: mock(async () => ({ id: "deploy-1", status: "QUEUED" })),
  },
  applicationDeployEvent: {
    create: mock(async () => ({ id: "event-1" })),
  },
  applicationDeploymentLog: {
    create: mock(async () => ({ id: "log-1" })),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const { deploySubmitRoutes } = await import("./deploy-submit.route")

const submit = (body: unknown) =>
  deploySubmitRoutes.handle(
    new Request("http://localhost/deploy/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )

const validBody = {
  repositoryId: "555",
  branchName: "main",
  rootDirectory: "/",
  framework: "Next.js",
  buildCommand: "npm run build",
  useDockerfile: false,
  resourcePlanId: "payg",
  billingMode: "PAYG",
  cpu: 100,
  memory: 256,
  paygBufferHours: 24,
}

const resetPrisma = () => {
  mockPrisma.$transaction.mockClear()
  mockPrisma.githubRepositoryConnection.findFirst.mockClear()
  mockPrisma.githubRepositoryConnection.findFirst.mockResolvedValue({
    id: "conn-1",
    githubRepositoryId: BigInt("555"),
    repoName: "console-next-app",
    enabled: true,
  } as never)
  mockPrisma.billingAccount.findUnique.mockClear()
  mockPrisma.billingAccount.findUnique.mockResolvedValue({
    id: "ba-1",
    organizationId: "org-1",
    currency: "USD",
    balance: new Prisma.Decimal("100.00"),
  } as never)
  mockPrisma.applicationStack.findUnique.mockClear()
  mockPrisma.applicationStack.findUnique.mockResolvedValue(null as never)
  mockPrisma.applicationStack.findUniqueOrThrow.mockClear()
  mockPrisma.applicationStack.findUniqueOrThrow.mockResolvedValue({
    ...stackRecord,
  } as never)
  mockPrisma.applicationStack.create.mockClear()
  mockPrisma.applicationStack.create.mockResolvedValue({
    ...stackRecord,
  } as never)
  mockPrisma.applicationStack.update.mockClear()
  mockPrisma.applicationStack.update.mockResolvedValue({
    ...stackRecord,
  } as never)
  mockPrisma.applicationDeployment.count.mockClear()
  mockPrisma.applicationDeployment.count.mockResolvedValue(0 as never)
  mockPrisma.applicationDeployment.create.mockClear()
  mockPrisma.applicationDeployment.create.mockResolvedValue({
    id: "deploy-1",
    status: "QUEUED",
  } as never)
  mockPrisma.applicationDeployEvent.create.mockClear()
  mockPrisma.applicationDeploymentLog.create.mockClear()
}

describe("deploySubmitRoutes /submit", () => {
  beforeEach(() => {
    mockWithAuth.mockClear()
    resetPrisma()
  })

  it("creates a stack and triggers a real deployment (happy path)", async () => {
    const res = await submit(validBody)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: { stackId: string; deploymentId: string; status: string }
    }
    expect(body.ok).toBe(true)
    expect(body.data.stackId).toBe("stack-1")
    expect(body.data.deploymentId).toBe("deploy-1")
    expect(body.data.status).toBe("QUEUED")
    expect(mockPrisma.applicationDeployment.create).toHaveBeenCalledTimes(1)
  })

  it("blocks deploy when the PAYG balance is insufficient (unhappy path)", async () => {
    mockPrisma.billingAccount.findUnique.mockResolvedValue({
      id: "ba-1",
      organizationId: "org-1",
      currency: "USD",
      balance: new Prisma.Decimal("0"),
    } as never)
    const res = await submit(validBody)
    expect(res.status).toBe(402)
    const body = (await res.json()) as { error: string; topupUrl: string }
    expect(body.error).toBe("INSUFFICIENT_PAYG_BUFFER")
    expect(body.topupUrl).toBe("/console/billing/topup")
    expect(mockPrisma.applicationDeployment.create).not.toHaveBeenCalled()
  })

  it("returns 404 when the repository is not connected", async () => {
    mockPrisma.githubRepositoryConnection.findFirst.mockResolvedValue(
      null as never
    )
    const res = await submit(validBody)
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("REPOSITORY_NOT_CONNECTED")
  })

  it("returns 409 when a deploy is already in progress", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValue({
      ...stackRecord,
      status: "BUILDING",
    } as never)
    const res = await submit(validBody)
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("STACK_DEPLOY_IN_PROGRESS")
    expect(mockPrisma.applicationDeployment.create).not.toHaveBeenCalled()
  })

  it("does not run the PAYG gate for fixed plans", async () => {
    mockPrisma.billingAccount.findUnique.mockResolvedValue({
      id: "ba-1",
      organizationId: "org-1",
      currency: "USD",
      balance: new Prisma.Decimal("0"),
    } as never)
    const res = await submit({
      ...validBody,
      resourcePlanId: "starter",
      billingMode: "PACKAGE",
    })
    expect(res.status).toBe(200)
    expect(mockPrisma.applicationDeployment.create).toHaveBeenCalledTimes(1)
  })

  it("rejects unauthenticated requests", async () => {
    mockWithAuth.mockResolvedValueOnce({ user: null } as never)
    const res = await submit(validBody)
    expect(res.status).toBe(401)
  })

  it("rejects members without owner/admin role", async () => {
    mockWithAuth.mockResolvedValueOnce({
      user: { id: "u", email: "e" },
      organizationId: "org-1",
      role: "member",
      roles: ["member"],
    } as never)
    const res = await submit(validBody)
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("FORBIDDEN")
  })
})
