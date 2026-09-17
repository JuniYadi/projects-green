"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"

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
import { CountryFlag } from "@/components/ui/country-flag"
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

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

import {
  listVpnRegions,
  createVpnRegion,
  updateVpnRegion,
  deleteVpnRegion,
  type VpnRegionItem,
} from "./vpn-admin-client"

type FormState = { name: string; countryCode: string; isActive: boolean }

const EMPTY_FORM: FormState = { name: "", countryCode: "", isActive: true }

export function RegionsTable() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)

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
      const res = await listVpnRegions()
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
      countryCode: region.countryCode,
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
        await updateVpnRegion(editing.id, JSON.parse(body))
      } else {
        await createVpnRegion(JSON.parse(body))
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
    const confirmed = window.confirm(
      messages.pPortalVpnRegionsTable.confirmDelete.replace(
        "{name}",
        region.name
      )
    )
    if (!confirmed) return
    try {
      await deleteVpnRegion(region.id)
      await load()
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate} size="sm">
          <PlusIcon className="mr-2 h-4 w-4" />
          {messages.pPortalVpnRegionsTable.addRegion}
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
              <TableHead className="w-16">
                {messages.pPortalVpnRegionsTable.flag}
              </TableHead>
              <TableHead>{messages.pPortalVpnRegionsTable.name}</TableHead>
              <TableHead>{messages.pPortalVpnRegionsTable.slug}</TableHead>
              <TableHead>{messages.pPortalVpnRegionsTable.servers}</TableHead>
              <TableHead>{messages.pPortalVpnRegionsTable.active}</TableHead>
              <TableHead className="text-right">
                {messages.pPortalVpnRegionsTable.actions}
              </TableHead>
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
                  {messages.pPortalVpnRegionsTable.noRegionsYet}
                </TableCell>
              </TableRow>
            ) : (
              regions.map((region) => (
                <TableRow key={region.id}>
                  <TableCell className="font-mono text-sm uppercase">
                    <span className="inline-flex items-center gap-1.5">
                      <CountryFlag
                        country={region.countryCode}
                        className="rounded-2xs inline-block h-3.5 w-5 shrink-0 object-cover shadow-2xs"
                      />
                      <span>{region.countryCode}</span>
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{region.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {region.slug}
                  </TableCell>
                  <TableCell>{region.serverCount}</TableCell>
                  <TableCell>
                    <Badge variant={region.isActive ? "default" : "secondary"}>
                      {region.isActive
                        ? messages.pPortalVpnRegionsTable.active
                        : messages.pPortalVpnRegionsTable.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(region)}
                        aria-label={messages.pPortalVpnRegionsTable.editRegionAria.replace(
                          "{name}",
                          region.name
                        )}
                      >
                        <PencilSimpleIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(region)}
                        disabled={region.serverCount > 0}
                        aria-label={messages.pPortalVpnRegionsTable.deleteRegionAria.replace(
                          "{name}",
                          region.name
                        )}
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
            <DialogTitle>
              {editing
                ? messages.pPortalVpnRegionsTable.editRegion
                : messages.pPortalVpnRegionsTable.addRegion}
            </DialogTitle>
            <DialogDescription>
              {messages.pPortalVpnRegionsTable.slugAutoGenerated}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="region-name">
                {messages.pPortalVpnRegionsTable.name}
              </Label>
              <Input
                id="region-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={messages.pPortalVpnRegionsTable.namePlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region-country">
                {messages.pPortalVpnRegionsTable.countryCode}
              </Label>
              <Input
                id="region-country"
                value={form.countryCode}
                onChange={(e) =>
                  setForm({ ...form, countryCode: e.target.value })
                }
                placeholder="id"
                maxLength={8}
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
              {messages.pPortalVpnRegionsTable.active}
            </label>
            {formError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {formError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {messages.pPortalVpnRegionsTable.cancel}
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving
                ? messages.pPortalVpnRegionsTable.saving
                : messages.pPortalVpnRegionsTable.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
