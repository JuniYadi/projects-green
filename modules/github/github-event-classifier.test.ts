import { describe, expect, it } from "bun:test"

import { classifyGithubWebhookEvent } from "./github-event-classifier"

describe("classifyGithubWebhookEvent", () => {
  it("marks push events as tracked when repository connection and stack exist", async () => {
    const result = await classifyGithubWebhookEvent({
      eventName: "push",
      githubInstallationId: BigInt(10),
      githubRepositoryId: BigInt(20),
      branch: "main",
      store: {
        async findInstallationByGithubId() {
          return { id: "install_1" }
        },
        async findRepositoryConnection() {
          return { id: "repo_conn_1", branchFilters: ["main"] }
        },
        async findApplicationStack() {
          return { id: "stack_1" }
        },
      },
    })

    expect(result).toEqual({
      eventDisposition: "tracked",
      ignoreReason: null,
      repositoryConnectionId: "repo_conn_1",
      applicationStackId: "stack_1",
    })
  })

  it("marks events ignored when no repository connection exists", async () => {
    const result = await classifyGithubWebhookEvent({
      eventName: "push",
      githubInstallationId: BigInt(10),
      githubRepositoryId: BigInt(20),
      branch: "main",
      store: {
        async findInstallationByGithubId() {
          return { id: "install_1" }
        },
        async findRepositoryConnection() {
          return null
        },
        async findApplicationStack() {
          throw new Error("should not load stack")
        },
      },
    })

    expect(result).toEqual({
      eventDisposition: "ignored",
      ignoreReason: "no_repository_connection",
      repositoryConnectionId: null,
      applicationStackId: null,
    })
  })

  it("marks non-push events as ignored", async () => {
    const result = await classifyGithubWebhookEvent({
      eventName: "installation",
      githubInstallationId: BigInt(10),
      githubRepositoryId: BigInt(20),
      branch: null,
      store: {
        async findInstallationByGithubId() {
          throw new Error("should not load installation for non-push")
        },
        async findRepositoryConnection() {
          throw new Error("should not load connection for non-push")
        },
        async findApplicationStack() {
          throw new Error("should not load stack for non-push")
        },
      },
    })

    expect(result).toEqual({
      eventDisposition: "ignored",
      ignoreReason: "unsupported_event",
      repositoryConnectionId: null,
      applicationStackId: null,
    })
  })

  it("marks events ignored when branch does not match repo branch filters", async () => {
    const result = await classifyGithubWebhookEvent({
      eventName: "push",
      githubInstallationId: BigInt(10),
      githubRepositoryId: BigInt(20),
      branch: "dev",
      store: {
        async findInstallationByGithubId() {
          return { id: "install_1" }
        },
        async findRepositoryConnection() {
          return { id: "repo_conn_1", branchFilters: ["main"] }
        },
        async findApplicationStack() {
          return { id: "stack_1" }
        },
      },
    })

    expect(result.eventDisposition).toBe("ignored")
    expect(result.ignoreReason).toBe("branch_not_configured")
  })
})
