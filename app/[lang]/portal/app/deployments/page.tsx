"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { eden } from "@/lib/eden"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { AdminDeploymentDTO } from "@/modules/deploy/admin-deployments.service"
import {
  ArrowsClockwise,
  MagnifyingGlass,
  ArrowSquareOut,
} from "@phosphor-icons/react"

const STATUS_TONES: Record<string, string> = {
  RUNNING: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
  FAILED: "border-rose-500/20 bg-rose-500/10 text-rose-500",
  BUILDING: "border-sky-500/20 bg-sky-500/10 text-sky-500",
  DEPLOYING: "border-sky-500/20 bg-sky-500/10 text-sky-500",
  QUEUED: "border-amber-500/20 bg-amber-500/10 text-amber-500",
  STOPPED: "border-border bg-muted/40 text-muted-foreground",
}

const STATUS_FILTERS = [
  "ALL",
  "RUNNING",
  "BUILDING",
  "QUEUED",
  "FAILED",
  "STOPPED",
]

export default function AdminDeploymentsPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const router = useRouter()
  const searchParams = useSearchParams()

  const orgParam = searchParams.get("organizationId") ?? ""
  const queryParam = searchParams.get("query") ?? ""
  const statusParam = searchParams.get("status") ?? "ALL"

  const [orgInput, setOrgInput] = useState(orgParam)
  const [queryInput, setQueryInput] = useState(queryParam)
  const [activeStatus, setActiveStatus] = useState(statusParam)

  const [deployments, setDeployments] = useState<AdminDeploymentDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDeployment, setSelectedDeployment] =
    useState<AdminDeploymentDTO | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: res } = await eden.api.admin.deployments.get({
          $query: {
            organizationId: orgParam || undefined,
            query: queryParam || undefined,
            status: statusParam === "ALL" ? undefined : statusParam,
          },
        })

        if (cancelled) return
        if (!res || !res.ok) {
          setError("Failed to load deployments")
          setDeployments([])
          return
        }

        setDeployments(res.data)
      } catch (err) {
        if (cancelled) return
        setError(
          err instanceof Error ? err.message : "Failed to load deployments"
        )
        setDeployments([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [orgParam, queryParam, statusParam])

  const refresh = () => {
    router.refresh()
  }
  const applyFilters = (
    newOrg: string,
    newQuery: string,
    newStatus: string
  ) => {
    const sp = new URLSearchParams()
    if (newOrg.trim()) sp.set("organizationId", newOrg.trim())
    if (newQuery.trim()) sp.set("query", newQuery.trim())
    if (newStatus && newStatus !== "ALL") sp.set("status", newStatus)

    const base = localizePathname({
      pathname: "/portal/app/deployments",
      locale,
    })
    const target = sp.toString() ? `${base}?${sp.toString()}` : base
    router.push(target)
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return "—"
    const totalSec = Math.round(ms / 1000)
    if (totalSec < 60) return `${totalSec}s`
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}m ${sec}s`
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Deployments Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Cross-organization deploy rollouts, status monitoring, and build
            inspection.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
          data-testid="refresh-btn"
        >
          <ArrowsClockwise
            size={14}
            className={`mr-1 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <MagnifyingGlass size={16} /> Filters
          </CardTitle>
          <CardDescription>
            Filter across organizations, deployment IDs, and app slugs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label
                htmlFor="filter-org"
                className="text-xs font-medium text-muted-foreground"
              >
                Organization ID
              </label>
              <Input
                id="filter-org"
                placeholder="e.g. org_123..."
                value={orgInput}
                onChange={(e) => setOrgInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    applyFilters(orgInput, queryInput, activeStatus)
                }}
                className="mt-1 h-9"
              />
            </div>
            <div>
              <label
                htmlFor="filter-query"
                className="text-xs font-medium text-muted-foreground"
              >
                Search Deployment / App / Commit
              </label>
              <div className="relative mt-1">
                <Input
                  id="filter-query"
                  placeholder="e.g. dep_xxx, landing-web, feat-auth"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      applyFilters(orgInput, queryInput, activeStatus)
                  }}
                  className="h-9 pr-8"
                />
                <MagnifyingGlass
                  size={14}
                  className="absolute top-2.5 right-2.5 text-muted-foreground"
                />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => applyFilters(orgInput, queryInput, activeStatus)}
                className="h-9 px-4"
              >
                Apply Filters
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOrgInput("")
                  setQueryInput("")
                  setActiveStatus("ALL")
                  applyFilters("", "", "ALL")
                }}
                className="h-9"
              >
                Reset
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="mr-2 text-xs text-muted-foreground">Status:</span>
            {STATUS_FILTERS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={activeStatus === s ? "secondary" : "ghost"}
                className="h-7 rounded-full px-2.5 text-xs"
                onClick={() => {
                  setActiveStatus(s)
                  applyFilters(orgInput, queryInput, s)
                }}
              >
                {s}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>App / Stack</TableHead>
              <TableHead>Deployment ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Commit / Branch</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  Loading deployments...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-32 text-center text-sm text-rose-500"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : deployments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  No deployments found.
                </TableCell>
              </TableRow>
            ) : (
              deployments.map((d) => (
                <TableRow key={d.id} data-testid={`deployment-row-${d.id}`}>
                  <TableCell className="font-mono text-xs">
                    <span title={d.organizationId}>
                      {d.organizationId.length > 16
                        ? `${d.organizationId.slice(0, 14)}...`
                        : d.organizationId}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{d.stackName}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {d.stackSlug}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedDeployment(d)}
                      className="text-left text-primary hover:underline"
                    >
                      {d.id}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold uppercase ${STATUS_TONES[d.status] ?? ""}`}
                    >
                      {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {d.branchName}{" "}
                      {d.commitSha ? `(${d.commitSha.slice(0, 7)})` : ""}
                    </div>
                    {d.commitMessage && (
                      <div
                        className="max-w-[180px] truncate text-muted-foreground"
                        title={d.commitMessage}
                      >
                        {d.commitMessage}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDuration(d.durationMs)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(d.createdAt).toLocaleString(locale, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDeployment(d)}
                      className="h-7 px-2 text-xs"
                    >
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet
        open={!!selectedDeployment}
        onOpenChange={(open) => !open && setSelectedDeployment(null)}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Deployment Details</SheetTitle>
            <SheetDescription>
              Technical details and deployment events.
            </SheetDescription>
          </SheetHeader>
          {selectedDeployment && (
            <div className="space-y-4 pt-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">
                  Deployment ID
                </span>
                <p className="font-mono text-xs font-semibold">
                  {selectedDeployment.id}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">
                  Organization
                </span>
                <p className="font-mono text-xs">
                  {selectedDeployment.organizationId}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Stack</span>
                <p className="font-medium">
                  {selectedDeployment.stackName} ({selectedDeployment.stackSlug}
                  )
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Status</span>
                <div>
                  <Badge
                    variant="outline"
                    className={`mt-1 text-[10px] ${STATUS_TONES[selectedDeployment.status] ?? ""}`}
                  >
                    {selectedDeployment.status}
                  </Badge>
                </div>
              </div>
              {selectedDeployment.failureReason && (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-400">
                  <span className="mb-1 block font-semibold">
                    Failure Reason:
                  </span>
                  {selectedDeployment.failureReason}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Trigger</span>
                  <p className="font-medium">
                    {selectedDeployment.triggerType}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Events Count</span>
                  <p className="font-medium">
                    {selectedDeployment.eventsCount}
                  </p>
                </div>
              </div>
              <div className="flex justify-between border-t border-border pt-4">
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={localizePathname({
                      pathname: `/console/app/deployments`,
                      locale,
                    })}
                    target="_blank"
                  >
                    <ArrowSquareOut size={14} className="mr-1" />
                    Open in Console
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </main>
  )
}
