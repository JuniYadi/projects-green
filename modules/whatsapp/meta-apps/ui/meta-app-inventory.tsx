"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Copy, Pencil, Plus, RotateCw, Trash2 } from "lucide-react"

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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type MetaAppRow = {
  id: string
  name: string
  metaAppId: string
  webhookKey: string
  active: boolean
  callbackPath: string
  deviceCount: number
  defaultVersion?: string
  hasSystemToken?: boolean
}
type ListResponse = { ok: boolean; data?: MetaAppRow[]; message?: string }
type MutationResponse = { ok: boolean; data?: MetaAppRow; message?: string }

type CreateForm = {
  name: string
  metaAppId: string
  appSecret: string
  verifyToken: string
  systemToken: string
  defaultVersion: string
}

const emptyCreateForm: CreateForm = {
  name: "",
  metaAppId: "",
  appSecret: "",
  verifyToken: "",
  systemToken: "",
  defaultVersion: "v24.0",
}
type RotateForm = { appSecret: string; verifyToken: string }
const emptyRotateForm: RotateForm = { appSecret: "", verifyToken: "" }

const API_BASE = "/api/admin/whatsapp/meta-apps"

type WhatsappMetaAppInventoryProps = {
  baseUrl: string
  locale?: string
}

export function WhatsappMetaAppInventory({
  baseUrl,
  locale: localeProp,
}: WhatsappMetaAppInventoryProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(localeProp ?? params?.lang)
  const t = getMessages(locale).console.whatsapp.metaApps

  const [rows, setRows] = React.useState<MetaAppRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [authorized, setAuthorized] = React.useState<boolean | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const [createOpen, setCreateOpen] = React.useState(false)
  const [createForm, setCreateForm] =
    React.useState<CreateForm>(emptyCreateForm)
  const [creating, setCreating] = React.useState(false)

  const [editTarget, setEditTarget] = React.useState<MetaAppRow | null>(null)
  const [editName, setEditName] = React.useState("")
  const [editActive, setEditActive] = React.useState(true)
  const [editDefaultVersion, setEditDefaultVersion] = React.useState("v24.0")
  const [editSystemToken, setEditSystemToken] = React.useState("")
  const [savingEdit, setSavingEdit] = React.useState(false)
  const [rotateTarget, setRotateTarget] = React.useState<MetaAppRow | null>(
    null
  )
  const [rotateForm, setRotateForm] =
    React.useState<RotateForm>(emptyRotateForm)
  const [rotating, setRotating] = React.useState(false)

  const [busyId, setBusyId] = React.useState<string | null>(null)

  const loadInventory = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(API_BASE)
      const body = (await response.json()) as ListResponse
      if (response.status === 403 || response.status === 401) {
        setAuthorized(false)
        setRows([])
        return
      }
      setAuthorized(true)
      if (!response.ok || !body.ok || !body.data) {
        throw new Error(body.message ?? t.loadError)
      }
      setRows(body.data)
    } catch (loadError) {
      setAuthorized((current) => current ?? true)
      setError(loadError instanceof Error ? loadError.message : t.loadError)
    } finally {
      setLoading(false)
    }
  }, [t.loadError])

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
            <CardTitle>{t.accessDeniedTitle}</CardTitle>
            <CardDescription>{t.accessDeniedDesc}</CardDescription>
          </CardHeader>
        </Card>
      </section>
    )
  }

  if (authorized !== true) return null

  const submitCreate = async () => {
    if (
      !createForm.name.trim() ||
      !createForm.metaAppId.trim() ||
      !createForm.appSecret.trim() ||
      !createForm.verifyToken.trim()
    ) {
      setError(t.createValidation)
      return
    }
    setCreating(true)
    setError(null)
    try {
      const response = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      })
      const body = (await response.json()) as MutationResponse
      if (!response.ok || !body.ok) {
        throw new Error(body.message ?? t.createError)
      }
      setCreateOpen(false)
      setCreateForm(emptyCreateForm)
      await loadInventory()
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : t.createError
      )
    } finally {
      setCreating(false)
    }
  }
  const openEdit = (row: MetaAppRow) => {
    setEditTarget(row)
    setEditName(row.name)
    setEditActive(row.active)
    setEditDefaultVersion(row.defaultVersion || "v24.0")
    setEditSystemToken("")
  }

  const submitEdit = async () => {
    if (!editTarget) return
    if (!editName.trim()) {
      setError(t.nameRequired)
      return
    }
    setSavingEdit(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        name: editName.trim(),
        active: editActive,
        defaultVersion: editDefaultVersion.trim() || undefined,
      }
      if (editSystemToken.trim()) {
        payload.systemToken = editSystemToken.trim()
      }
      const response = await fetch(`${API_BASE}/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = (await response.json()) as MutationResponse
      if (!response.ok || !body.ok) {
        throw new Error(
          response.status === 409
            ? t.conflictError
            : (body.message ?? t.updateError)
        )
      }
      setEditTarget(null)
      await loadInventory()
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : t.updateError)
    } finally {
      setSavingEdit(false)
    }
  }

  const openRotate = (row: MetaAppRow) => {
    setRotateTarget(row)
    setRotateForm(emptyRotateForm)
  }

  const submitRotate = async () => {
    if (!rotateTarget) return
    if (!rotateForm.appSecret.trim() || !rotateForm.verifyToken.trim()) {
      setError(t.rotateValidation)
      return
    }
    setRotating(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/${rotateTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rotateForm),
      })
      const body = (await response.json()) as MutationResponse
      if (!response.ok || !body.ok) {
        throw new Error(body.message ?? t.rotateError)
      }
      setRotateTarget(null)
      setRotateForm(emptyRotateForm)
      await loadInventory()
    } catch (rotateError) {
      setError(
        rotateError instanceof Error ? rotateError.message : t.rotateError
      )
    } finally {
      setRotating(false)
    }
  }

  const deleteApp = async (row: MetaAppRow) => {
    if (!window.confirm(t.deleteConfirm.replace("{name}", row.name))) return
    setBusyId(row.id)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/${row.id}`, {
        method: "DELETE",
      })
      const body = (await response.json()) as MutationResponse
      if (!response.ok || !body.ok) {
        throw new Error(
          response.status === 409
            ? t.conflictError
            : (body.message ?? t.deleteError)
        )
      }
      await loadInventory()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : t.deleteError
      )
    } finally {
      setBusyId(null)
    }
  }

  const copyCallbackUrl = async (path: string) => {
    await navigator.clipboard.writeText(`${baseUrl}${path}`)
  }

  return (
    <section className="flex flex-col gap-6 px-6 pb-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{t.heading}</h2>
          <p className="text-sm text-muted-foreground">{t.description}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 size-4" />
              {t.newAppButton}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.createDialog.title}</DialogTitle>
              <DialogDescription>
                {t.createDialog.description}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="meta-app-name">
                  {t.createDialog.nameLabel}
                </Label>
                <Input
                  id="meta-app-name"
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, name: event.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meta-app-id">
                  {t.createDialog.metaAppIdLabel}
                </Label>
                <Input
                  id="meta-app-id"
                  value={createForm.metaAppId}
                  onChange={(event) =>
                    setCreateForm({
                      ...createForm,
                      metaAppId: event.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meta-app-secret">
                  {t.createDialog.appSecretLabel}
                </Label>
                <Input
                  id="meta-app-secret"
                  type="password"
                  autoComplete="off"
                  value={createForm.appSecret}
                  onChange={(event) =>
                    setCreateForm({
                      ...createForm,
                      appSecret: event.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meta-app-verify-token">
                  {t.createDialog.verifyTokenLabel}
                </Label>
                <Input
                  id="meta-app-verify-token"
                  type="password"
                  autoComplete="off"
                  value={createForm.verifyToken}
                  onChange={(event) =>
                    setCreateForm({
                      ...createForm,
                      verifyToken: event.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meta-app-default-version">
                  {t.createDialog.versionLabel}
                </Label>
                <Input
                  id="meta-app-default-version"
                  value={createForm.defaultVersion}
                  onChange={(event) =>
                    setCreateForm({
                      ...createForm,
                      defaultVersion: event.target.value,
                    })
                  }
                  placeholder={t.createDialog.versionPlaceholder}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meta-app-system-token">
                  {t.createDialog.masterTokenLabel}
                </Label>
                <Input
                  id="meta-app-system-token"
                  type="password"
                  autoComplete="off"
                  value={createForm.systemToken}
                  onChange={(event) =>
                    setCreateForm({
                      ...createForm,
                      systemToken: event.target.value,
                    })
                  }
                  placeholder={t.createDialog.masterTokenPlaceholder}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t.createDialog.masterTokenHint}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false)
                  setCreateForm(emptyCreateForm)
                }}
              >
                {t.createDialog.btnCancel}
              </Button>
              <Button onClick={() => void submitCreate()} disabled={creating}>
                {creating
                  ? t.createDialog.btnCreating
                  : t.createDialog.btnCreate}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.table.cardTitle}</CardTitle>
          <CardDescription>{t.table.cardDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t.table.loading}
            </p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t.table.empty}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.table.colName}</TableHead>
                    <TableHead>{t.table.colMetaAppId}</TableHead>
                    <TableHead>{t.table.colVersion}</TableHead>
                    <TableHead>{t.table.colMasterToken}</TableHead>
                    <TableHead>{t.table.colCallbackUrl}</TableHead>
                    <TableHead>{t.table.colDevices}</TableHead>
                    <TableHead>{t.table.colStatus}</TableHead>
                    <TableHead className="text-right">
                      {t.table.colActions}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const busy = busyId === row.id
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          {row.name}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.metaAppId}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="font-mono text-xs"
                          >
                            {row.defaultVersion || "v24.0"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.hasSystemToken ? "outline" : "secondary"
                            }
                            className="text-xs"
                          >
                            {row.hasSystemToken
                              ? t.table.tokenConfigured
                              : t.table.tokenNotSet}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-64">
                          <div className="flex items-center gap-2">
                            <code className="min-w-0 flex-1 truncate rounded bg-muted px-1.5 py-0.5 text-xs">
                              {baseUrl}
                              {row.callbackPath}
                            </code>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label={t.table.copyCallbackUrl.replace(
                                "{name}",
                                row.name
                              )}
                              onClick={() =>
                                void copyCallbackUrl(row.callbackPath)
                              }
                            >
                              <Copy className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{row.deviceCount}</TableCell>
                        <TableCell>
                          <Badge variant={row.active ? "success" : "secondary"}>
                            {row.active
                              ? t.table.statusActive
                              : t.table.statusInactive}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => openEdit(row)}
                            >
                              <Pencil className="mr-1.5 size-3.5" />
                              {t.table.btnEdit}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => openRotate(row)}
                            >
                              <RotateCw className="mr-1.5 size-3.5" />
                              {t.table.btnRotate}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => void deleteApp(row)}
                            >
                              <Trash2 className="mr-1.5 size-3.5" />
                              {t.table.btnDelete}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t.editDialog.title.replace("{name}", editTarget?.name ?? "")}
            </DialogTitle>
            <DialogDescription>{t.editDialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-meta-app-name">
                {t.editDialog.nameLabel}
              </Label>
              <Input
                id="edit-meta-app-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-meta-app-default-version">
                {t.editDialog.versionLabel}
              </Label>
              <Input
                id="edit-meta-app-default-version"
                value={editDefaultVersion}
                onChange={(event) => setEditDefaultVersion(event.target.value)}
                placeholder={t.editDialog.versionPlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-meta-app-system-token">
                {t.editDialog.masterTokenLabel}
              </Label>
              <Input
                id="edit-meta-app-system-token"
                type="password"
                autoComplete="off"
                value={editSystemToken}
                onChange={(event) => setEditSystemToken(event.target.value)}
                placeholder={t.editDialog.masterTokenPlaceholder}
              />
              <p className="text-[11px] text-muted-foreground">
                {t.editDialog.masterTokenHint}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-meta-app-active">
                {t.editDialog.activeLabel}
              </Label>
              <Switch
                id="edit-meta-app-active"
                checked={editActive}
                onCheckedChange={setEditActive}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              {t.editDialog.btnCancel}
            </Button>
            <Button onClick={() => void submitEdit()} disabled={savingEdit}>
              {savingEdit ? t.editDialog.btnSaving : t.editDialog.btnSave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rotateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRotateTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t.rotateDialog.title.replace("{name}", rotateTarget?.name ?? "")}
            </DialogTitle>
            <DialogDescription>{t.rotateDialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="rotate-app-secret">
                {t.rotateDialog.appSecretLabel}
              </Label>
              <Input
                id="rotate-app-secret"
                type="password"
                autoComplete="off"
                value={rotateForm.appSecret}
                onChange={(event) =>
                  setRotateForm({
                    ...rotateForm,
                    appSecret: event.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rotate-verify-token">
                {t.rotateDialog.verifyTokenLabel}
              </Label>
              <Input
                id="rotate-verify-token"
                type="password"
                autoComplete="off"
                value={rotateForm.verifyToken}
                onChange={(event) =>
                  setRotateForm({
                    ...rotateForm,
                    verifyToken: event.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRotateTarget(null)}>
              {t.rotateDialog.btnCancel}
            </Button>
            <Button onClick={() => void submitRotate()} disabled={rotating}>
              {rotating ? t.rotateDialog.btnRotating : t.rotateDialog.btnRotate}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
