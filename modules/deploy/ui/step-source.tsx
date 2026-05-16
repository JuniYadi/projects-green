import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Branch, Owner, Repository } from "@/modules/deploy/deploy.types"

type StepSourceProps = {
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
  onCancel: () => void
  onNext: () => void
  canProceed: boolean
}

export function StepSource({
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
  onCancel,
  onNext,
  canProceed,
}: StepSourceProps) {
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
          <p className="text-xs font-medium">GitHub account or organization</p>
          <Input
            value={ownerSearch}
            onChange={(event) => onOwnerSearchChange(event.target.value)}
            placeholder="Search GitHub account or organization..."
          />
          <select
            aria-label="Owner selector"
            className="h-8 w-full border border-input bg-transparent px-2.5 text-xs"
            value={selectedOwnerId}
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
          <Button type="button" size="sm" variant="outline" disabled>
            Connect GitHub
          </Button>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium">Repository</p>
          <Input
            value={repositorySearch}
            onChange={(event) => onRepositorySearchChange(event.target.value)}
            disabled={!selectedOwnerId}
            placeholder="Search repositories..."
          />
          <select
            aria-label="Repository selector"
            className="h-8 w-full border border-input bg-transparent px-2.5 text-xs"
            value={selectedRepositoryId}
            disabled={!selectedOwnerId}
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium">Branch</p>
            <select
              aria-label="Branch selector"
              className="h-8 w-full border border-input bg-transparent px-2.5 text-xs"
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
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium">Root Directory</p>
            <Input
              aria-label="Root directory"
              value={rootDirectory}
              onChange={(event) => onRootDirectoryChange(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Where is your app located in the repository? Leave as / for the
              root.
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
