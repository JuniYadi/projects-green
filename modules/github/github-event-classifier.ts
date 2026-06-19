export type GithubEventDisposition = "tracked" | "ignored" | "error"

export type GithubEventClassification = {
  eventDisposition: GithubEventDisposition
  ignoreReason: string | null
  repositoryConnectionId: string | null
  applicationStackId: string | null
}

type GithubEventClassifierStore = {
  findInstallationByGithubId: (
    githubInstallationId: bigint
  ) => Promise<{ id: string } | null>
  findRepositoryConnection: (input: {
    installationId: string
    githubRepositoryId: bigint
  }) => Promise<{ id: string; branchFilters: string[] } | null>
  findApplicationStack: (
    repositoryConnectionId: string
  ) => Promise<{ id: string } | null>
}

const ignored = (
  ignoreReason: string,
  repositoryConnectionId: string | null = null,
  applicationStackId: string | null = null
): GithubEventClassification => ({
  eventDisposition: "ignored",
  ignoreReason,
  repositoryConnectionId,
  applicationStackId,
})

export const classifyGithubWebhookEvent = async ({
  eventName,
  githubInstallationId,
  githubRepositoryId,
  branch,
  store,
}: {
  eventName: string
  githubInstallationId: bigint | null
  githubRepositoryId: bigint | null
  branch: string | null
  store: GithubEventClassifierStore
}): Promise<GithubEventClassification> => {
  if (eventName !== "push") {
    return ignored("unsupported_event")
  }

  if (!githubInstallationId || !githubRepositoryId) {
    return ignored("missing_installation_or_repository")
  }

  const installation =
    await store.findInstallationByGithubId(githubInstallationId)

  if (!installation) {
    return ignored("no_installation")
  }

  const repositoryConnection = await store.findRepositoryConnection({
    installationId: installation.id,
    githubRepositoryId,
  })

  if (!repositoryConnection) {
    return ignored("no_repository_connection")
  }

  const branchFilters = repositoryConnection.branchFilters.length
    ? repositoryConnection.branchFilters
    : ["main"]

  if (branch && !branchFilters.includes(branch)) {
    return ignored("branch_not_configured", repositoryConnection.id)
  }

  const stack = await store.findApplicationStack(repositoryConnection.id)

  if (!stack) {
    return ignored("no_application_stack", repositoryConnection.id)
  }

  return {
    eventDisposition: "tracked",
    ignoreReason: null,
    repositoryConnectionId: repositoryConnection.id,
    applicationStackId: stack.id,
  }
}
