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
