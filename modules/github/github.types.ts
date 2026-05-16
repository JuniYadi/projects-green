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

export type GithubAppInstallation = {
  id: number
  account: {
    login: string
    type: string
  }
  target_type: string
  target_id: number | null
  permissions: Record<string, string> | null
  events: string[] | null
}

export type GithubInstallationRepository = {
  id: number
  full_name: string
  name: string
  owner: {
    login: string
  }
  default_branch: string | null
  private: boolean
}

export type GithubInstallationRepositoriesResponse = {
  repositories: GithubInstallationRepository[]
}
