"use client"

import * as React from "react"
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

type MetaAppRow = {
  id: string
  name: string
  metaAppId: string
  webhookKey: string
  active: boolean
  callbackPath: string
  deviceCount: number
}

type ListResponse = { ok: boolean; data?: MetaAppRow[]; message?: string }
type MutationResponse = { ok: boolean; data?: MetaAppRow; message?: string }

type CreateForm = {
  name: string
  metaAppId: string
  appSecret: string
  verifyToken: string
}

const emptyCreateForm: CreateForm = {
  name: "",
  metaAppId: "",
  appSecret: "",
  verifyToken: "",
}

type RotateForm = { appSecret: string; verifyToken: string }
const emptyRotateForm: RotateForm = { appSecret: "", verifyToken: "" }

const CONFLICT_MESSAGE =
  "Cannot delete or deactivate this Meta App while devices are still attached. Detach the devices first."

const API_BASE = "/api/admin/whatsapp/meta-apps"

type WhatsappMetaAppInventoryProps = { baseUrl: string }

export function WhatsappMetaAppInventory({
  baseUrl,
}: WhatsappMetaAppInventoryProps) {
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
        throw new Error(body.message ?? "Failed to load Meta Apps.")
      }
      setRows(body.data)
    } catch (loadError) {
      setAuthorized((current) => current ?? true)
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load Meta Apps."
      )
    } finally {
      setLoading(false)
    }
  }, [])

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
              Only super-admins can manage Meta App webhook credentials.
            </CardDescription>
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
      setError("Name, Meta App ID, app secret, and verify token are required.")
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
        throw new Error(body.message ?? "Failed to create Meta App.")
      }
      setCreateOpen(false)
      setCreateForm(emptyCreateForm)
      await loadInventory()
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create Meta App."
      )
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (row: MetaAppRow) => {
    setEditTarget(row)
    setEditName(row.name)
    setEditActive(row.active)
  }

  const submitEdit = async () => {
    if (!editTarget) return
    setSavingEdit(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, active: editActive }),
      })
      const body = (await response.json()) as MutationResponse
      if (!response.ok || !body.ok) {
        throw new Error(
          response.status === 409
            ? CONFLICT_MESSAGE
            : (body.message ?? "Failed to update Meta App.")
        )
      }
      setEditTarget(null)
      await loadInventory()
    } catch (editError) {
      setError(
        editError instanceof Error
          ? editError.message
          : "Failed to update Meta App."
      )
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
      setError("Both app secret and verify token are required to rotate.")
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
        throw new Error(body.message ?? "Failed to rotate credentials.")
      }
      setRotateTarget(null)
      setRotateForm(emptyRotateForm)
      await loadInventory()
    } catch (rotateError) {
      setError(
        rotateError instanceof Error
          ? rotateError.message
          : "Failed to rotate credentials."
      )
    } finally {
      setRotating(false)
    }
  }

  const deleteApp = async (row: MetaAppRow) => {
    if (
      !window.confirm(`Delete Meta App "${row.name}"? This cannot be undone.`)
    )
      return
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
            ? CONFLICT_MESSAGE
            : (body.message ?? "Failed to delete Meta App.")
        )
      }
      await loadInventory()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete Meta App."
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
          <h2 className="text-xl font-semibold">Meta Apps</h2>
          <p className="text-sm text-muted-foreground">
            Create, inspect, and rotate the Meta App webhook credentials that
            inbound WhatsApp events route through.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 size-4" />
              New Meta App
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Meta App</DialogTitle>
              <DialogDescription>
                Credentials are encrypted at rest and never shown again after
                creation.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="meta-app-name">Name</Label>
                <Input
                  id="meta-app-name"
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, name: event.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meta-app-id">Meta App ID</Label>
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
                <Label htmlFor="meta-app-secret">App Secret</Label>
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
                <Label htmlFor="meta-app-verify-token">Verify Token</Label>
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
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false)
                  setCreateForm(emptyCreateForm)
                }}
              >
                Cancel
              </Button>
              <Button onClick={() => void submitCreate()} disabled={creating}>
                {creating ? "Creating..." : "Create"}
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
          <CardTitle className="text-base">Meta App inventory</CardTitle>
          <CardDescription>
            Paste the callback URL into Meta&apos;s App Dashboard webhook
            configuration for each app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading Meta Apps...
            </p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No Meta Apps yet. Create one to start receiving inbound WhatsApp
              events.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Meta App ID</TableHead>
                    <TableHead>Callback URL</TableHead>
                    <TableHead>Devices</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                              aria-label={`Copy callback URL for ${row.name}`}
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
                            {row.active ? "Active" : "Inactive"}
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
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => openRotate(row)}
                            >
                              <RotateCw className="mr-1.5 size-3.5" />
                              Rotate
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => void deleteApp(row)}
                            >
                              <Trash2 className="mr-1.5 size-3.5" />
                              Delete
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
            <DialogTitle>Edit {editTarget?.name}</DialogTitle>
            <DialogDescription>
              Update the display name or activation state.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-meta-app-name">Name</Label>
              <Input
                id="edit-meta-app-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-meta-app-active">Active</Label>
              <Switch
                id="edit-meta-app-active"
                checked={editActive}
                onCheckedChange={setEditActive}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => void submitEdit()} disabled={savingEdit}>
              {savingEdit ? "Saving..." : "Save"}
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
              Rotate credentials for {rotateTarget?.name}
            </DialogTitle>
            <DialogDescription>
              Enter new values for both fields. The previous secret and verify
              token stop working immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="rotate-app-secret">New App Secret</Label>
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
              <Label htmlFor="rotate-verify-token">New Verify Token</Label>
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
              Cancel
            </Button>
            <Button onClick={() => void submitRotate()} disabled={rotating}>
              {rotating ? "Rotating..." : "Rotate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
