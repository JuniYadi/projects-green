"use client"

import { useCallback, useEffect, useState } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PlusIcon, PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react"

import {
  vpnApi,
  type VpnRegionItem,
} from "./vpn-admin-client"

type FormState = { name: string; flagEmoji: string; isActive: boolean }

const EMPTY_FORM: FormState = { name: "", flagEmoji: "", isActive: true }

export function RegionsTable() {
  const [regions, setRegions] = useState<VpnRegionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<VpnRegionItem | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await vpnApi<{ ok: true; data: VpnRegionItem[] }>(
        "/admin/vpn/regions"
      )
      setRegions(res.data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (region: VpnRegionItem) => {
    setEditing(region)
    setForm({
      name: region.name,
      flagEmoji: region.flagEmoji,
      isActive: region.isActive,
    })
    setFormError(null)
    setDialogOpen(true)
  }

  const submit = async () => {
    setSaving(true)
    setFormError(null)
    try {
      const body = JSON.stringify(form)
      if (editing) {
        await vpnApi(`/admin/vpn/regions/${editing.id}`, {
          method: "PUT",
          body,
        })
      } else {
        await vpnApi("/admin/vpn/regions", { method: "POST", body })
      }
      setDialogOpen(false)
      await load()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (region: VpnRegionItem) => {
    if (!window.confirm(`Delete region "${region.name}"?`)) return
    try {
      await vpnApi(`/admin/vpn/regions/${region.id}`, { method: "DELETE" })
      await load()
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define where VPN servers are located.
        </p>
        <Button onClick={openCreate} size="sm">
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Region
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Flag</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Servers</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : regions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-sm text-muted-foreground"
                >
                  No regions yet.
                </TableCell>
              </TableRow>
            ) : (
              regions.map((region) => (
                <TableRow key={region.id}>
                  <TableCell className="text-xl">{region.flagEmoji}</TableCell>
                  <TableCell className="font-medium">{region.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {region.slug}
                  </TableCell>
                  <TableCell>{region.serverCount}</TableCell>
                  <TableCell>
                    <Badge variant={region.isActive ? "default" : "secondary"}>
                      {region.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(region)}
                        aria-label={`Edit ${region.name}`}
                      >
                        <PencilSimpleIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(region)}
                        disabled={region.serverCount > 0}
                        aria-label={`Delete ${region.name}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Region" : "Add Region"}</DialogTitle>
            <DialogDescription>
              Slug is auto-generated from the name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="region-name">Name</Label>
              <Input
                id="region-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Indonesia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region-flag">Flag emoji</Label>
              <Input
                id="region-flag"
                value={form.flagEmoji}
                onChange={(e) =>
                  setForm({ ...form, flagEmoji: e.target.value })
                }
                placeholder="🇮🇩"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
              />
              Active
            </label>
            {formError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {formError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
