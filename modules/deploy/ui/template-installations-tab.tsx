"use client"

import React, { useEffect, useState, useTransition, useCallback } from "react"
import { toast } from "sonner"
import {
  ArrowsClockwise,
  CheckCircle,
  Warning,
  Spinner,
  ShieldCheck,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export interface TemplateInstallation {
  id: string
  name: string
  slug: string
  organizationId: string
  status: string
  currentDeploymentType: "deployment" | "statefulset"
  targetDeploymentType: "deployment" | "statefulset"
  isAligned: boolean
  lastDeployedAt: string | null
  lastDeployStatus: string | null
  createdAt: string
  updatedAt: string
  latestDeployment: {
    id: string
    status: string
    attempt: number
    commitSha: string | null
    failureReason: string | null
    startedAt: string
  } | null
}

export interface TemplateInstallationsTabProps {
  templateId: string
  templateName: string
  targetDeploymentType: "deployment" | "statefulset"
}

export function TemplateInstallationsTab({
  templateId,
  templateName,
  targetDeploymentType,
}: TemplateInstallationsTabProps) {
  const [installations, setInstallations] = useState<TemplateInstallation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterOutdatedOnly, setFilterOutdatedOnly] = useState(false)
  const [selectedStackIds, setSelectedStackIds] = useState<string[]>([])
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [targetStacksForSync, setTargetStacksForSync] = useState<
    TemplateInstallation[]
  >([])
  const [isSyncing, startSyncTransition] = useTransition()

  const fetchInstallations = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/admin/templates/${templateId}/installations`
      )
      if (!res.ok) {
        throw new Error("Failed to load template installations")
      }
      const data = await res.json()
      if (Array.isArray(data?.installations)) {
        setInstallations(data.installations)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error loading installations"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [templateId])

  useEffect(() => {
    let isCancelled = false
    const load = async () => {
      try {
        const res = await fetch(
          `/api/admin/templates/${templateId}/installations`
        )
        if (!res.ok) {
          throw new Error("Failed to load template installations")
        }
        const data = await res.json()
        if (!isCancelled && Array.isArray(data?.installations)) {
          setInstallations(data.installations)
        }
      } catch (err) {
        if (!isCancelled) {
          const message =
            err instanceof Error ? err.message : "Error loading installations"
          toast.error(message)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    if (templateId) {
      load()
    }
    return () => {
      isCancelled = true
    }
  }, [templateId])

  const displayedInstallations = filterOutdatedOnly
    ? installations.filter((item) => !item.isAligned)
    : installations

  const outdatedCount = installations.filter((i) => !i.isAligned).length
  const alignedCount = installations.length - outdatedCount

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStackIds(displayedInstallations.map((i) => i.id))
    } else {
      setSelectedStackIds([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedStackIds((prev) => [...prev, id])
    } else {
      setSelectedStackIds((prev) => prev.filter((item) => item !== id))
    }
  }

  const handleOpenSyncSingle = (stack: TemplateInstallation) => {
    setTargetStacksForSync([stack])
    setConfirmDialogOpen(true)
  }

  const handleOpenSyncBulk = () => {
    const targets = installations.filter((i) => selectedStackIds.includes(i.id))
    if (targets.length === 0) return
    setTargetStacksForSync(targets)
    setConfirmDialogOpen(true)
  }

  const handleSelectAllOutdated = () => {
    const outdatedIds = installations
      .filter((i) => !i.isAligned)
      .map((i) => i.id)
    setSelectedStackIds(outdatedIds)
  }

  const handleConfirmSync = () => {
    if (targetStacksForSync.length === 0) return
    const stackIds = targetStacksForSync.map((s) => s.id)

    startSyncTransition(async () => {
      try {
        const res = await fetch(`/api/admin/templates/${templateId}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stackIds }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData?.error || "Failed to trigger sync")
        }

        const data = await res.json()
        toast.success(
          `Sync completed! Succeeded: ${data.succeeded}/${data.total}`
        )
        setConfirmDialogOpen(false)
        setSelectedStackIds([])
        await fetchInstallations()
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sync error"
        toast.error(message)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">
              Total Active Installations
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {isLoading ? "..." : installations.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Applications instantiated from this template
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
              <CheckCircle className="size-3.5 text-emerald-500" />
              Aligned Workloads
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {isLoading ? "..." : alignedCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Workload matches current ({targetDeploymentType})
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
              <Warning className="size-3.5 text-amber-500" />
              Outdated Workloads
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {isLoading ? "..." : outdatedCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Different controller kind than template
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">
              Installed Applications ({displayedInstallations.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Manage and synchronize customer applications deployed from &ldquo;
              {templateName}&rdquo;.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={filterOutdatedOnly ? "secondary" : "outline"}
              size="sm"
              onClick={() => setFilterOutdatedOnly((prev) => !prev)}
              className="text-xs"
            >
              {filterOutdatedOnly ? "Show All" : "Filter Outdated Only"}
            </Button>

            {outdatedCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAllOutdated}
                className="text-xs"
              >
                Select Outdated ({outdatedCount})
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchInstallations}
              disabled={isLoading}
              className="size-8 p-0"
              title="Refresh list"
            >
              <ArrowsClockwise
                className={`size-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>

            {selectedStackIds.length > 0 && (
              <Button
                type="button"
                size="sm"
                onClick={handleOpenSyncBulk}
                className="gap-1.5 bg-primary text-xs text-primary-foreground"
              >
                <ArrowsClockwise className="size-3.5" />
                Sync Selected ({selectedStackIds.length})
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Spinner className="size-6 animate-spin text-primary" />
              <span className="text-xs">Loading active installations...</span>
            </div>
          ) : displayedInstallations.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              <p className="text-sm font-medium">No installations found.</p>
              <p className="mt-1 text-xs">
                {filterOutdatedOnly
                  ? "All active installations are aligned with the latest template configuration."
                  : "No customer applications have been deployed from this template yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          displayedInstallations.length > 0 &&
                          displayedInstallations.every((i) =>
                            selectedStackIds.includes(i.id)
                          )
                        }
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Application</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Workload Kind</TableHead>
                    <TableHead>Stack Status</TableHead>
                    <TableHead>Last Deployed</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedInstallations.map((stack) => (
                    <TableRow key={stack.id} className="text-xs">
                      <TableCell>
                        <Checkbox
                          checked={selectedStackIds.includes(stack.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(stack.id, Boolean(checked))
                          }
                          aria-label={`Select ${stack.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">
                            {stack.name}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {stack.slug}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {stack.organizationId}
                        </span>
                      </TableCell>
                      <TableCell>
                        {stack.isAligned ? (
                          <Badge
                            variant="outline"
                            className="font-mono text-xs capitalize"
                          >
                            {stack.currentDeploymentType}
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="border-amber-500/30 bg-amber-500/10 font-mono text-xs text-amber-600 capitalize dark:text-amber-400"
                            >
                              {stack.currentDeploymentType}
                            </Badge>
                            <span className="text-muted-foreground">→</span>
                            <Badge
                              variant="outline"
                              className="border-emerald-500/30 bg-emerald-500/10 font-mono text-xs text-emerald-600 capitalize dark:text-emerald-400"
                            >
                              {stack.targetDeploymentType}
                            </Badge>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="text-[11px] font-medium"
                        >
                          {stack.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {stack.lastDeployedAt
                          ? new Date(stack.lastDeployedAt).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => handleOpenSyncSingle(stack)}
                          className="gap-1 text-xs"
                        >
                          <ArrowsClockwise className="size-3" />
                          Sync
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog with Safe Merge Explanation */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-500" />
              Sync Application Setup from Template?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2 text-xs text-muted-foreground">
                <p>
                  You are about to align{" "}
                  <strong className="text-foreground">
                    {targetStacksForSync.length} application(s)
                  </strong>{" "}
                  with parent template &ldquo;{templateName}&rdquo;.
                </p>

                <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
                  <p className="font-semibold text-foreground">
                    Safe Merge Rules:
                  </p>
                  <ul className="list-inside list-disc space-y-1.5">
                    <li>
                      <span className="font-medium text-foreground">
                        Architecture update:
                      </span>{" "}
                      Controller updated to{" "}
                      <strong className="text-foreground uppercase">
                        {targetDeploymentType}
                      </strong>
                      , ports and healthcheck refreshed.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">
                        Custom settings preserved:
                      </span>{" "}
                      Customer CPU/memory scaling, custom domains, and subdomain
                      settings remain untouched.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">
                        Env vars preserved:
                      </span>{" "}
                      Customer-configured environment values stay intact; new
                      template defaults are appended if missing.
                    </li>
                    <li>
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        GitOps & ArgoCD:
                      </span>{" "}
                      Generates fresh Helm manifests and triggers a rolling
                      sync.
                    </li>
                  </ul>
                </div>

                <div className="max-h-32 space-y-1 overflow-y-auto rounded border bg-background p-2 font-mono text-[11px]">
                  {targetStacksForSync.map((s) => (
                    <div key={s.id} className="flex justify-between">
                      <span className="text-foreground">{s.name}</span>
                      <span className="text-muted-foreground">
                        {s.currentDeploymentType} → {s.targetDeploymentType}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSyncing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmSync()
              }}
              disabled={isSyncing}
              className="gap-1.5 bg-primary text-primary-foreground"
            >
              {isSyncing && <Spinner className="size-3.5 animate-spin" />}
              {isSyncing ? "Syncing..." : "Confirm & Trigger Sync"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
