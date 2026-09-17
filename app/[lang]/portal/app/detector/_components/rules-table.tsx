"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { eden } from "@/lib/eden"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

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

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

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
  patternJson: '{"files":["artisan"]}',
  implicationsJson: '{"framework":"laravel","impact":"HINT"}',
  confidenceWeight: 1.0,
  priority: 0,
}

// Literal JSON samples shown in the textareas — data, not translatable copy.
const PATTERN_JSON_SAMPLE = '{"files": ["artisan"], "dependencies": []}'
const IMPLICATIONS_JSON_SAMPLE = '{"framework": "laravel", "impact": "HINT"}'

function RuleFormDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  isEditing,
  messages,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: RuleFormData
  onSubmit: (data: RuleFormData) => Promise<void>
  isEditing: boolean
  messages: ReturnType<typeof getMessages>
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
      setJsonError(messages.pPortalDetectorRulesTable.invalidJson)
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
      toast.error(messages.pPortalDetectorRulesTable.failedToSaveRule)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? messages.pPortalDetectorRulesTable.editRuleTitle
              : messages.pPortalDetectorRulesTable.createRuleTitle}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? messages.pPortalDetectorRulesTable.editRuleDescription
              : messages.pPortalDetectorRulesTable.createRuleDescription}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              {messages.pPortalDetectorRulesTable.name}
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={messages.pPortalDetectorRulesTable.namePlaceholder}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">
              {messages.pPortalDetectorRulesTable.description}
            </Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder={
                messages.pPortalDetectorRulesTable.descriptionPlaceholder
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="patternJson">
                {messages.pPortalDetectorRulesTable.patternJsonLabel}
              </Label>
              <textarea
                id="patternJson"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                value={form.patternJson}
                onChange={(e) => {
                  setForm({ ...form, patternJson: e.target.value })
                  validateJson(e.target.value)
                }}
                placeholder={PATTERN_JSON_SAMPLE}
              />
              {jsonError && (
                <p className="text-xs text-destructive">{jsonError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="implicationsJson">
                {messages.pPortalDetectorRulesTable.implicationsJsonLabel}
              </Label>
              <textarea
                id="implicationsJson"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                value={form.implicationsJson}
                onChange={(e) => {
                  setForm({ ...form, implicationsJson: e.target.value })
                  validateJson(e.target.value)
                }}
                placeholder={IMPLICATIONS_JSON_SAMPLE}
              />
              {jsonError && (
                <p className="text-xs text-destructive">{jsonError}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="confidenceWeight">
                {messages.pPortalDetectorRulesTable.confidenceWeight}
              </Label>
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
              <Label htmlFor="priority">
                {messages.pPortalDetectorRulesTable.priority}
              </Label>
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
              {messages.pPortalDetectorRulesTable.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? messages.pPortalDetectorRulesTable.saving
                : isEditing
                  ? messages.pPortalDetectorRulesTable.updateRule
                  : messages.pPortalDetectorRulesTable.createRule}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RulesTable() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)

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
          setError(
            data?.message ||
              messages.pPortalDetectorRulesTable.failedToLoadRules
          )
          return
        }
        setRules(data.data as never)
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(
          err instanceof Error
            ? err.message
            : messages.pPortalDetectorRulesTable.genericError
        )
      } finally {
        setIsLoading(false)
      }
    }

    void fetchRules()
    return () => abortController.abort()
  }, [includeInactive, refreshKey, messages])

  const handleCreate = async (formData: RuleFormData) => {
    const { data } = await eden.api.admin.detector.rules.post({
      name: formData.name,
      description: formData.description || undefined,
      patternJson: JSON.parse(formData.patternJson),
      implicationsJson: JSON.parse(formData.implicationsJson),
      confidenceWeight: formData.confidenceWeight,
      priority: formData.priority,
    })
    if (!data?.ok)
      throw new Error(
        data?.message || messages.pPortalDetectorRulesTable.failedToCreateRule
      )
    toast.success(messages.pPortalDetectorRulesTable.ruleCreated)
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
    if (!data?.ok)
      throw new Error(
        data?.message || messages.pPortalDetectorRulesTable.failedToUpdateRule
      )
    toast.success(messages.pPortalDetectorRulesTable.ruleUpdated)
    refresh()
  }

  const handleToggleActive = async (rule: DetectorRule) => {
    const { data } = await eden.api.admin.detector.rules[rule.id].patch({
      isActive: !rule.isActive,
    })
    if (!data?.ok) {
      toast.error(
        data?.message || messages.pPortalDetectorRulesTable.failedToToggleRule
      )
      return
    }
    toast.success(
      rule.isActive
        ? messages.pPortalDetectorRulesTable.ruleDeactivated
        : messages.pPortalDetectorRulesTable.ruleActivated
    )
    refresh()
  }

  const handleDelete = async (rule: DetectorRule) => {
    const confirmMessage =
      messages.pPortalDetectorRulesTable.confirmDeleteRule.replace(
        "{name}",
        rule.name
      )
    if (!window.confirm(confirmMessage)) return

    const { data } = await eden.api.admin.detector.rules[rule.id].delete()
    if (!data?.ok) {
      toast.error(
        data?.message || messages.pPortalDetectorRulesTable.failedToDeleteRule
      )
      return
    }
    toast.success(messages.pPortalDetectorRulesTable.ruleDeleted)
    refresh()
  }

  const columns: ColumnDef<DetectorRule>[] = [
    {
      accessorKey: "name",
      header: messages.pPortalDetectorRulesTable.name,
      cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
    },
    {
      accessorKey: "implicationsJson",
      header: messages.pPortalDetectorRulesTable.impact,
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
      header: messages.pPortalDetectorRulesTable.priority,
      cell: ({ row }) => <div>{row.original.priority}</div>,
    },
    {
      accessorKey: "isActive",
      header: messages.pPortalDetectorRulesTable.status,
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive
            ? messages.pPortalDetectorRulesTable.active
            : messages.pPortalDetectorRulesTable.inactive}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: messages.pPortalDetectorRulesTable.actions,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingRule(row.original)}
            aria-label={messages.pPortalDetectorRulesTable.editRule}
          >
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleActive(row.original)}
          >
            {row.original.isActive
              ? messages.pPortalDetectorRulesTable.deactivate
              : messages.pPortalDetectorRulesTable.activate}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(row.original)}
            aria-label={messages.pPortalDetectorRulesTable.deleteRule}
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
            {includeInactive
              ? messages.pPortalDetectorRulesTable.hideInactive
              : messages.pPortalDetectorRulesTable.showInactive}
          </Button>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          {messages.pPortalDetectorRulesTable.addRule}
        </Button>
      </div>
      <DataTable
        tableId="portal-app-detector-rules"
        columns={columns}
        data={rules}
        searchableColumns={["name"]}
        searchPlaceholder={messages.pPortalDetectorRulesTable.searchPlaceholder}
        emptyMessage={messages.pPortalDetectorRulesTable.emptyMessage}
      />
      <RuleFormDialog
        key={`create-${showCreate}`}
        open={showCreate}
        onOpenChange={setShowCreate}
        onSubmit={handleCreate}
        isEditing={false}
        messages={messages}
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
          messages={messages}
        />
      )}
    </div>
  )
}
