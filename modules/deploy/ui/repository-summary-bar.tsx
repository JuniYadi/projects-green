import type { Branch, Owner, Repository } from "@/modules/deploy/deploy.types"

type RepositorySummaryBarProps = {
  owner: Owner | null
  repository: Repository | null
  branch: Branch | null
  rootDirectory: string
}

const Item = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="rounded-md border border-border px-2 py-1.5">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="text-xs font-medium">{value}</p>
    </div>
  )
}

export function RepositorySummaryBar({
  owner,
  repository,
  branch,
  rootDirectory,
}: RepositorySummaryBarProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Item label="Owner" value={owner?.name ?? "Not selected"} />
      <Item label="Repository" value={repository?.name ?? "Not selected"} />
      <Item label="Branch" value={branch?.name ?? "Not selected"} />
      <Item label="Root" value={rootDirectory || "/"} />
    </div>
  )
}
