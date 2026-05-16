export type GithubActorContext = {
  userId: string
  organizationId: string | null
}

export type GithubInstallationRecord = {
  githubInstallationId: number
  accountLogin: string
  targetId: number | null
}

export type GithubRepositoryListQuery = {
  ownerId?: string
  query?: string
  cursor?: string
  limit?: number
}

export type GithubRepositoryListItem = {
  repositoryId: number
  fullName: string
  name: string
  owner: string
  installationId: number
  defaultBranch: string | null
  private: boolean
  pushedAt: string | null
}

export type GithubRepositoryListResult = {
  items: GithubRepositoryListItem[]
  nextCursor: string | null
}

export type GithubRepositoryService = {
  listRepositoriesForActor: (
    actor: GithubActorContext,
    query: GithubRepositoryListQuery
  ) => Promise<GithubRepositoryListResult>
}
