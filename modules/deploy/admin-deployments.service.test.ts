import { describe, it, expect, mock, beforeEach } from "bun:test"

const mockPrisma = {
  applicationDeployment: {
    count: mock(async (_args: Record<string, unknown>) => 1),
    findMany: mock(async (_args: Record<string, unknown>) => [
      {
        id: "dep_999",
        stackId: "stack_1",
        organizationId: "org_acme",
        status: "RUNNING",
        triggerType: "GIT_PUSH",
        commitSha: "abcdef1",
        commitMessage: "test commit",
        commitAuthor: "Bob",
        branchName: "main",
        startedAt: new Date("2026-09-01T12:00:00.000Z"),
        completedAt: new Date("2026-09-01T12:01:30.000Z"),
        failureReason: null,
        createdAt: new Date("2026-09-01T12:00:00.000Z"),
        updatedAt: new Date("2026-09-01T12:01:30.000Z"),
        stack: {
          slug: "acme-api",
          name: "Acme API",
          framework: "Next.js",
        },
        _count: {
          events: 3,
        },
      },
    ]),
  },
}

const mockGetCachedOrganizations = mock(async (ids: string[]) => {
  const map = new Map<string, { id: string; name: string; slug: string }>()
  for (const id of ids) {
    map.set(id, { id, name: "Acme Corp", slug: id })
  }
  return map
})

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

mock.module("@/lib/workos-directory", () => ({
  getCachedOrganizations: mockGetCachedOrganizations,
}))

const { listAdminDeployments, sanitizeDeploymentFailureReason } =
  await import("./admin-deployments.service")

describe("listAdminDeployments", () => {
  beforeEach(() => {
    mockPrisma.applicationDeployment.count.mockClear()
    mockPrisma.applicationDeployment.findMany.mockClear()
  })

  it("filters by organizationId", async () => {
    const result = await listAdminDeployments({ organizationId: "org_acme" })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].organizationId).toBe("org_acme")
    expect(result.data[0].organizationName).toBe("Acme Corp")
    expect(result.data[0].framework).toBe("Next.js")
    expect(result.data[0].durationMs).toBe(90000)

    expect(mockPrisma.applicationDeployment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: {
            contains: "org_acme",
            mode: "insensitive",
          },
        }),
      })
    )
  })

  it("filters by query across deployment and stack fields", async () => {
    await listAdminDeployments({ query: "acme" })
    expect(mockPrisma.applicationDeployment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { id: { contains: "acme", mode: "insensitive" } },
          ]),
        }),
      })
    )
  })

  it("ignores 'undefined', 'null', and 'ALL' values without adding invalid Prisma filters", async () => {
    await listAdminDeployments({
      organizationId: "undefined",
      query: "undefined",
      status: "undefined",
    })

    expect(mockPrisma.applicationDeployment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    )

    mockPrisma.applicationDeployment.findMany.mockClear()

    await listAdminDeployments({
      organizationId: "null",
      query: "null",
      status: "ALL",
    })

    expect(mockPrisma.applicationDeployment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    )
  })

  it("filters by valid StackStatus and ignores unknown status strings", async () => {
    await listAdminDeployments({ status: "RUNNING" })
    expect(mockPrisma.applicationDeployment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "RUNNING",
        }),
      })
    )

    mockPrisma.applicationDeployment.findMany.mockClear()

    await listAdminDeployments({ status: "NOT_A_REAL_STATUS" })
    expect(mockPrisma.applicationDeployment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    )
  })

  it("matches the daily operations failed and building deployment queue", async () => {
    await listAdminDeployments({ status: "FAILED,BUILDING" })
    const where = {
      status: { in: ["FAILED", "BUILDING"] },
      stack: { status: { not: "TERMINATED" } },
    }
    expect(mockPrisma.applicationDeployment.count).toHaveBeenCalledWith({
      where,
    })
    expect(mockPrisma.applicationDeployment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where })
    )
  })

  it("sanitizes raw Prisma timeouts and GitHub API JSON failures cleanly", () => {
    expect(
      sanitizeDeploymentFailureReason(
        "Invalid `tx.applicationDeployment.update()` invocation in /home/juniyadi/projects-green/file.ts:461:34 Transaction API error: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms..."
      )
    ).toBe("Database transaction timed out (5000ms)")

    expect(
      sanitizeDeploymentFailureReason(
        'Failed to update ref: {"message":"Update is not a fast forward","status":"422"}'
      )
    ).toBe("Git ref update rejected: Update is not a fast forward")

    expect(
      sanitizeDeploymentFailureReason("Deployment timed out after 15 minutes.")
    ).toBe("Deployment timed out after 15 minutes.")

    expect(sanitizeDeploymentFailureReason(null)).toBeNull()
  })
})
