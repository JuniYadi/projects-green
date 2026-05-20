type JsonObject = Record<string, unknown>

export type GithubWebhookDispatchEvent = {
  id: string
  deliveryId: string
  eventName: string
  payloadJson: JsonObject
  githubInstallationId: bigint | null
  githubRepositoryId: bigint | null
}

export type GithubRepositoryDispatchConnection = {
  id: string
  enabled: boolean
  branchFilters: string[]
}

export type GithubWebhookDispatchOutcome =
  | "dispatched"
  | "skipped"
  | "already_processed"

export type GithubWebhookDispatchResult = {
  outcome: GithubWebhookDispatchOutcome
  reason:
    | "ALREADY_PROCESSED"
    | "UNSUPPORTED_EVENT"
    | "NO_REPOSITORY_CONNECTION"
    | "CONNECTION_DISABLED"
    | "INVALID_PUSH_PAYLOAD"
    | "BRANCH_DELETED"
    | "NON_HEAD_REF"
    | "BRANCH_FILTER_MISMATCH"
    | "DISPATCHED"
}

export type GithubWebhookDispatchStore = {
  claimPendingEvent: (
    eventId: string
  ) => Promise<GithubWebhookDispatchEvent | null>
  getRepositoryConnection: (args: {
    githubInstallationId: bigint | null
    githubRepositoryId: bigint | null
  }) => Promise<GithubRepositoryDispatchConnection | null>
  markProcessed: (args: {
    eventId: string
    processStatus: "processed" | "skipped" | "failed"
    processError: string | null
  }) => Promise<void>
}

export type GithubBuildDispatcher = (args: {
  eventId: string
  repositoryConnectionId: string
  branch: string
  commitSha: string | null
}) => Promise<void>

const PUSH_HEADS_PREFIX = "refs/heads/"

const getObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as JsonObject
}

export const getBranchFromGitRef = (ref: string): string | null => {
  if (!ref.startsWith(PUSH_HEADS_PREFIX)) {
    return null
  }

  const branch = ref.slice(PUSH_HEADS_PREFIX.length).trim()
  return branch.length > 0 ? branch : null
}

export const matchesBranchFilter = (
  branch: string,
  branchFilters: string[]
): boolean => {
  const normalized = branchFilters
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  if (normalized.length === 0) {
    return false
  }

  return normalized.includes(branch)
}

export const evaluatePushDispatch = ({
  eventName,
  payload,
  connectionEnabled,
  branchFilters,
}: {
  eventName: string
  payload: JsonObject
  connectionEnabled: boolean
  branchFilters: string[]
}): GithubWebhookDispatchResult & {
  branch: string | null
  commitSha: string | null
} => {
  if (eventName !== "push") {
    return {
      outcome: "skipped",
      reason: "UNSUPPORTED_EVENT",
      branch: null,
      commitSha: null,
    }
  }

  if (!connectionEnabled) {
    return {
      outcome: "skipped",
      reason: "CONNECTION_DISABLED",
      branch: null,
      commitSha: null,
    }
  }

  if (payload.deleted === true) {
    return {
      outcome: "skipped",
      reason: "BRANCH_DELETED",
      branch: null,
      commitSha: null,
    }
  }

  const ref = typeof payload.ref === "string" ? payload.ref : null

  if (!ref) {
    return {
      outcome: "skipped",
      reason: "INVALID_PUSH_PAYLOAD",
      branch: null,
      commitSha: null,
    }
  }

  const branch = getBranchFromGitRef(ref)

  if (!branch) {
    return {
      outcome: "skipped",
      reason: "NON_HEAD_REF",
      branch: null,
      commitSha: null,
    }
  }

  if (!matchesBranchFilter(branch, branchFilters)) {
    return {
      outcome: "skipped",
      reason: "BRANCH_FILTER_MISMATCH",
      branch,
      commitSha: null,
    }
  }

  const commitSha = typeof payload.after === "string" ? payload.after : null

  return {
    outcome: "dispatched",
    reason: "DISPATCHED",
    branch,
    commitSha,
  }
}

export const processGithubWebhookDispatch = async ({
  eventId,
  store,
  dispatchBuild,
}: {
  eventId: string
  store: GithubWebhookDispatchStore
  dispatchBuild: GithubBuildDispatcher
}): Promise<GithubWebhookDispatchResult> => {
  const event = await store.claimPendingEvent(eventId)

  if (!event) {
    return {
      outcome: "already_processed",
      reason: "ALREADY_PROCESSED",
    }
  }

  try {
    const connection = await store.getRepositoryConnection({
      githubInstallationId: event.githubInstallationId,
      githubRepositoryId: event.githubRepositoryId,
    })

    if (!connection) {
      await store.markProcessed({
        eventId: event.id,
        processStatus: "skipped",
        processError: "NO_REPOSITORY_CONNECTION",
      })

      return {
        outcome: "skipped",
        reason: "NO_REPOSITORY_CONNECTION",
      }
    }

    const payload = getObject(event.payloadJson)

    if (!payload) {
      await store.markProcessed({
        eventId: event.id,
        processStatus: "skipped",
        processError: "INVALID_PUSH_PAYLOAD",
      })

      return {
        outcome: "skipped",
        reason: "INVALID_PUSH_PAYLOAD",
      }
    }

    const dispatchDecision = evaluatePushDispatch({
      eventName: event.eventName,
      payload,
      connectionEnabled: connection.enabled,
      branchFilters: connection.branchFilters,
    })

    if (dispatchDecision.outcome !== "dispatched") {
      await store.markProcessed({
        eventId: event.id,
        processStatus: "skipped",
        processError: dispatchDecision.reason,
      })

      return {
        outcome: "skipped",
        reason: dispatchDecision.reason,
      }
    }

    await dispatchBuild({
      eventId: event.id,
      repositoryConnectionId: connection.id,
      branch: dispatchDecision.branch ?? "",
      commitSha: dispatchDecision.commitSha,
    })

    await store.markProcessed({
      eventId: event.id,
      processStatus: "processed",
      processError: null,
    })

    return {
      outcome: "dispatched",
      reason: "DISPATCHED",
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await store.markProcessed({
      eventId: event.id,
      processStatus: "failed",
      processError: errorMessage,
    })
    throw error
  }
}
