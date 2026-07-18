"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BuildingsIcon } from "@phosphor-icons/react"
import { getAdminOrgs, type AdminOrgSummary } from "@/lib/billing-client"

const VALID_TABS = [
  "balance",
  "topup",
  "invoices",
  "usage",
  "subscriptions",
  "adjustments",
  "alerts",
  "contacts",
  "settings",
]

export function PortalBillingOrgSelector() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [orgs, setOrgs] = useState<AdminOrgSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAdminOrgs({ limit: 100 })
      .then((res) => setOrgs(res.orgs))
      .catch(() => setOrgs([]))
      .finally(() => setLoading(false))
  }, [])

  // Extract current orgId from pathname: /[lang]/portal/billing/org/[orgId]
  const segments = pathname.split("/")
  const orgIndex = segments.indexOf("org")
  const currentOrgId = orgIndex !== -1 ? segments[orgIndex + 1] : null
  const locale = segments[1] ?? "en"

  const rawTab = searchParams.get("tab")
  const currentTab = rawTab && VALID_TABS.includes(rawTab) ? rawTab : "balance"

  const handleOrgChange = (orgId: string) => {
    router.push(`/${locale}/portal/orgs/${orgId}?page=${currentTab}`)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
        <BuildingsIcon className="h-4 w-4 shrink-0" />
        <span className="truncate">Loading orgs...</span>
      </div>
    )
  }

  if (orgs.length === 0) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
        <BuildingsIcon className="h-4 w-4 shrink-0" />
        <span className="truncate">No organizations</span>
      </div>
    )
  }

  const selectedName = orgs.find((o) => o.orgId === currentOrgId)?.orgName

  return (
    <Select
      value={currentOrgId ?? "__none__"}
      onValueChange={handleOrgChange}
    >
      <SelectTrigger className="h-8 w-full gap-2 [&>span]:flex [&>span]:items-center [&>span]:gap-2 [&>span]:truncate">
        <BuildingsIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Select organization">
          {selectedName ?? "Select organization"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {orgs.map((org) => (
          <SelectItem key={org.orgId} value={org.orgId}>
            {org.orgName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
