import { describe, expect, it, mock } from "bun:test"

import {
  evaluatePushDispatch,
  getBranchFromGitRef,
  matchesBranchFilter,
  processGithubWebhookDispatch,
} from "@/modules/github/github.webhook-dispatch"

describe("github webhook dispatch helpers", () => {
  it("extracts head branch names from Git refs", () => {
    expect(getBranchFromGitRef("refs/heads/main")).toBe("main")
    expect(getBranchFromGitRef("refs/heads/feature/auth")).toBe("feature/auth")
    expect(getBranchFromGitRef("refs/tags/v1.0.0")).toBeNull()
  })

  it("matches branch filters with trimmed entries", () => {
    expect(matchesBranchFilter("main", [" main ", "release"])).toBe(true)
    expect(matchesBranchFilter("dev", ["main", "release"])).toBe(false)
    expect(matchesBranchFilter("main", [" ", ""])).toBe(false)
  })

  it("evaluates push dispatch rules for deleted and non-head refs", () => {
    const deletedDecision = evaluatePushDispatch({
      eventName: "push",
      payload: { ref: "refs/heads/main", deleted: true },
      connectionEnabled: true,
      branchFilters: ["main"],
    })
    expect(deletedDecision.reason).toBe("BRANCH_DELETED")

    const tagDecision = evaluatePushDispatch({
      eventName: "push",
      payload: { ref: "refs/tags/v1.0.0" },
      connectionEnabled: true,
      branchFilters: ["main"],
    })
    expect(tagDecision.reason).toBe("NON_HEAD_REF")
  })
})

describe("processGithubWebhookDispatch", () => {
  it("dispatches build for matching enabled repository branch", async () => {
    const markProcessedCalls: Array<{
      eventId: string
      processStatus: "processed" | "skipped" | "failed"
      processError: string | null
    }> = []
    const dispatchBuild = mock(async () => {})

    const result = await processGithubWebhookDispatch({
      eventId: "event_1",
      store: {
        async claimPendingEvent() {
          return {
            id: "event_1",
            deliveryId: "delivery_1",
            eventName: "push",
            payloadJson: {
              ref: "refs/heads/main",
              after: "abc123",
            },
            githubInstallationId: BigInt(10),
            githubRepositoryId: BigInt(20),
          }
        },
        async getRepositoryConnection() {
          return {
            id: "repo_conn_1",
            enabled: true,
            branchFilters: ["main"],
          }
        },
        async markProcessed(args) {
          markProcessedCalls.push(args)
        },
      },
      dispatchBuild,
    })

    expect(result).toEqual({
      outcome: "dispatched",
      reason: "DISPATCHED",
    })
    expect(dispatchBuild).toHaveBeenCalledWith({
      eventId: "event_1",
      repositoryConnectionId: "repo_conn_1",
      branch: "main",
      commitSha: "abc123",
    })
    expect(markProcessedCalls).toEqual([
      {
        eventId: "event_1",
        processStatus: "processed",
        processError: null,
      },
    ])
  })

  it("skips build when branch filter does not match", async () => {
    const dispatchBuild = mock(async () => {})
    const markProcessedCalls: Array<{
      eventId: string
      processStatus: "processed" | "skipped" | "failed"
      processError: string | null
    }> = []

    const result = await processGithubWebhookDispatch({
      eventId: "event_2",
      store: {
        async claimPendingEvent() {
          return {
            id: "event_2",
            deliveryId: "delivery_2",
            eventName: "push",
            payloadJson: {
              ref: "refs/heads/release",
            },
            githubInstallationId: BigInt(10),
            githubRepositoryId: BigInt(21),
          }
        },
        async getRepositoryConnection() {
          return {
            id: "repo_conn_2",
            enabled: true,
            branchFilters: ["main"],
          }
        },
        async markProcessed(args) {
          markProcessedCalls.push(args)
        },
      },
      dispatchBuild,
    })

    expect(result).toEqual({
      outcome: "skipped",
      reason: "BRANCH_FILTER_MISMATCH",
    })
    expect(dispatchBuild).not.toHaveBeenCalled()
    expect(markProcessedCalls).toEqual([
      {
        eventId: "event_2",
        processStatus: "skipped",
        processError: "BRANCH_FILTER_MISMATCH",
      },
    ])
  })

  it("returns already_processed when lock cannot be acquired", async () => {
    const dispatchBuild = mock(async () => {})

    const result = await processGithubWebhookDispatch({
      eventId: "event_3",
      store: {
        async claimPendingEvent() {
          return null
        },
        async getRepositoryConnection() {
          throw new Error("not reached")
        },
        async markProcessed() {},
      },
      dispatchBuild,
    })

    expect(result).toEqual({
      outcome: "already_processed",
      reason: "ALREADY_PROCESSED",
    })
    expect(dispatchBuild).not.toHaveBeenCalled()
  })
})
