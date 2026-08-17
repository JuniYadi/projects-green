"use client"

import * as React from "react"
import { Ban, Check, Copy, KeyRound, RotateCw } from "lucide-react"

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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type InventoryRow = {
  organizationId: string
  organizationName: string
  status: "ACTIVE" | "REVOKED" | "NOT_GENERATED"
  keyId: string | null
  fingerprint: string | null
  generatedKeyCount: number
  createdAt: string | null
  rotatedAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
}

type InventoryResponse = {
  ok: boolean
  data: InventoryRow[]
  summary: {
    generatedKeyTotal: number
    organizationsWithActiveKey: number
    organizationsWithoutActiveKey: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  message?: string
}

type SecretState = {
  organizationName: string
  secret: string
}

const formatDate = (value: string | null) => {
  if (!value) return "—"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

const statusLabel: Record<InventoryRow["status"], string> = {
  ACTIVE: "Active",
  REVOKED: "Revoked",
  NOT_GENERATED: "Not generated",
}

const statusVariant = (status: InventoryRow["status"]) => {
  if (status === "ACTIVE") return "success" as const
  if (status === "REVOKED") return "secondary" as const
  return "outline" as const
}

export function WhatsappOrganizationApiKeyInventory() {
  const [rows, setRows] = React.useState<InventoryRow[]>([])
  const [summary, setSummary] = React.useState<InventoryResponse["summary"]>({
    generatedKeyTotal: 0,
    organizationsWithActiveKey: 0,
    organizationsWithoutActiveKey: 0,
  })
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(0)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState("")
  const [appliedSearch, setAppliedSearch] = React.useState("")
  const [appliedStatus, setAppliedStatus] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [authorized, setAuthorized] = React.useState<boolean | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [secret, setSecret] = React.useState<SecretState | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [busyOrganizationId, setBusyOrganizationId] = React.useState<
    string | null
  >(null)
  const [pendingAction, setPendingAction] = React.useState<{
    organizationId: string
    organizationName: string
    action: "generate" | "rotate" | "revoke"
  } | null>(null)
  const loadInventory = React.useCallback(async () => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ page: String(page), limit: "20" })
    if (appliedSearch) params.set("q", appliedSearch)
    if (appliedStatus) params.set("status", appliedStatus)

    try {
      const response = await fetch(
        `/api/admin/whatsapp/organization-api-keys?${params}`
      )
      const body = (await response.json()) as InventoryResponse
      if (response.status === 403 || response.status === 401) {
        setAuthorized(false)
        setRows([])
        return
      }
      setAuthorized(true)
      if (!response.ok || !body.ok) {
        throw new Error(body.message ?? "Failed to load API-key inventory.")
      }
      setRows(body.data)
      setSummary(body.summary)
      setTotalPages(body.pagination.totalPages)
    } catch (loadError) {
      setAuthorized(true)
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load API-key inventory."
      )
    } finally {
      setLoading(false)
    }
  }, [appliedSearch, appliedStatus, page])

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadInventory()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadInventory])

  if (authorized === false) {
    return (
      <section className="flex flex-col gap-6 px-6 pb-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>
              Only super-admins can view organization API keys.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    )
  }

  if (authorized !== true) return null

  const applyFilters = () => {
    setPage(1)
    setAppliedSearch(search.trim())
    setAppliedStatus(status)
  }

  const performAction = async (
    organizationId: string,
    organizationName: string,
    action: "generate" | "rotate" | "revoke"
  ) => {
    setBusyOrganizationId(organizationId)
    setError(null)
    try {
      const path = action === "generate" ? "" : `/${action}`
      const response = await fetch(
        `/api/admin/whatsapp/organization-api-keys/${encodeURIComponent(organizationId)}${path}`,
        { method: "POST" }
      )
      const body = (await response.json()) as {
        ok: boolean
        data?: { secret?: string }
        message?: string
      }
      if (!response.ok || !body.ok) {
        throw new Error(body.message ?? "API-key action failed.")
      }
      if (body.data?.secret) {
        setSecret({ organizationName, secret: body.data.secret })
        setCopied(false)
      }
      await loadInventory()
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "API-key action failed."
      )
    } finally {
      setBusyOrganizationId(null)
      setPendingAction(null)
    }
  }

  const requestAction = (
    organizationId: string,
    organizationName: string,
    action: "generate" | "rotate" | "revoke"
  ) => {
    setPendingAction({ organizationId, organizationName, action })
  }

  const copySecret = async () => {
    if (!secret) return
    await navigator.clipboard.writeText(secret.secret)
    setCopied(true)
  }

  return (
    <section className="flex flex-col gap-6 px-6 pb-6">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">Organization API keys</h2>
        <p className="text-sm text-muted-foreground">
          Super-admin inventory for stable WhatsApp system credentials. Raw
          secrets are shown only once after generation or rotation.
        </p>
      </header>

      {secret && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-base">
              One-time secret for {secret.organizationName}
            </CardTitle>
            <CardDescription>
              Copy this secret now. It cannot be recovered from the portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <code className="min-w-0 flex-1 rounded border bg-background px-3 py-2 text-sm break-all">
              {secret.secret}
            </code>
            <Button type="button" variant="outline" onClick={copySecret}>
              {copied ? (
                <Check className="mr-2 size-4" />
              ) : (
                <Copy className="mr-2 size-4" />
              )}
              {copied ? "Copied" : "Copy secret"}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Generated keys</CardDescription>
            <CardTitle>{summary.generatedKeyTotal}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Organizations with active key</CardDescription>
            <CardTitle>{summary.organizationsWithActiveKey}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Organizations without active key</CardDescription>
            <CardTitle>{summary.organizationsWithoutActiveKey}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div>
            <CardTitle className="text-base">Key inventory</CardTitle>
            <CardDescription>
              Fingerprints and lifecycle metadata only; secret material is never
              included in this list.
            </CardDescription>
          </div>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              applyFilters()
            }}
          >
            <Input
              className="h-9 w-64"
              placeholder="Search organization or fingerprint"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search organization API keys"
            />
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filter API-key status"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="REVOKED">Revoked</option>
              <option value="NOT_GENERATED">Not generated</option>
            </select>
            <Button type="submit" size="sm">
              Apply filters
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading organization keys...
            </p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No organizations match the current filters.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fingerprint</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last use</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const busy = busyOrganizationId === row.organizationId
                    return (
                      <TableRow key={row.organizationId}>
                        <TableCell>
                          <div className="font-medium">
                            {row.organizationName}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {row.organizationId}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(row.status)}>
                            {statusLabel[row.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-52 font-mono text-xs">
                          {row.fingerprint ?? "—"}
                        </TableCell>
                        <TableCell>{row.generatedKeyCount}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(row.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(row.lastUsedAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {row.status === "ACTIVE" ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() =>
                                    requestAction(
                                      row.organizationId,
                                      row.organizationName,
                                      "rotate"
                                    )
                                  }
                                >
                                  <RotateCw className="mr-1.5 size-3.5" />
                                  Rotate
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  disabled={busy}
                                  onClick={() =>
                                    requestAction(
                                      row.organizationId,
                                      row.organizationName,
                                      "revoke"
                                    )
                                  }
                                >
                                  <Ban className="mr-1.5 size-3.5" />
                                  Revoke
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  requestAction(
                                    row.organizationId,
                                    row.organizationName,
                                    "generate"
                                  )
                                }
                              >
                                <KeyRound className="mr-1.5 size-3.5" />
                                Generate
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.action === "revoke"
                ? "Revoke API key?"
                : pendingAction?.action === "rotate"
                  ? "Rotate API key?"
                  : "Generate API key?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.action === "revoke"
                ? `Revoke the active API key for ${pendingAction.organizationName}?`
                : pendingAction?.action === "rotate"
                  ? `Rotate the active API key for ${pendingAction.organizationName}? The old key will stop working immediately.`
                  : pendingAction
                    ? `Generate an API key for ${pendingAction.organizationName}?`
                    : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              asChild
              onClick={() => {
                if (!pendingAction) return
                void performAction(
                  pendingAction.organizationId,
                  pendingAction.organizationName,
                  pendingAction.action
                )
              }}
            >
              <Button
                variant={
                  pendingAction?.action === "revoke" ? "destructive" : "default"
                }
              >
                {pendingAction?.action === "revoke"
                  ? "Revoke"
                  : pendingAction?.action === "rotate"
                    ? "Rotate"
                    : "Generate"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
