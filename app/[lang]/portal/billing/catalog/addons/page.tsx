"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeftIcon,
  GearSixIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SquaresFour,
} from "@/components/ui/phosphor-icons"
import type { AddonListItem } from "@/components/billing/admin/catalog/catalog-editor.types"

const BILLING_MODE_LABELS: Record<string, string> = {
  RECURRING: "Recurring",
  ONE_TIME: "One-time",
  USAGE: "Usage",
}

// UI-local mock data — replaces the need for a backend addon API on this branch.
const MOCK_ADDONS: AddonListItem[] = [
  {
    id: "addon-1",
    code: "EXTRA_STORAGE",
    name: "Extra Storage",
    description: "50 GB of additional SSD storage",
    billingMode: "RECURRING",
    isActive: true,
    priceCount: 4,
    createdAt: "2025-01-15T10:30:00.000Z",
    updatedAt: "2025-01-15T10:30:00.000Z",
  },
  {
    id: "addon-2",
    code: "DEDICATED_IP",
    name: "Dedicated IP",
    description: "A dedicated IPv4 address for your services",
    billingMode: "ONE_TIME",
    isActive: true,
    priceCount: 1,
    createdAt: "2025-01-15T10:30:00.000Z",
    updatedAt: "2025-01-15T10:30:00.000Z",
  },
  {
    id: "addon-3",
    code: "PRIORITY_SUPPORT",
    name: "Priority Support",
    description: "Priority 24/7 support with SLA",
    billingMode: "RECURRING",
    isActive: false,
    priceCount: 2,
    createdAt: "2025-01-15T10:30:00.000Z",
    updatedAt: "2025-02-20T14:00:00.000Z",
  },
  {
    id: "addon-4",
    code: "WHATSAPP_PHONE_NUMBER",
    name: "WhatsApp Phone Number",
    description: "Additional WhatsApp business phone number",
    billingMode: "RECURRING",
    isActive: true,
    priceCount: 1,
    createdAt: "2025-01-15T10:30:00.000Z",
    updatedAt: "2025-01-15T10:30:00.000Z",
  },
]

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}

export default function PortalBillingAddonsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [addons, setAddons] = useState<AddonListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get("q") ?? "")

  const loadAddons = useCallback((query: string) => {
    setLoading(true)
    const timer = setTimeout(() => {
      const q = query.toLowerCase()
      const filtered = MOCK_ADDONS.filter(
        (addon) =>
          !q ||
          addon.code.toLowerCase().includes(q) ||
          addon.name.toLowerCase().includes(q)
      )
      setAddons(filtered)
      setLoading(false)
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    let cleanup: (() => void) | undefined
    const timer = window.setTimeout(() => {
      cleanup = loadAddons(search)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      cleanup?.()
    }
  }, [loadAddons, search])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value.trim()) {
      params.set("q", e.target.value)
    } else {
      params.delete("q")
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/portal/billing/catalog">
              <Button variant="ghost" size="icon">
                <ArrowLeftIcon className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Add-ons</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable add-ons that can be attached to plans and priced per term.
          </p>
        </div>
        <Link href="/portal/billing/catalog/addons/new">
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            New Add-on
          </Button>
        </Link>
      </header>

      <div className="relative max-w-sm">
        <Input
          placeholder="Search add-ons..."
          value={search}
          onChange={handleSearch}
          className="pl-9"
          aria-label="Search add-ons"
        />
        <MagnifyingGlassIcon className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : addons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <SquaresFour className="h-12 w-12 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                No add-ons match your search.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardTitle className="sr-only">Add-ons list</CardTitle>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Billing mode</TableHead>
                <TableHead>Prices</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addons.map((addon) => (
                <TableRow key={addon.id}>
                  <TableCell>
                    <span className="font-mono text-xs">{addon.code}</span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{addon.name}</div>
                    {addon.description && (
                      <p className="text-xs text-muted-foreground">
                        {addon.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {BILLING_MODE_LABELS[addon.billingMode] ??
                      addon.billingMode}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {addon.priceCount} price
                      {addon.priceCount !== 1 ? "s" : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={addon.isActive ? "default" : "secondary"}>
                      {addon.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/portal/billing/catalog/addons/${addon.code.toLowerCase()}`}
                    >
                      <Button variant="ghost" size="sm">
                        <GearSixIcon className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </main>
  )
}
