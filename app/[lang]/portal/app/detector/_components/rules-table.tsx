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
import { PlusIcon, PencilIcon, TrashIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

type DetectorRule = {
  id: string
  name: string
  description: string | null
  patternJson: unknown
  implicationsJson: unknown
  confidenceWeight: number
  isActive: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

type RuleFormData = {
  name: string
  description: string
  patternJson: string
  implicationsJson: string
  confidenceWeight: number
  priority: number
}

const EMPTY_FORM: RuleFormData = {
  name: "",
  description: "",
  patternJson: "{}",
  implicationsJson: "{}",
  confidenceWeight: 1.0,
  priority: 0,
}

function RuleFormDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  isEditing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: RuleFormData
  onSubmit: (data: RuleFormData) => Promise<void>
  isEditing: boolean
}) {
  const [form, setForm] = useState<RuleFormData>(initialData ?? EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)

  const validateJson = (value: string): boolean => {
    try {
      JSON.parse(value)
      setJsonError(null)
      return true
    } catch {
      setJsonError("Invalid JSON")
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name.trim()) return
    if (!validateJson(form.patternJson) || !validateJson(form.implicationsJson))
      return

    setIsSubmitting(true)
    try {
      await onSubmit(form)
      onOpenChange(false)
    } catch {
      toast.error("Failed to save rule")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Detection Rule" : "Create Detection Rule"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the detection rule configuration."
              : "Define a new detection rule for the AI framework detector."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Laravel Artisan Detection"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Optional description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="patternJson">Pattern (JSON)</Label>
              <textarea
                id="patternJson"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                value={form.patternJson}
                onChange={(e) => {
                  setForm({ ...form, patternJson: e.target.value })
                  validateJson(e.target.value)
                }}
                placeholder='{"files": ["artisan"], "dependencies": []}'
              />
              {jsonError && (
                <p className="text-xs text-destructive">{jsonError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="implicationsJson">Implications (JSON)</Label>
              <textarea
                id="implicationsJson"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                value={form.implicationsJson}
                onChange={(e) => {
                  setForm({ ...form, implicationsJson: e.target.value })
                  validateJson(e.target.value)
                }}
                placeholder='{"framework": "laravel", "impact": "HINT"}'
              />
              {jsonError && (
                <p className="text-xs text-destructive">{jsonError}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="confidenceWeight">Confidence Weight</Label>
              <Input
                id="confidenceWeight"
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={form.confidenceWeight}
                onChange={(e) =>
                  setForm({
                    ...form,
                    confidenceWeight: parseFloat(e.target.value) || 0,
                  })
                }
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
                  ? "Update Rule"
                  : "Create Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RulesTable() {
  const [rules, setRules] = useState<DetectorRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingRule, setEditingRule] = useState<DetectorRule | null>(null)
  const [includeInactive, setIncludeInactive] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = () => setRefreshKey((k) => k + 1)

  useEffect(() => {
    const abortController = new AbortController()

    async function fetchRules() {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (includeInactive) params.set("includeInactive", "true")
        const { data } = await eden.api.admin.detector.rules.get({
          $query: Object.fromEntries(params.entries()),
          $fetch: { signal: abortController.signal },
        })
        if (!data?.ok) {
          setError(data?.message || "Failed to load rules")
          return
        }
        setRules(data.data as never)
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setIsLoading(false)
      }
    }

    void fetchRules()
    return () => abortController.abort()
  }, [includeInactive, refreshKey])

  const handleCreate = async (formData: RuleFormData) => {
    const { data } = await eden.api.admin.detector.rules.post({
      name: formData.name,
      description: formData.description || undefined,
      patternJson: JSON.parse(formData.patternJson),
      implicationsJson: JSON.parse(formData.implicationsJson),
      confidenceWeight: formData.confidenceWeight,
      priority: formData.priority,
    })
    if (!data?.ok) throw new Error(data?.message || "Failed to create rule")
    toast.success("Rule created successfully")
    refresh()
  }

  const handleUpdate = async (formData: RuleFormData) => {
    if (!editingRule) return
    const { data } = await eden.api.admin.detector.rules[editingRule.id].patch({
      name: formData.name,
      description: formData.description || null,
      patternJson: JSON.parse(formData.patternJson),
      implicationsJson: JSON.parse(formData.implicationsJson),
      confidenceWeight: formData.confidenceWeight,
      priority: formData.priority,
    })
    if (!data?.ok) throw new Error(data?.message || "Failed to update rule")
    toast.success("Rule updated successfully")
    refresh()
  }

  const handleToggleActive = async (rule: DetectorRule) => {
    const { data } = await eden.api.admin.detector.rules[rule.id].patch({
      isActive: !rule.isActive,
    })
    if (!data?.ok) {
      toast.error(data?.message || "Failed to toggle rule status")
      return
    }
    toast.success(
      `Rule ${rule.isActive ? "deactivated" : "activated"} successfully`
    )
    refresh()
  }

  const handleDelete = async (rule: DetectorRule) => {
    if (!window.confirm(`Are you sure you want to delete rule "${rule.name}"?`))
      return

    const { data } = await eden.api.admin.detector.rules[rule.id].delete()
    if (!data?.ok) {
      toast.error(data?.message || "Failed to delete rule")
      return
    }
    toast.success("Rule deleted successfully")
    refresh()
  }

  const columns: ColumnDef<DetectorRule>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
    },
    {
      accessorKey: "implicationsJson",
      header: "Impact",
      cell: ({ row }) => {
        const impl = row.original.implicationsJson as {
          framework?: string
          impact?: string
        } | null
        return (
          <div className="flex items-center gap-2">
            {impl?.framework && (
              <Badge variant="outline">{impl.framework}</Badge>
            )}
            <Badge
              variant={
                impl?.impact === "BLOCK"
                  ? "destructive"
                  : impl?.impact === "HINT"
                    ? "secondary"
                    : "default"
              }
            >
              {impl?.impact ?? "HINT"}
            </Badge>
          </div>
        )
      },
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => <div>{row.original.priority}</div>,
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
            onClick={() => setEditingRule(row.original)}
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIncludeInactive(!includeInactive)}
          >
            {includeInactive ? "Hide Inactive" : "Show Inactive"}
          </Button>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Rule
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={rules}
        searchableColumns={["name"]}
        searchPlaceholder="Search rules..."
        emptyMessage="No detection rules found."
      />
      <RuleFormDialog
        key={`create-${showCreate}`}
        open={showCreate}
        onOpenChange={setShowCreate}
        onSubmit={handleCreate}
        isEditing={false}
      />
      {editingRule && (
        <RuleFormDialog
          key={editingRule.id}
          open={!!editingRule}
          onOpenChange={(open) => {
            if (!open) setEditingRule(null)
          }}
          initialData={{
            name: editingRule.name,
            description: editingRule.description ?? "",
            patternJson: JSON.stringify(editingRule.patternJson, null, 2),
            implicationsJson: JSON.stringify(
              editingRule.implicationsJson,
              null,
              2
            ),
            confidenceWeight: editingRule.confidenceWeight,
            priority: editingRule.priority,
          }}
          onSubmit={handleUpdate}
          isEditing
        />
      )}
    </div>
  )
}
