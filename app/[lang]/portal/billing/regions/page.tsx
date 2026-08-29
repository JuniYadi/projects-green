"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  DotsThreeVerticalIcon,
  MapPinIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/phosphor-icons"
import { eden } from "@/lib/eden"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

export type ServiceRegionItem = {
  id: string
  code: string
  name: string
  country: string
  flag: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
  _count?: {
    appHostingClusters?: number
    pricings?: number
  }
}

type RegionFormData = {
  code: string
  name: string
  country: string
  flag: string
  isActive: boolean
}

const EMPTY_FORM: RegionFormData = {
  code: "",
  name: "",
  country: "",
  flag: "",
  isActive: true,
}

export default function PortalBillingRegionsPage() {
  const [regions, setRegions] = useState<ServiceRegionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create / Edit modal state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRegion, setEditingRegion] = useState<ServiceRegionItem | null>(
    null
  )
  const [formData, setFormData] = useState<RegionFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Delete modal state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [regionToDelete, setRegionToDelete] =
    useState<ServiceRegionItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Toggling status state
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [shouldFetch, setShouldFetch] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: payload, error: resError } =
          await eden.api.admin.regions.get()
        if (resError || !payload || !payload.ok) {
          const errPayload = (resError?.value || payload) as
            | { message?: string }
            | undefined
          throw new Error(errPayload?.message || "Failed to fetch regions")
        }
        if (!cancelled) {
          setRegions(
            Array.isArray(payload.data)
              ? (payload.data as ServiceRegionItem[])
              : []
          )
        }
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : "Failed to load regions"
          setError(msg)
          toast.error(msg)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [shouldFetch])

  const refetchRegions = () => setShouldFetch((prev) => prev + 1)

  const handleOpenAdd = () => {
    setEditingRegion(null)
    setFormData(EMPTY_FORM)
    setFormError(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (region: ServiceRegionItem) => {
    setEditingRegion(region)
    setFormData({
      code: region.code,
      name: region.name,
      country: region.country,
      flag: region.flag || "",
      isActive: region.isActive,
    })
    setFormError(null)
    setDialogOpen(true)
  }

  const handleToggleActive = async (region: ServiceRegionItem) => {
    setTogglingId(region.id)
    try {
      const nextActive = !region.isActive
      const { data: payload, error: resError } = await eden.api.admin
        .regions({ id: region.id })
        .patch({
          isActive: nextActive,
        })

      if (resError || !payload || !payload.ok) {
        const errPayload = (resError?.value || payload) as
          | { message?: string }
          | undefined
        throw new Error(errPayload?.message || "Failed to update region status")
      }

      setRegions((prev) =>
        prev.map((r) =>
          r.id === region.id ? { ...r, isActive: nextActive } : r
        )
      )
      toast.success(
        `Region ${region.name} is now ${nextActive ? "active" : "inactive"}`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to toggle status"
      toast.error(msg)
    } finally {
      setTogglingId(null)
    }
  }
  const handleSaveRegion = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formData.name.trim()) {
      setFormError("Name is required")
      return
    }
    if (!formData.code.trim()) {
      setFormError("Code is required")
      return
    }
    if (!formData.country.trim() || formData.country.trim().length !== 2) {
      setFormError("Country must be a 2-letter ISO code (e.g. SG, ID, US)")
      return
    }

    setSaving(true)
    try {
      if (editingRegion) {
        const { data: payload, error: resError } = await eden.api.admin
          .regions({ id: editingRegion.id })
          .patch({
            code: formData.code.trim().toUpperCase(),
            name: formData.name.trim(),
            country: formData.country.trim().toUpperCase(),
            flag: formData.flag.trim() || undefined,
            isActive: formData.isActive,
          })

        if (resError || !payload || !payload.ok) {
          const errPayload = (resError?.value || payload) as
            | { message?: string }
            | undefined
          throw new Error(errPayload?.message || "Failed to update region")
        }

        toast.success(`Region ${formData.name} updated successfully`)
      } else {
        const { data: payload, error: resError } =
          await eden.api.admin.regions.post({
            code: formData.code.trim().toUpperCase(),
            name: formData.name.trim(),
            country: formData.country.trim().toUpperCase(),
            flag: formData.flag.trim() || undefined,
            isActive: formData.isActive,
          })

        if (resError || !payload || !payload.ok) {
          const errPayload = (resError?.value || payload) as
            | { message?: string }
            | undefined
          throw new Error(errPayload?.message || "Failed to create region")
        }
        toast.success(`Region ${formData.name} created successfully`)
      }

      setDialogOpen(false)
      refetchRegions()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save region"
      setFormError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleOpenDelete = (region: ServiceRegionItem) => {
    setRegionToDelete(region)
    setDeleteError(null)
    setDeleteDialogOpen(true)
  }

  const handleDeleteRegion = async () => {
    if (!regionToDelete) return

    setDeleting(true)
    try {
      const { data: payload, error: resError } = await eden.api.admin
        .regions({ id: regionToDelete.id })
        .delete()
      if (resError || !payload || !payload.ok) {
        const errPayload = (resError?.value || payload) as
          | { message?: string }
          | undefined
        throw new Error(errPayload?.message || "Failed to delete region")
      }

      toast.success(`Region ${regionToDelete.name} deleted successfully`)
      setDeleteDialogOpen(false)
      setRegionToDelete(null)
      refetchRegions()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete region"
      setDeleteError(msg)
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  const columns: ColumnDef<ServiceRegionItem>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Region" />
        ),
        cell: ({ row }) => {
          const region = row.original
          return (
            <div className="flex items-center gap-2">
              <span className="text-xl" role="img" aria-label={region.name}>
                {region.flag || "🌐"}
              </span>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">
                  {region.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {region.country}
                </span>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "code",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Code" />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono text-xs">
            {row.original.code}
          </Badge>
        ),
      },
      {
        accessorKey: "country",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Country" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs uppercase">
            {row.original.country}
          </span>
        ),
      },
      {
        id: "clustersCount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Active Clusters" />
        ),
        cell: ({ row }) => {
          const count = row.original._count?.appHostingClusters ?? 0
          return (
            <Badge
              variant={count > 0 ? "secondary" : "outline"}
              className="text-xs"
            >
              {count} {count === 1 ? "cluster" : "clusters"}
            </Badge>
          )
        },
      },
      {
        accessorKey: "isActive",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const region = row.original
          const isToggling = togglingId === region.id
          return (
            <div className="flex items-center gap-2">
              <Switch
                checked={region.isActive}
                disabled={isToggling}
                onCheckedChange={() => handleToggleActive(region)}
                aria-label={`Toggle active state for ${region.name}`}
              />
              <span className="text-xs text-muted-foreground">
                {region.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          )
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const region = row.original
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenEdit(region)}
                aria-label={`Edit ${region.name}`}
              >
                <PencilSimpleIcon className="h-4 w-4" />
                <span className="sr-only">Edit</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label="More options"
                  >
                    <DotsThreeVerticalIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => handleOpenEdit(region)}>
                    <PencilSimpleIcon className="mr-2 h-4 w-4" />
                    Edit Region
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => handleOpenDelete(region)}
                  >
                    <TrashIcon className="mr-2 h-4 w-4" />
                    Delete Region
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [togglingId]
  )

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Master Regions
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage infrastructure regions, ISO country assignments, and regional
            availability.
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="gap-2">
          <PlusIcon className="h-4 w-4" />
          Add Region
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <MapPinIcon className="h-5 w-5 text-muted-foreground" />
            Configured Regions
          </CardTitle>
          <CardDescription>
            Master regions available for App Hosting Clusters and Billing
            Service Packages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchRegions}
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          ) : (
            <DataTable
              tableId="portal-billing-regions"
              columns={columns}
              data={regions}
              searchPlaceholder="Search regions..."
              searchableColumns={["name", "code", "country"]}
              emptyMessage="No regions configured yet. Click 'Add Region' to create one."
            />
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Region Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleSaveRegion}>
            <DialogHeader>
              <DialogTitle>
                {editingRegion ? "Edit Region" : "Add Region"}
              </DialogTitle>
              <DialogDescription>
                {editingRegion
                  ? "Update region details and operational status."
                  : "Create a new master region for infrastructure clusters and packages."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {formError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="region-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="region-name"
                  placeholder="e.g. Singapore"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="region-code">
                    Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="region-code"
                    placeholder="e.g. SINGAPORE"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, code: e.target.value }))
                    }
                    className="font-mono uppercase"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region-country">
                    Country (ISO) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="region-country"
                    placeholder="e.g. SG"
                    maxLength={2}
                    value={formData.country}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        country: e.target.value,
                      }))
                    }
                    className="font-mono uppercase"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="region-flag">Flag Emoji</Label>
                <Input
                  id="region-flag"
                  placeholder="e.g. 🇸🇬"
                  value={formData.flag}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, flag: e.target.value }))
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="region-active"
                    className="text-sm font-medium"
                  >
                    Active Status
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Inactive regions cannot be selected for new clusters or
                    packages.
                  </p>
                </div>
                <Switch
                  id="region-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingRegion
                    ? "Save Changes"
                    : "Create Region"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Region</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{regionToDelete?.name}</strong> ({regionToDelete?.code})?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {deleteError}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                handleDeleteRegion()
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
