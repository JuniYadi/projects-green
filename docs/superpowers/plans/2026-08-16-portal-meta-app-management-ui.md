# Portal WhatsApp Meta App Management UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a super-admin-only portal screen at `/portal/whatsapp/meta-apps` to create, inspect, rotate, and delete `WhatsappMetaApp` webhook credentials, closing Order 2 of the "PRD - Setup Meta Webhook at Portal WhatsApp" delivery tracking table.

**Architecture:** The backend admin API (`/api/admin/whatsapp/meta-apps`) already exists and is fully tested; this plan adds one small backend field (attached-device count on the list endpoint) and a new client-side inventory component + thin server-component page + one sidebar nav entry. No new backend endpoints.

**Tech Stack:** Next.js App Router (Server + Client Components), Elysia route handlers, Prisma, bun:test + @testing-library/react + userEvent, Tailwind, shadcn/ui primitives.

**Spec:** Obsidian vault notes "PRD - Setup Meta Webhook at Portal WhatsApp" (Order 2 row) and "Issue - Build Portal WhatsApp Meta App Management UI".

## Global Constraints

- Use `bun` for all commands. Never `npm`/`yarn`.
- Create a new git branch before starting implementation; commit each changed/created file individually with its own commit (hard project rule).
- TypeScript strict, 2-space indent, no semicolons, double quotes, 80-char line width, `@/*` imports.
- Prisma types must come from `@prisma/client`; no manual model/delegate/enum mirror types.
- API responses use explicit DTOs (`*.dto.ts` + `toDTO` mapper); internal service-to-service calls use Prisma types directly.
- Follow the shared portal Card/Table pattern already used in `modules/whatsapp/organization-api-keys/ui/organization-api-key-inventory.tsx` and its page wrapper `app/[lang]/portal/whatsapp/api-keys/page.tsx` — this is the closest existing precedent (super-admin CRUD-style inventory, plain `fetch`, 403-as-access-denied-card, no server-side redirect).
- Bun tests: mock leaf infrastructure only, `mock.module()` before imports, `mockClear()` + explicit defaults in `beforeEach`.
- Secret/verify-token fields must NEVER be pre-filled from a fetched value on any form — this is a security requirement and needs its own test assertion, not just manual review.
- `requireSuperAdmin` gating on the existing `/admin/whatsapp/meta-apps` API routes is unchanged — do not weaken or bypass it.

---
### Task 1: Return attached-device count from the Meta App list endpoint

**Files:**
- Modify: `modules/whatsapp/meta-apps/meta-apps.dto.ts`
- Modify: `modules/whatsapp/meta-apps/meta-apps.service.ts`
- Modify: `modules/whatsapp/meta-apps/api/meta-apps.route.ts`
- Test: `modules/whatsapp/meta-apps/meta-apps.service.test.ts`
- Test: `modules/whatsapp/meta-apps/api/meta-apps.route.test.ts`

**Interfaces:**
- Consumes: `WhatsappMetaApp` Prisma model with `devices WhatsappDevice[]` relation (see `prisma/schema.prisma`).
- Produces: `WhatsappMetaAppListItemDTO` (all fields of the existing `WhatsappMetaAppDTO` plus `deviceCount: number`), returned only by `MetaAppsService.list()` and only by the route's `GET /` handler. `get`/`create`/`update`/`delete` keep returning the existing `WhatsappMetaAppDTO` shape unchanged (no `deviceCount`).

- [ ] **Step 1: Write the failing service test**

In `modules/whatsapp/meta-apps/meta-apps.service.test.ts`, replace the existing `it("lists active metadata and resolves credentials by webhook key", ...)` block's list-related assertions with:

```ts
it("lists metadata with attached device counts", async () => {
  mockFindMany.mockResolvedValueOnce([
    { ...appRecord, _count: { devices: 3 } },
  ])
  const listed = await service.list()
  expect(mockFindMany.mock.calls[0]?.[0]).toEqual({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { devices: true } } },
  })
  expect(listed[0]).not.toHaveProperty("appSecretEncrypted")
  expect(listed[0]?.deviceCount).toBe(3)
})
```

Leave the rest of that original test's body (the `resolveCredentialsByWebhookKey` assertions further down) in a separate `it` block if they were combined — split them so each `it` tests one behavior.

- [ ] **Step 2: Run it, confirm it fails**

Run: `bun test modules/whatsapp/meta-apps/meta-apps.service.test.ts`
Expected: FAIL — `include` missing from the call args, and/or `deviceCount` is `undefined`.

- [ ] **Step 3: Implement the DTO change**

In `modules/whatsapp/meta-apps/meta-apps.dto.ts`, add after `toWhatsappMetaAppDTO`:

```ts
export type WhatsappMetaAppListItemDTO = WhatsappMetaAppDTO & {
  deviceCount: number
}

export function toWhatsappMetaAppListItemDTO(
  app: Prisma.WhatsappMetaAppGetPayload<{
    include: { _count: { select: { devices: true } } }
  }>
): WhatsappMetaAppListItemDTO {
  return {
    ...toWhatsappMetaAppDTO(app),
    deviceCount: app._count.devices,
  }
}
```

- [ ] **Step 4: Implement the service change**

In `modules/whatsapp/meta-apps/meta-apps.service.ts`, update the import line to also bring in `toWhatsappMetaAppListItemDTO` and `type WhatsappMetaAppListItemDTO` from `./meta-apps.dto`, then replace the `list` method body:

```ts
async list(
  options: MetaAppListOptions = {}
): Promise<WhatsappMetaAppListItemDTO[]> {
  const apps = await this.database.whatsappMetaApp.findMany({
    where: options.activeOnly === false ? {} : { active: true },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { devices: true } } },
  })
  return apps.map(toWhatsappMetaAppListItemDTO)
}
```

- [ ] **Step 5: Run it, confirm it passes**

Run: `bun test modules/whatsapp/meta-apps/meta-apps.service.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add modules/whatsapp/meta-apps/meta-apps.dto.ts modules/whatsapp/meta-apps/meta-apps.service.ts modules/whatsapp/meta-apps/meta-apps.service.test.ts
git commit -m "feat(whatsapp): return attached-device count from meta app list service"
```

- [ ] **Step 7: Write the failing route test**

In `modules/whatsapp/meta-apps/api/meta-apps.route.test.ts`, change the `beforeEach` default `mockList.mockImplementation(async () => [appRecord])` to `mockList.mockImplementation(async () => [{ ...appRecord, deviceCount: 0 }])`, and change the `it("lists active and inactive metadata without credentials", ...)` test's assertion from `expect(body).toEqual({ ok: true, data: [appRecord] })` to `expect(body).toEqual({ ok: true, data: [{ ...appRecord, deviceCount: 0 }] })`.

- [ ] **Step 8: Run it, confirm it fails**

Run: `bun test modules/whatsapp/meta-apps/api/meta-apps.route.test.ts`
Expected: FAIL — route still returns `publicMetaApp(app)` without `deviceCount`.

- [ ] **Step 9: Implement the route change**

In `modules/whatsapp/meta-apps/api/meta-apps.route.ts`, change only the `.get("/", ...)` handler's success branch from:

```ts
const apps = await service.list({ activeOnly: false })
return { ok: true as const, data: apps.map(publicMetaApp) }
```

to:

```ts
const apps = await service.list({ activeOnly: false })
return {
  ok: true as const,
  data: apps.map((app) => ({
    ...publicMetaApp(app),
    deviceCount: app.deviceCount,
  })),
}
```

Leave every other handler (`GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`) untouched — they keep using `publicMetaApp(app)` as-is.

- [ ] **Step 10: Run it, confirm it passes**

Run: `bun test modules/whatsapp/meta-apps/api/meta-apps.route.test.ts`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add modules/whatsapp/meta-apps/api/meta-apps.route.ts modules/whatsapp/meta-apps/api/meta-apps.route.test.ts
git commit -m "feat(whatsapp): expose device count on admin meta app list route"
```
### Task 2: Build the Meta App inventory client component

**Files:**
- Create: `modules/whatsapp/meta-apps/ui/meta-app-inventory.tsx`
- Test: `modules/whatsapp/meta-apps/ui/meta-app-inventory.test.tsx`

**Interfaces:**
- Consumes: `GET/POST/PATCH/DELETE /api/admin/whatsapp/meta-apps[/:id]` JSON responses shaped like `{ ok: boolean, data?: {...}, message?: string }`, where list `data` items are `{ id, name, metaAppId, webhookKey, active, callbackPath, deviceCount, createdAt, updatedAt }` (from Task 1).
- Produces: `WhatsappMetaAppInventory({ baseUrl: string })` — a named-exported React client component, imported by Task 3's page as `import { WhatsappMetaAppInventory } from "@/modules/whatsapp/meta-apps/ui/meta-app-inventory"`.

- [ ] **Step 1: Write the failing component test — list renders with device count, no secrets in response**

Create `modules/whatsapp/meta-apps/ui/meta-app-inventory.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { WhatsappMetaAppInventory } from "./meta-app-inventory"

const metaApp = {
  id: "meta-1",
  name: "Primary",
  metaAppId: "12345",
  webhookKey: "webhook-key",
  active: true,
  callbackPath: "/api/whatsapp/meta-webhook/webhook-key",
  deviceCount: 2,
  createdAt: "2026-08-14T10:00:00.000Z",
  updatedAt: "2026-08-14T10:00:00.000Z",
}

const mockFetch = mock(async (input: string | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.url
  const method = init?.method ?? "GET"
  if (url.includes("/api/admin/whatsapp/meta-apps") && method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, data: [metaApp] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }
  return new Response(JSON.stringify({ ok: false }), { status: 404 })
})

global.fetch = mockFetch as unknown as typeof fetch

describe("WhatsappMetaAppInventory", () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders the list with device count and no secret material", async () => {
    const view = render(
      <WhatsappMetaAppInventory baseUrl="https://app.example.com" />
    )

    expect(await view.findByText("Primary")).toBeTruthy()
    expect(view.getByText("2")).toBeTruthy()
    expect(
      view.getByText("https://app.example.com/api/whatsapp/meta-webhook/webhook-key")
    ).toBeTruthy()
    const allFetchedBodies = mockFetch.mock.results
    expect(JSON.stringify(allFetchedBodies)).not.toContain("appSecret")
    expect(JSON.stringify(allFetchedBodies)).not.toContain("verifyToken")
  })
})
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `bun test modules/whatsapp/meta-apps/ui/meta-app-inventory.test.tsx`
Expected: FAIL — module `./meta-app-inventory` does not exist yet.

- [ ] **Step 3: Implement the component (list + access-denied + create dialog)**

Create `modules/whatsapp/meta-apps/ui/meta-app-inventory.tsx`:

```tsx
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
    void loadInventory()
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
              No Meta Apps yet. Create one to start receiving inbound
              WhatsApp events.
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
              Enter new values for both fields. The previous secret and
              verify token stop working immediately.
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
```
+- [ ] **Step 4: Run it, confirm the Step 1 test passes**

Run: `bun test modules/whatsapp/meta-apps/ui/meta-app-inventory.test.tsx`
Expected: PASS

- [ ] **Step 5: Add and pass the remaining acceptance-criteria tests, one at a time**

Add these `it` blocks to the same test file, each following the pattern: extend `mockFetch` to also handle `POST`/`PATCH`/`DELETE` on `/api/admin/whatsapp/meta-apps`, write the test, run it, confirm it fails only if the component above doesn't already satisfy it (it should — this step is verifying, not adding new component code), then move on. Do not modify the component in this step unless a test genuinely fails against it.

```tsx
it("access-denied state renders on a 403 response", async () => {
  mockFetch.mockImplementationOnce(
    async () =>
      new Response(JSON.stringify({ ok: false }), { status: 403 })
  )
  const view = render(
    <WhatsappMetaAppInventory baseUrl="https://app.example.com" />
  )
  expect(await view.findByText("Access denied")).toBeTruthy()
})

it("create dialog clears the secret fields after a successful submit", async () => {
  const user = userEvent.setup()
  mockFetch.mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.url
    const method = init?.method ?? "GET"
    if (url.endsWith("/meta-apps") && method === "POST") {
      return new Response(
        JSON.stringify({ ok: true, data: { ...metaApp, id: "meta-2" } }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    }
    if (url.includes("/meta-apps") && method === "GET") {
      return new Response(
        JSON.stringify({ ok: true, data: [metaApp] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }
    return new Response(JSON.stringify({ ok: false }), { status: 404 })
  })

  const view = render(
    <WhatsappMetaAppInventory baseUrl="https://app.example.com" />
  )
  await view.findByText("Primary")
  await user.click(view.getByRole("button", { name: "New Meta App" }))
  await user.type(view.getByLabelText("Name"), "Second App")
  await user.type(view.getByLabelText("Meta App ID"), "67890")
  await user.type(view.getByLabelText("App Secret"), "s3cret")
  await user.type(view.getByLabelText("Verify Token"), "t0ken")
  await user.click(view.getByRole("button", { name: "Create" }))

  await waitFor(() =>
    expect(view.queryByLabelText("App Secret")).toBeNull()
  )
})

it("rotate dialog opens with blank credential fields", async () => {
  const user = userEvent.setup()
  const view = render(
    <WhatsappMetaAppInventory baseUrl="https://app.example.com" />
  )
  await view.findByText("Primary")
  await user.click(view.getByRole("button", { name: "Rotate" }))

  const appSecretInput = view.getByLabelText(
    "New App Secret"
  ) as HTMLInputElement
  const verifyTokenInput = view.getByLabelText(
    "New Verify Token"
  ) as HTMLInputElement
  expect(appSecretInput.value).toBe("")
  expect(verifyTokenInput.value).toBe("")
})

it("shows a specific conflict message when deleting a meta app with attached devices", async () => {
  const user = userEvent.setup()
  const originalConfirm = window.confirm
  window.confirm = () => true
  mockFetch.mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.url
    const method = init?.method ?? "GET"
    if (method === "DELETE") {
      return new Response(
        JSON.stringify({ ok: false, error: "CONFLICT", message: "Meta app conflicts with an existing resource." }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      )
    }
    if (url.includes("/meta-apps") && method === "GET") {
      return new Response(
        JSON.stringify({ ok: true, data: [metaApp] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }
    return new Response(JSON.stringify({ ok: false }), { status: 404 })
  })

  const view = render(
    <WhatsappMetaAppInventory baseUrl="https://app.example.com" />
  )
  await view.findByText("Primary")
  await user.click(view.getByRole("button", { name: "Delete" }))

  expect(
    await view.findByText(
      "Cannot delete or deactivate this Meta App while devices are still attached. Detach the devices first."
    )
  ).toBeTruthy()
  window.confirm = originalConfirm
})
```

- [ ] **Step 6: Run the full test file, confirm all pass**

Run: `bun test modules/whatsapp/meta-apps/ui/meta-app-inventory.test.tsx`
Expected: PASS (6 tests total)

- [ ] **Step 7: Commit**

```bash
git add modules/whatsapp/meta-apps/ui/meta-app-inventory.tsx modules/whatsapp/meta-apps/ui/meta-app-inventory.test.tsx
git commit -m "feat(whatsapp): add portal meta app inventory component"
```

### Task 3: Mount the portal page and add sidebar navigation

**Files:**
- Create: `app/[lang]/portal/whatsapp/meta-apps/page.tsx`
- Test: `app/[lang]/portal/whatsapp/meta-apps/page.test.tsx`
- Modify: `components/app-sidebar.tsx`

**Interfaces:**
- Consumes: `WhatsappMetaAppInventory` from Task 2 (`@/modules/whatsapp/meta-apps/ui/meta-app-inventory`), `getEmailBaseUrl` from `@/lib/email-url`.
- Produces: default-exported `PortalWhatsAppMetaAppsPage` React Server Component; the route `/portal/whatsapp/meta-apps` resolves to it.

- [ ] **Step 1: Write the failing page test**

Create `app/[lang]/portal/whatsapp/meta-apps/page.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, waitFor } from "@testing-library/react"

const mockFetch = mock(async () => new Response(
  JSON.stringify({ ok: false }),
  { status: 403, headers: { "Content-Type": "application/json" } }
))
global.fetch = mockFetch as unknown as typeof fetch

const { default: MetaAppsPage } = await import("./page")

describe("PortalWhatsAppMetaAppsPage", () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders the inventory section access-denied state for unauthorized users", async () => {
    const view = render(<MetaAppsPage />)
    await waitFor(() => expect(view.getByText("Access denied")).toBeTruthy())
  })
})
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `bun test app/\[lang\]/portal/whatsapp/meta-apps/page.test.tsx`
Expected: FAIL — `./page` does not exist.

- [ ] **Step 3: Implement the page**

Create `app/[lang]/portal/whatsapp/meta-apps/page.tsx`:

```tsx
import { getEmailBaseUrl } from "@/lib/email-url"
import { WhatsappMetaAppInventory } from "@/modules/whatsapp/meta-apps/ui/meta-app-inventory"

export default function PortalWhatsAppMetaAppsPage() {
  return (
    <main className="flex flex-1 flex-col">
      <WhatsappMetaAppInventory baseUrl={getEmailBaseUrl()} />
    </main>
  )
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `bun test app/\[lang\]/portal/whatsapp/meta-apps/page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit the page**

```bash
git add app/\[lang\]/portal/whatsapp/meta-apps/page.tsx app/\[lang\]/portal/whatsapp/meta-apps/page.test.tsx
git commit -m "feat(whatsapp): mount portal meta app management page"
```

- [ ] **Step 6: Add the sidebar nav entry**

Open `components/app-sidebar.tsx`. Find the whatsapp portal context's `getNavMain` array (the one containing the `"API Keys"` entry pointing at `/portal/whatsapp/api-keys`). Add a new entry immediately after the `"API Keys"` entry:

```tsx
{
  title: "Meta Apps",
  url: localizePathname({
    pathname: "/portal/whatsapp/meta-apps",
    locale,
  }),
  icon: <GearSixIcon />,
  isActive: startsWithRoute(path, "/portal/whatsapp/meta-apps"),
},
```

`GearSixIcon` is already imported at the top of this file (used elsewhere) — do not add a new icon import. If it turns out not to already be imported, add it to the existing `@phosphor-icons/react` import block instead of adding a second import statement.

- [ ] **Step 7: Confirm nothing broke**

Run: `bun run typecheck`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add components/app-sidebar.tsx
git commit -m "feat(whatsapp): add Meta Apps sidebar nav entry"
```
