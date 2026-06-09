import { describe, expect, it, mock } from "bun:test"

const mockRequireSuperAdmin = mock(async (set: unknown) => {
  ;(set as { status?: number | string }).status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to perform this action.",
  }
})

mock.module("@/modules/admin/api/admin.guards", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}))

const { createGithubEventLogRoutes } = await import(
  "./github-event-log.route"
)

describe("github event log routes", () => {
  it("requires super admin for list endpoint", async () => {
    const app = createGithubEventLogRoutes({
      requireSuperAdmin: async (set: { status?: number | string }) => {
        set.status = 403
        return {
          ok: false as const,
          error: "FORBIDDEN" as const,
          message: "No",
        }
      },
    })

    const response = await app.handle(
      new Request("http://localhost/admin/app/events/github")
    )

    expect(response.status).toBe(403)
  })

  it("returns paginated event rows", async () => {
    const listGithubWebhookEvents = mock(async () => ({
      items: [
        {
          id: "event_1",
          eventName: "push",
          action: null,
          deliveryId: "d1",
          githubInstallationId: 1,
          githubRepositoryId: 2,
          repositoryFullName: "acme/api",
          repositoryOwner: "acme",
          repositoryName: "api",
          ref: "refs/heads/main",
          branch: "main",
          commitSha: "abc123",
          commitMessage: "feat: test",
          commitAuthorName: null,
          commitAuthorEmail: null,
          commitUrl: null,
          senderLogin: null,
          senderAvatarUrl: null,
          repositoryConnectionId: null,
          applicationStackId: null,
          eventDisposition: "tracked",
          ignoreReason: null,
          responseStatus: 202,
          handlerDurationMs: 10,
          enqueueStatus: "queued",
          processStatus: "processed",
          processError: null,
          receivedAt: new Date(),
          processedAt: null,
          deletedAt: null,
          deleteReason: null,
          permanentDeleteAfter: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
    }))

    const app = createGithubEventLogRoutes({
      requireSuperAdmin: async () => ({
        userId: "admin_1",
        platformRole: "super_admin" as const,
      }),
      listGithubWebhookEvents,
    })

    const response = await app.handle(
      new Request("http://localhost/admin/app/events/github?eventName=push")
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.data.items[0].id).toBe("event_1")
    expect(listGithubWebhookEvents).toHaveBeenCalled()
  })
})
