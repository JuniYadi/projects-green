"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { eden } from "@/lib/eden"
import { useEffect, useState } from "react"

import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
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
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlusIcon, PencilIcon, TrashIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

type RuntimeMapping = {
  id: string
  frameworkId: string
  frameworkVersion: string | null
  runtimeId: string
  runtimeVersion: string
  buildVersion: string | null
  isActive: boolean
  priority: number
}

type MappingFormData = {
  frameworkId: string
  frameworkVersion: string
  runtimeId: string
  runtimeVersion: string
  buildVersion: string
  priority: number
}

const EMPTY_FORM: MappingFormData = {
  frameworkId: "",
  frameworkVersion: "",
  runtimeId: "node",
  runtimeVersion: "",
  buildVersion: "",
  priority: 0,
}

const RUNTIME_OPTIONS = [
  { value: "node", label: "Node.js" },
  { value: "php", label: "PHP" },
  { value: "python", label: "Python" },
  { value: "ruby", label: "Ruby" },
  { value: "java", label: "Java" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
]

function MappingFormDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  isEditing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: MappingFormData
  onSubmit: (data: MappingFormData) => Promise<void>
  isEditing: boolean
}) {
  const [form, setForm] = useState<MappingFormData>(initialData ?? EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.frameworkId.trim() || !form.runtimeVersion.trim()) return

    setIsSubmitting(true)
    try {
      await onSubmit(form)
      onOpenChange(false)
    } catch {
      toast.error("Failed to save mapping")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? "Edit Runtime Mapping"
              : "Create Runtime Mapping"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the runtime mapping configuration."
              : "Define a new framework-to-runtime mapping."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frameworkId">Framework ID</Label>
              <Input
                id="frameworkId"
                value={form.frameworkId}
                onChange={(e) =>
                  setForm({ ...form, frameworkId: e.target.value })
                }
                placeholder="e.g., laravel, nextjs"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="frameworkVersion">
                Framework Version (blank = wildcard)
              </Label>
              <Input
                id="frameworkVersion"
                value={form.frameworkVersion}
                onChange={(e) =>
                  setForm({ ...form, frameworkVersion: e.target.value })
                }
                placeholder="e.g., 10, 14"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="runtimeId">Runtime</Label>
              <Select
                value={form.runtimeId}
                onValueChange={(value) =>
                  setForm({ ...form, runtimeId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RUNTIME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="runtimeVersion">Runtime Version</Label>
              <Input
                id="runtimeVersion"
                value={form.runtimeVersion}
                onChange={(e) =>
                  setForm({ ...form, runtimeVersion: e.target.value })
                }
                placeholder="e.g., 8.2, 20"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buildVersion">
                Build Version (optional)
              </Label>
              <Input
                id="buildVersion"
                value={form.buildVersion}
                onChange={(e) =>
                  setForm({ ...form, buildVersion: e.target.value })
                }
                placeholder="e.g., node-20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                value={form.priority}
                onChange={(e) =>
                  setForm({
                    ...form,
                    priority: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : isEditing
                  ? "Update Mapping"
                  : "Create Mapping"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function MatrixTable() {
  const [mappings, setMappings] = useState<RuntimeMapping[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingMapping, setEditingMapping] = useState<RuntimeMapping | null>(
    null
  )
  const [includeInactive, setIncludeInactive] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = () => setRefreshKey((k) => k + 1)

  useEffect(() => {
    const abortController = new AbortController()

    async function fetchMappings() {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (includeInactive) params.set("includeInactive", "true")
        const { data } = await eden.api.admin.detector.mappings.get({
          $query: Object.fromEntries(params.entries()),
          $fetch: { signal: abortController.signal },
        })
        if (data.ok) {
          setMappings(data.data)
        } else {
          setError(data.message || "Failed to load mappings")
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setIsLoading(false)
      }
    }

    void fetchMappings()
    return () => abortController.abort()
  }, [includeInactive, refreshKey])

  const handleCreate = async (formData: MappingFormData) => {
    const { data } = await eden.api.admin.detector.mappings.post({
      frameworkId: formData.frameworkId,
      frameworkVersion: formData.frameworkVersion || undefined,
      runtimeId: formData.runtimeId,
      runtimeVersion: formData.runtimeVersion,
      buildVersion: formData.buildVersion || undefined,
      priority: formData.priority,
    })
    if (!data.ok) throw new Error(data.message)
    toast.success("Mapping created successfully")
    refresh()
  }

  const handleUpdate = async (formData: MappingFormData) => {
    if (!editingMapping) return
    const { data } = await eden.api.admin.detector.mappings[editingMapping.id].patch({
      frameworkId: formData.frameworkId,
      frameworkVersion: formData.frameworkVersion || null,
      runtimeId: formData.runtimeId,
      runtimeVersion: formData.runtimeVersion,
      buildVersion: formData.buildVersion || null,
      priority: formData.priority,
    })
    if (!data.ok) throw new Error(data.message)
    toast.success("Mapping updated successfully")
    refresh()
  }

  const handleToggleActive = async (mapping: RuntimeMapping) => {
    const { data } = await eden.api.admin.detector.mappings[mapping.id].patch({ isActive: !mapping.isActive })
    if (data.ok) {
      toast.success(
        `Mapping ${mapping.isActive ? "deactivated" : "activated"} successfully`
      )
      refresh()
    } else {
      toast.error(data.message || "Failed to toggle mapping status")
    }
  }

  const handleDelete = async (mapping: RuntimeMapping) => {
    if (
      !window.confirm(
        `Delete mapping ${mapping.frameworkId} -> ${mapping.runtimeId} ${mapping.runtimeVersion}?`
      )
    )
      return

    const { data } = await eden.api.admin.detector.mappings[mapping.id].delete()
    if (data.ok) {
      toast.success("Mapping deleted successfully")
      refresh()
    } else {
      toast.error(data.message || "Failed to delete mapping")
    }
  }

  const columns: ColumnDef<RuntimeMapping>[] = [
    {
      accessorKey: "frameworkId",
      header: "Framework",
      cell: ({ row }) => (
        <div className="font-medium">
          {row.original.frameworkId}
          {row.original.frameworkVersion && (
            <span className="ml-1 text-muted-foreground">
              v{row.original.frameworkVersion}
            </span>
          )}
          {!row.original.frameworkVersion && (
            <span className="ml-1 text-xs text-muted-foreground">
              (all versions)
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "runtimeId",
      header: "Runtime",
      cell: ({ row }) => (
        <div>
          <Badge variant="outline">{row.original.runtimeId}</Badge>
          <span className="ml-1">v{row.original.runtimeVersion}</span>
        </div>
      ),
    },
    {
      accessorKey: "buildVersion",
      header: "Build Version",
      cell: ({ row }) => (
        <div className="text-muted-foreground">
          {row.original.buildVersion ?? "—"}
        </div>
      ),
    },
    {
      accessorKey: "priority",
      header: "Priority",
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingMapping(row.original)}
          >
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleActive(row.original)}
          >
            {row.original.isActive ? "Deactivate" : "Activate"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(row.original)}
          >
            <TrashIcon className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIncludeInactive(!includeInactive)}
        >
          {includeInactive ? "Hide Inactive" : "Show Inactive"}
        </Button>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Mapping
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={mappings}
        searchableColumns={["frameworkId", "runtimeId"]}
        searchPlaceholder="Search mappings..."
        emptyMessage="No runtime mappings found."
      />
      <MappingFormDialog
        key={`create-${showCreate}`}
        open={showCreate}
        onOpenChange={setShowCreate}
        onSubmit={handleCreate}
        isEditing={false}
      />
      {editingMapping && (
        <MappingFormDialog
          key={editingMapping.id}
          open={!!editingMapping}
          onOpenChange={(open) => {
            if (!open) setEditingMapping(null)
          }}
          initialData={{
            frameworkId: editingMapping.frameworkId,
            frameworkVersion: editingMapping.frameworkVersion ?? "",
            runtimeId: editingMapping.runtimeId,
            runtimeVersion: editingMapping.runtimeVersion,
            buildVersion: editingMapping.buildVersion ?? "",
            priority: editingMapping.priority,
          }}
          onSubmit={handleUpdate}
          isEditing
        />
      )}
    </div>
  )
}
