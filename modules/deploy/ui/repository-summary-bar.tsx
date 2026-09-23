import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
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
  const params = useParams<{ lang?: string }>()
  const t = getMessages(
    resolveLocaleOrDefault(params?.lang)
  ).pDeployRepositorySummaryBar
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Item label={t.owner} value={owner?.name ?? t.notSelected} />
      <Item label={t.repository} value={repository?.name ?? t.notSelected} />
      <Item label={t.branch} value={branch?.name ?? t.notSelected} />
      <Item label={t.root} value={rootDirectory || "/"} />
    </div>
  )
}
