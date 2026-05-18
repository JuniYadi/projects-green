import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Branch, Owner, Repository } from "@/modules/deploy/deploy.types"

type StepSourceProps = {
  githubConnectionStatus: "idle" | "connected" | "error"
  isConnectingGithub: boolean
  ownerOptionsLoading: boolean
  ownerOptionsError: string | null
  repositoryOptionsLoading: boolean
  repositoryOptionsError: string | null
  ownerSearch: string
  repositorySearch: string
  owners: Owner[]
  repositories: Repository[]
  branches: Branch[]
  selectedOwnerId: string
  selectedRepositoryId: string
  selectedBranchName: string
  rootDirectory: string
  onOwnerSearchChange: (value: string) => void
  onRepositorySearchChange: (value: string) => void
  onOwnerSelect: (value: string) => void
  onRepositorySelect: (value: string) => void
  onBranchSelect: (value: string) => void
  onRootDirectoryChange: (value: string) => void
  onConnectGithub: () => void
  onCancel: () => void
  onNext: () => void
  canProceed: boolean
}

export function StepSource({
  githubConnectionStatus,
  isConnectingGithub,
  ownerOptionsLoading,
  ownerOptionsError,
  repositoryOptionsLoading,
  repositoryOptionsError,
  ownerSearch,
  repositorySearch,
  owners,
  repositories,
  branches,
  selectedOwnerId,
  selectedRepositoryId,
  selectedBranchName,
  rootDirectory,
  onOwnerSearchChange,
  onRepositorySearchChange,
  onOwnerSelect,
  onRepositorySelect,
  onBranchSelect,
  onRootDirectoryChange,
  onConnectGithub,
  onCancel,
  onNext,
  canProceed,
}: StepSourceProps) {
  const hasOwnerSearch = ownerSearch.trim().length > 0
  const hasRepositorySearch = repositorySearch.trim().length > 0
  const ownerSelected = selectedOwnerId.length > 0
  const repositorySelected = selectedRepositoryId.length > 0
  const branchSelected = selectedBranchName.length > 0
  const selectedOwnerName =
    owners.find((owner) => owner.id === selectedOwnerId)?.name ?? selectedOwnerId
  const selectedRepositoryName =
    repositories.find((repository) => repository.id === selectedRepositoryId)?.name ??
    selectedRepositoryId

  const ownerStateMessage = (() => {
    if (ownerOptionsError) {
      return "We could not load owners. Try searching again or reconnect GitHub."
    }

    if (ownerOptionsLoading) {
      return "Loading owners from your GitHub installations."
    }

    if (owners.length === 0) {
      if (hasOwnerSearch) {
        return "No owners match your search yet."
      }

      return "No owners loaded yet. Connect GitHub to fetch organizations."
    }

    if (!ownerSelected) {
      return "Select an owner to unlock repository options."
    }

    return `Owner selected: ${selectedOwnerName}`
  })()

  const repositoryStateMessage = (() => {
    if (!ownerSelected) {
      return "Pick an owner first."
    }

    if (repositoryOptionsError) {
      return "We could not load repositories for this owner."
    }

    if (repositoryOptionsLoading) {
      return "Loading repositories."
    }

    if (repositories.length === 0) {
      if (hasRepositorySearch) {
        return "No repositories match your search."
      }

      return "No repositories available for this owner."
    }

    if (!repositorySelected) {
      return "Select a repository to continue."
    }

    return `Repository selected: ${selectedRepositoryName}`
  })()

  const branchStateMessage = (() => {
    if (!repositorySelected) {
      return "Select a repository to load branches."
    }

    if (branches.length === 0) {
      return "No branches available. Provide a branch manually once supported."
    }

    if (!branchSelected) {
      return "Select a branch for deployment."
    }

    return `Branch selected: ${selectedBranchName}`
  })()

  const rootDirectoryStateMessage = (() => {
    if (rootDirectory === "/") {
      return "Using repository root. Example nested app paths: /apps/web or /packages/site."
    }

    return `Deploy from ${rootDirectory}. Ensure build files exist in this path.`
  })()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Source Code</CardTitle>
        <CardDescription>
          Select a GitHub account, repository, branch, and root directory.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">GitHub account or organization</p>
          <Input
            value={ownerSearch}
            onChange={(event) => onOwnerSearchChange(event.target.value)}
            placeholder="Search GitHub account or organization..."
          />
          <select
            aria-label="Owner selector"
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={selectedOwnerId}
            disabled={ownerOptionsLoading || owners.length === 0}
            onChange={(event) => onOwnerSelect(event.target.value)}
          >
            <option value="">Select owner</option>
            {owners.map((owner) => {
              return (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              )
            })}
          </select>
          <p className="text-xs text-muted-foreground">
            Don&apos;t see your repo? Connect GitHub to load more organizations.
          </p>
          <p className="text-xs text-muted-foreground">{ownerStateMessage}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isConnectingGithub}
            onClick={onConnectGithub}
          >
            {isConnectingGithub ? "Redirecting..." : "Connect GitHub"}
          </Button>
          {githubConnectionStatus === "connected" ? (
            <p className="border border-border bg-muted/40 p-2 text-xs text-foreground">
              GitHub connected. Select an owner and repository to continue.
            </p>
          ) : null}
          {githubConnectionStatus === "error" ? (
            <p
              className="border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
              role="alert"
            >
              GitHub connection failed. Please try connecting again.
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">Repository</p>
          <Input
            value={repositorySearch}
            onChange={(event) => onRepositorySearchChange(event.target.value)}
            disabled={!selectedOwnerId || repositoryOptionsLoading}
            placeholder="Search repositories..."
          />
          <select
            aria-label="Repository selector"
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={selectedRepositoryId}
            disabled={!selectedOwnerId || repositoryOptionsLoading}
            onChange={(event) => onRepositorySelect(event.target.value)}
          >
            <option value="">Select repository</option>
            {repositories.map((repository) => {
              return (
                <option key={repository.id} value={repository.id}>
                  {repository.name}
                </option>
              )
            })}
          </select>
          <p className="text-xs text-muted-foreground">{repositoryStateMessage}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm font-medium">Branch</p>
            <select
              aria-label="Branch selector"
              className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={selectedBranchName}
              disabled={!selectedRepositoryId}
              onChange={(event) => onBranchSelect(event.target.value)}
            >
              <option value="">Select branch</option>
              {branches.map((branch) => {
                return (
                  <option key={branch.id} value={branch.name}>
                    {branch.name}
                  </option>
                )
              })}
            </select>
            <p className="text-xs text-muted-foreground">{branchStateMessage}</p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Root Directory</p>
            <Input
              aria-label="Root directory"
              value={rootDirectory}
              onChange={(event) => onRootDirectoryChange(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Where is your app located in the repository? Leave as / for the
              root.
            </p>
            <p className="text-xs text-muted-foreground">
              {rootDirectoryStateMessage}
            </p>
          </div>
        </div>
      </CardContent>
      <div className="flex items-center justify-between border-t p-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={onNext} disabled={!canProceed}>
          Next
        </Button>
      </div>
    </Card>
  )
}
