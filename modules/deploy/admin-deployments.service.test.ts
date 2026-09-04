import { describe, it, expect, mock, beforeEach } from "bun:test"
import { listAdminDeployments } from "./admin-deployments.service"

const mockPrisma = {
  applicationDeployment: {
    count: mock(async () => 1),
    findMany: mock(async () => [
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

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("listAdminDeployments", () => {
  beforeEach(() => {
    mockPrisma.applicationDeployment.count.mockClear()
    mockPrisma.applicationDeployment.findMany.mockClear()
  })

  it("filters by organizationId", async () => {
    const result = await listAdminDeployments({ organizationId: "org_acme" })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].organizationId).toBe("org_acme")
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
})
