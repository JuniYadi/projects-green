"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  ArrowClockwise,
  CheckCircle,
  Eye,
  EyeSlash,
  PencilSimple,
  PlugsConnected,
  Plus,
  Trash,
  XCircle,
} from "@phosphor-icons/react"
import { toast } from "sonner"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { eden } from "@/lib/eden"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export type AuthType = "NONE" | "BEARER" | "API_KEY" | "CUSTOM"

export interface ConnectionItem {
  id: string
  organizationId: string
  name: string
  description: string | null
  baseUrl: string
  authType: string
  isActive: boolean
  headers?: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface HeaderRow {
  id: string
  key: string
  value: string
  isMasked: boolean
}

export interface AiConnectionsPageClientProps {
  initialConnections?: ConnectionItem[]
}

export interface TestResult {
  status: "idle" | "testing" | "success" | "failed"
  latencyMs?: number
  statusCode?: number
  error?: string
}

const getNow = () => performance.now()

let nextHeaderId = 1
function createHeaderRow(
  key = "",
  value = "",
  isMasked = true
): HeaderRow {
  return {
    id: `hdr_${nextHeaderId++}_${Date.now()}`,
    key,
    value,
    isMasked,
  }
}

export function validateBaseUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) {
    return "Base URL is required"
  }
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "URL must use http:// or https://"
    }
    if (!parsed.hostname) {
      return "URL must contain a valid host"
    }
    return null
  } catch {
    return "Invalid URL format (e.g. https://api.example.com)"
  }
}

export default function AiConnectionsPageClient({
  initialConnections,
}: AiConnectionsPageClientProps = {}) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)

  const [connections, setConnections] = useState<ConnectionItem[]>(
    initialConnections ?? []
  )
  const [loading, setLoading] = useState(!initialConnections)
  const [searchQuery, setSearchQuery] = useState("")

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ConnectionItem | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [baseUrlError, setBaseUrlError] = useState<string | null>(null)
  const [authType, setAuthType] = useState<AuthType>("NONE")
  const [isActive, setIsActive] = useState(true)
  const [headers, setHeaders] = useState<HeaderRow[]>([])
  const [saving, setSaving] = useState(false)

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<ConnectionItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Test connection state per connection id
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})

  const loadConnections = useCallback(async () => {
    try {
      setLoading(true)
      const res = await eden.api.console.ai.connections.get()
      if (res.data && res.data.ok && Array.isArray(res.data.data)) {
        setConnections(res.data.data as ConnectionItem[])
      }
    } catch (err) {
      console.error("[ai-connections] load error:", err)
      toast.error(messages.pConsoleAiConnectionsPageClient.toastLoadError)
    } finally {
      setLoading(false)
    }
  }, [messages])

  useEffect(() => {
    if (!initialConnections) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadConnections()
    }
  }, [initialConnections, loadConnections])

  const openCreateDialog = () => {
    setEditingItem(null)
    setName("")
    setDescription("")
    setBaseUrl("")
    setBaseUrlError(null)
    setAuthType("NONE")
    setIsActive(true)
    setHeaders([])
    setDialogOpen(true)
  }

  const openEditDialog = (item: ConnectionItem) => {
    setEditingItem(item)
    setName(item.name)
    setDescription(item.description ?? "")
    setBaseUrl(item.baseUrl)
    setBaseUrlError(null)
    setAuthType((item.authType as AuthType) || "NONE")
    setIsActive(item.isActive)
    const headerRows = Object.entries(item.headers ?? {}).map(([k, v]) =>
      createHeaderRow(k, v, true)
    )
    setHeaders(headerRows)
    setDialogOpen(true)
  }

  const handleAuthTypeChange = (value: AuthType) => {
    setAuthType(value)
    if (value === "BEARER") {
      const hasAuth = headers.some((h) =>
        h.key.trim().toLowerCase() === "authorization"
      )
      if (!hasAuth) {
        setHeaders((prev) => [
          ...prev,
          createHeaderRow("Authorization", "Bearer ", true),
        ])
      }
    } else if (value === "API_KEY") {
      const hasApiKey = headers.some((h) =>
        ["x-api-key", "api-key", "authorization"].includes(
          h.key.trim().toLowerCase()
        )
      )
      if (!hasApiKey) {
        setHeaders((prev) => [
          ...prev,
          createHeaderRow("X-API-Key", "", true),
        ])
      }
    }
  }

  const addHeaderRow = () => {
    setHeaders((prev) => [...prev, createHeaderRow("", "", true)])
  }

  const removeHeaderRow = (id: string) => {
    setHeaders((prev) => prev.filter((h) => h.id !== id))
  }

  const updateHeaderRow = (
    id: string,
    field: "key" | "value",
    val: string
  ) => {
    setHeaders((prev) =>
      prev.map((h) => (h.id === id ? { ...h, [field]: val } : h))
    )
  }

  const toggleHeaderMask = (id: string) => {
    setHeaders((prev) =>
      prev.map((h) => (h.id === id ? { ...h, isMasked: !h.isMasked } : h))
    )
  }

  const handleBaseUrlBlur = () => {
    const error = validateBaseUrl(baseUrl)
    setBaseUrlError(error)
  }

  const handleSave = async () => {
    const trimmedName = name.trim()
    const trimmedUrl = baseUrl.trim()
    const urlErr = validateBaseUrl(trimmedUrl)
    if (!trimmedName) {
      toast.error(messages.pConsoleAiConnectionsPageClient.toastNameRequired)
      return
    }
    if (urlErr) {
      setBaseUrlError(urlErr)
      return
    }

    const headerRecord: Record<string, string> = {}
    for (const h of headers) {
      const k = h.key.trim()
      if (k) {
        headerRecord[k] = h.value
      }
    }

    setSaving(true)
    try {
      if (editingItem) {
        const res = await eden.api.console.ai.connections[
          editingItem.id
        ].patch({
          name: trimmedName,
          description: description.trim() || undefined,
          baseUrl: trimmedUrl,
          authType,
          isActive,
          headers:
            Object.keys(headerRecord).length > 0 ? headerRecord : undefined,
        })
        if (res.data && res.data.ok) {
          toast.success(
            messages.pConsoleAiConnectionsPageClient.toastUpdateSuccess
          )
          setDialogOpen(false)
          await loadConnections()
        } else {
          toast.error(
            res.data?.error ||
              messages.pConsoleAiConnectionsPageClient.toastUpdateError
          )
        }
      } else {
        const res = await eden.api.console.ai.connections.post({
          name: trimmedName,
          description: description.trim() || undefined,
          baseUrl: trimmedUrl,
          authType,
          headers:
            Object.keys(headerRecord).length > 0 ? headerRecord : undefined,
        })
        if (res.data && res.data.ok) {
          toast.success(
            messages.pConsoleAiConnectionsPageClient.toastCreateSuccess
          )
          setDialogOpen(false)
          await loadConnections()
        } else {
          toast.error(
            res.data?.error ||
              messages.pConsoleAiConnectionsPageClient.toastCreateError
          )
        }
      }
    } catch (err) {
      console.error("[ai-connections] save error:", err)
      toast.error(messages.pConsoleAiConnectionsPageClient.toastSaveError)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await eden.api.console.ai.connections[
        deleteTarget.id
      ].delete()
      if (res.data && res.data.ok) {
        toast.success(
          messages.pConsoleAiConnectionsPageClient.toastDeleteSuccess
        )
        setConnections((prev) => prev.filter((c) => c.id !== deleteTarget.id))
        setDeleteTarget(null)
      } else {
        toast.error(
          res.data?.error ||
            messages.pConsoleAiConnectionsPageClient.toastDeleteError
        )
      }
    } catch (err) {
      console.error("[ai-connections] delete error:", err)
      toast.error(messages.pConsoleAiConnectionsPageClient.toastDeleteError)
    } finally {
      setDeleting(false)
    }
  }

  const handleTestConnection = async (item: ConnectionItem) => {
    setTestResults((prev) => ({
      ...prev,
      [item.id]: { status: "testing" },
    }))

    const start = getNow()
    try {
      const res = await eden.api.console.ai.connections[item.id].test.post({
        subpath: "",
      })
      const latencyMs = Math.round(getNow() - start)
      if (res.data && res.data.ok) {
        const execData = res.data.data
        setTestResults((prev) => ({
          ...prev,
          [item.id]: {
            status: "success",
            latencyMs,
            statusCode: execData?.status ?? 200,
          },
        }))
        toast.success(
          messages.pConsoleAiConnectionsPageClient.toastTestResponded.replace(
            "{latencyMs}",
            String(latencyMs)
          )
        )
      } else {
        const execData = res.data?.data
        const errMsg =
          execData?.error ||
          res.data?.error ||
          messages.pConsoleAiConnectionsPageClient.toastPingFailed
        setTestResults((prev) => ({
          ...prev,
          [item.id]: {
            status: "failed",
            latencyMs,
            statusCode: execData?.status ?? 500,
            error: String(errMsg),
          },
        }))
        toast.error(
          messages.pConsoleAiConnectionsPageClient.toastTestFailed.replace(
            "{error}",
            String(errMsg)
          )
        )
      }
    } catch (err) {
      const latencyMs = Math.round(getNow() - start)
      const errMsg =
        err instanceof Error
          ? err.message
          : messages.pConsoleAiConnectionsPageClient.toastNetworkError
      setTestResults((prev) => ({
        ...prev,
        [item.id]: {
          status: "failed",
          latencyMs,
          statusCode: 500,
          error: errMsg,
        },
      }))
      toast.error(
        messages.pConsoleAiConnectionsPageClient.toastTestFailed.replace(
          "{error}",
          errMsg
        )
      )
    }
  }

  const filteredConnections = connections.filter((c) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      c.baseUrl.toLowerCase().includes(q) ||
      c.authType.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div
        className={
          "flex flex-col gap-4 sm:flex-row " +
          "sm:items-center sm:justify-between"
        }
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {messages.pConsoleAiConnectionsPageClient.pageTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {messages.pConsoleAiConnectionsPageClient.pageDescription}
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="gap-2 self-start sm:self-auto"
        >
          <Plus size={16} weight="bold" />
          <span>
            {messages.pConsoleAiConnectionsPageClient.addConnectionButton}
          </span>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder={
            messages.pConsoleAiConnectionsPageClient.filterPlaceholder
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {loading ? (
        <Card className="border-border bg-card">
          <CardContent
            className="p-8 text-center text-sm text-muted-foreground"
          >
            {messages.pConsoleAiConnectionsPageClient.loadingConnections}
          </CardContent>
        </Card>
      ) : filteredConnections.length === 0 ? (
        <div
          className={
            "flex flex-col items-center justify-center rounded-lg " +
            "border border-dashed border-border bg-card p-12 text-center"
          }
        >
          <div
            className={
              "mb-4 flex h-12 w-12 items-center justify-center " +
              "rounded-full bg-muted text-muted-foreground"
            }
          >
            <PlugsConnected size={24} />
          </div>
          <h3 className="text-base font-semibold">
            {connections.length === 0
              ? messages.pConsoleAiConnectionsPageClient.noConnectionsTitle
              : messages.pConsoleAiConnectionsPageClient.noMatchingTitle}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {connections.length === 0
              ? messages.pConsoleAiConnectionsPageClient.emptyStateDescription
              : messages.pConsoleAiConnectionsPageClient.noMatchingDescription}
          </p>
          {connections.length === 0 && (
            <Button onClick={openCreateDialog} className="mt-4 gap-2">
              <Plus size={16} weight="bold" />
              <span>
                {messages.pConsoleAiConnectionsPageClient.addConnectionButton}
              </span>
            </Button>
          )}
        </div>
      ) : (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              {messages.pConsoleAiConnectionsPageClient
                .configuredConnectionsTitle}{" "}
              ({filteredConnections.length})
            </CardTitle>
            <CardDescription className="text-xs">
              {
                messages.pConsoleAiConnectionsPageClient
                  .configuredConnectionsDescription
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {messages.pConsoleAiConnectionsPageClient.columnConnection}
                  </TableHead>
                  <TableHead>
                    {messages.pConsoleAiConnectionsPageClient.columnBaseUrl}
                  </TableHead>
                  <TableHead>
                    {messages.pConsoleAiConnectionsPageClient.columnAuthType}
                  </TableHead>
                  <TableHead>
                    {
                      messages.pConsoleAiConnectionsPageClient
                        .columnMaskedHeaders
                    }
                  </TableHead>
                  <TableHead>
                    {messages.pConsoleAiConnectionsPageClient.columnPingStatus}
                  </TableHead>
                  <TableHead className="text-right">
                    {messages.pConsoleAiConnectionsPageClient.columnActions}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConnections.map((item) => {
                  const testRes = testResults[item.id]
                  const headerEntries = Object.entries(item.headers ?? {})
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {item.name}
                            </span>
                            {!item.isActive && (
                              <Badge
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {
                                  messages.pConsoleAiConnectionsPageClient
                                    .badgeInactive
                                }
                              </Badge>
                            )}
                          </div>
                          {item.description && (
                            <span className="text-xs text-muted-foreground">
                              {item.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className="font-mono text-xs text-muted-foreground"
                        >
                          {item.baseUrl}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {item.authType || "NONE"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {headerEntries.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {messages.pConsoleAiConnectionsPageClient.badgeNone}
                          </span>
                        ) : (
                          <div className="flex max-w-xs flex-wrap gap-1">
                            {headerEntries.map(([k, v]) => (
                              <span
                                key={k}
                                className={
                                  "inline-flex items-center rounded border " +
                                  "border-border bg-muted px-1.5 py-0.5 " +
                                  "font-mono text-[11px] text-muted-foreground"
                                }
                              >
                                <span className="font-semibold text-foreground">
                                  {`${k}: `}
                                </span>
                                {v}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {!testRes || testRes.status === "idle" ? (
                          <span className="text-xs text-muted-foreground">
                            {
                              messages.pConsoleAiConnectionsPageClient
                                .badgeUntested
                            }
                          </span>
                        ) : testRes.status === "testing" ? (
                          <Badge
                            variant="outline"
                            className="animate-pulse text-xs"
                          >
                            {
                              messages.pConsoleAiConnectionsPageClient
                                .badgeTesting
                            }
                          </Badge>
                        ) : testRes.status === "success" ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge
                              className={
                                "w-fit gap-1 border-emerald-500/20 " +
                                "bg-emerald-500/10 text-xs text-emerald-600 " +
                                "dark:text-emerald-400"
                              }
                            >
                              <CheckCircle size={12} weight="bold" />
                              <span>
                                {`${testRes.statusCode} ` +
                                  `(${testRes.latencyMs}ms)`}
                              </span>
                            </Badge>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <Badge
                              variant="destructive"
                              className="w-fit gap-1 text-xs"
                            >
                              <XCircle size={12} weight="bold" />
                              <span>
                                {messages.pConsoleAiConnectionsPageClient
                                  .badgeFailed}
                                {` (${testRes.latencyMs}ms)`}
                              </span>
                            </Badge>
                            {testRes.error && (
                              <span
                                className={
                                  "max-w-[180px] truncate text-[11px] " +
                                  "text-destructive"
                                }
                                title={testRes.error}
                              >
                                {testRes.error}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestConnection(item)}
                            disabled={testRes?.status === "testing"}
                            title={
                              messages.pConsoleAiConnectionsPageClient
                                .testButtonTooltip
                            }
                            className="h-8 gap-1 px-2 text-xs"
                          >
                            <ArrowClockwise
                              size={14}
                              className={
                                testRes?.status === "testing"
                                  ? "animate-spin"
                                  : ""
                              }
                            />
                            <span>
                              {
                                messages.pConsoleAiConnectionsPageClient
                                  .testButtonLabel
                              }
                            </span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(item)}
                            title={
                              messages.pConsoleAiConnectionsPageClient
                                .editButtonTooltip
                            }
                            className="h-8 w-8 p-0"
                          >
                            <PencilSimple size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(item)}
                            title={
                              messages.pConsoleAiConnectionsPageClient
                                .deleteButtonTooltip
                            }
                            className={
                              "h-8 w-8 p-0 text-destructive " +
                              "hover:text-destructive"
                            }
                          >
                            <Trash size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Connection Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem
                ? messages.pConsoleAiConnectionsPageClient.editDialogTitle
                : messages.pConsoleAiConnectionsPageClient.createDialogTitle}
            </DialogTitle>
            <DialogDescription>
              {messages.pConsoleAiConnectionsPageClient.dialogDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="conn-name">
                {messages.pConsoleAiConnectionsPageClient.nameLabel}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="conn-name"
                placeholder={
                  messages.pConsoleAiConnectionsPageClient.namePlaceholder
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conn-desc">
                {messages.pConsoleAiConnectionsPageClient.descriptionLabel}
              </Label>
              <Input
                id="conn-desc"
                placeholder={
                  messages.pConsoleAiConnectionsPageClient
                    .descriptionPlaceholder
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conn-url">
                {messages.pConsoleAiConnectionsPageClient.baseUrlLabel}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="conn-url"
                placeholder={
                  messages.pConsoleAiConnectionsPageClient.baseUrlPlaceholder
                }
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value)
                  if (baseUrlError) setBaseUrlError(null)
                }}
                onBlur={handleBaseUrlBlur}
              />
              {baseUrlError && (
                <p className="text-xs text-destructive">{baseUrlError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="conn-auth">
                {messages.pConsoleAiConnectionsPageClient.authTypeLabel}
              </Label>
              <Select
                value={authType}
                onValueChange={(val: AuthType) => handleAuthTypeChange(val)}
              >
                <SelectTrigger id="conn-auth">
                  <SelectValue
                    placeholder={
                      messages.pConsoleAiConnectionsPageClient
                        .authTypePlaceholder
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">
                    {messages.pConsoleAiConnectionsPageClient.authTypeNone}
                  </SelectItem>
                  <SelectItem value="BEARER">
                    {messages.pConsoleAiConnectionsPageClient.authTypeBearer}
                  </SelectItem>
                  <SelectItem value="API_KEY">
                    {messages.pConsoleAiConnectionsPageClient.authTypeApiKey}
                  </SelectItem>
                  <SelectItem value="CUSTOM">
                    {messages.pConsoleAiConnectionsPageClient.authTypeCustom}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editingItem && (
              <div
                className={
                  "flex items-center justify-between rounded-lg " +
                  "border border-border p-3"
                }
              >
                <div className="space-y-0.5">
                  <Label htmlFor="conn-active" className="text-sm font-medium">
                    {messages.pConsoleAiConnectionsPageClient.activeLabel}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {
                      messages.pConsoleAiConnectionsPageClient
                        .activeDescription
                    }
                  </p>
                </div>
                <Switch
                  id="conn-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            )}

            {/* Dynamic Headers Table */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">
                    {
                      messages.pConsoleAiConnectionsPageClient
                        .headersSectionTitle
                    }
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {
                      messages.pConsoleAiConnectionsPageClient
                        .headersSectionDescription
                    }
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addHeaderRow}
                  className="gap-1 text-xs"
                >
                  <Plus size={12} weight="bold" />
                  <span>
                    {messages.pConsoleAiConnectionsPageClient.addHeaderButton}
                  </span>
                </Button>
              </div>

              {headers.length === 0 ? (
                <div
                  className={
                    "rounded-md border border-dashed border-border " +
                    "p-4 text-center text-xs text-muted-foreground"
                  }
                >
                  {messages.pConsoleAiConnectionsPageClient.noHeadersConfigured}
                </div>
              ) : (
                <div className="space-y-2 rounded-md border border-border p-2">
                  <div
                    className={
                      "grid grid-cols-12 gap-2 px-1 text-xs font-semibold " +
                      "text-muted-foreground"
                    }
                  >
                    <div className="col-span-5">
                      {messages.pConsoleAiConnectionsPageClient.headerKeyColumn}
                    </div>
                    <div className="col-span-6">
                      {
                        messages.pConsoleAiConnectionsPageClient
                          .headerValueColumn
                      }
                    </div>
                    <div className="col-span-1 text-right" />
                  </div>
                  {headers.map((h) => (
                    <div
                      key={h.id}
                      className="grid grid-cols-12 items-center gap-2"
                    >
                      <div className="col-span-5">
                        <Input
                          placeholder={
                            messages.pConsoleAiConnectionsPageClient
                              .headerKeyPlaceholder
                          }
                          value={h.key}
                          onChange={(e) =>
                            updateHeaderRow(h.id, "key", e.target.value)
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="relative col-span-6">
                        <Input
                          type={h.isMasked ? "password" : "text"}
                          placeholder={
                            messages.pConsoleAiConnectionsPageClient
                              .headerValuePlaceholder
                          }
                          value={h.value}
                          onChange={(e) =>
                            updateHeaderRow(h.id, "value", e.target.value)
                          }
                          className="h-8 pr-8 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => toggleHeaderMask(h.id)}
                          aria-label={
                            h.isMasked
                              ? messages.pConsoleAiConnectionsPageClient
                                  .revealSecretAria
                              : messages.pConsoleAiConnectionsPageClient
                                  .maskSecretAria
                          }
                          className={
                            "absolute right-2 top-1/2 -translate-y-1/2 " +
                            "text-muted-foreground hover:text-foreground"
                          }
                        >
                          {h.isMasked ? (
                            <EyeSlash size={14} />
                          ) : (
                            <Eye size={14} />
                          )}
                        </button>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeHeaderRow(h.id)}
                          className={
                            "h-8 w-8 p-0 text-muted-foreground " +
                            "hover:text-destructive"
                          }
                        >
                          <Trash size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
            >
              {messages.pConsoleAiConnectionsPageClient.cancelButton}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? messages.pConsoleAiConnectionsPageClient.savingButton
                : editingItem
                  ? messages.pConsoleAiConnectionsPageClient.saveChangesButton
                  : messages.pConsoleAiConnectionsPageClient
                      .createConnectionButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {messages.pConsoleAiConnectionsPageClient.deleteDialogTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {messages.pConsoleAiConnectionsPageClient
                .deleteDialogDescription.replace(
                  "{name}",
                  deleteTarget?.name ?? ""
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {messages.pConsoleAiConnectionsPageClient.deleteDialogCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className={
                "bg-destructive text-destructive-foreground " +
                "hover:bg-destructive/90"
              }
            >
              {deleting
                ? messages.pConsoleAiConnectionsPageClient
                    .deleteDialogDeleting
                : messages.pConsoleAiConnectionsPageClient
                    .deleteDialogConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
