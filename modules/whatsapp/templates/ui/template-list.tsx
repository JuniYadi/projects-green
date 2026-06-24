/**
 * Template List — Reusable component
 *
 * Loading skeleton → Error with retry → Empty with CTA → Data table/cards.
 */

"use client"

import {
  Lightning,
  WarningCircle,
  ArrowsClockwise,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { WhatsAppTemplate } from "@/lib/api/whatsapp-client"

type SyncStatus = "NOT_SYNCED" | "SYNCING" | "SYNCED" | "FAILED"

function TemplateStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    NOT_SYNCED: {
      label: "Not Synced",
      className: "text-gray-500 bg-gray-50 dark:bg-gray-900/20",
    },
    SYNCING: {
      label: "Syncing",
      className: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
    },
    SYNCED: {
      label: "Synced",
      className: "text-green-600 bg-green-50 dark:bg-green-900/20",
    },
    FAILED: {
      label: "Failed",
      className: "text-red-600 bg-red-50 dark:bg-red-900/20",
    },
  }

  const { label, className } = config[status as SyncStatus] ?? config.NOT_SYNCED

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}

type TemplateListProps = {
  templates: WhatsAppTemplate[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onCreate?: () => void
  onSelect?: (id: string) => void
  /** Portal needs the full template for device-aware navigation. Mutually exclusive with onSelect. */
  onSelectTemplate?: (template: WhatsAppTemplate) => void
  emptyMessage?: string
  emptyActionLabel?: string
  /** Separate callback for empty-state action when it's not "create". */
  onEmptyAction?: () => void
}

export function TemplateList({
  templates,
  loading,
  error,
  onRetry,
  onCreate,
  onSelect,
  onSelectTemplate,
  emptyMessage = "No templates configured yet",
  emptyActionLabel = "Create Template",
  onEmptyAction,
}: TemplateListProps) {
  // ── Loading skeleton ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="flex items-center gap-4">
              <Skeleton className="size-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <WarningCircle className="mb-3 size-10 text-destructive" />
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
        <Button variant="outline" onClick={onRetry}>
          <ArrowsClockwise className="mr-2 size-4" />
          Retry
        </Button>
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Lightning
          className="mb-3 size-10 text-muted-foreground"
          weight="fill"
        />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        {onEmptyAction ? (
          <Button variant="outline" className="mt-3" onClick={onEmptyAction}>
            {emptyActionLabel}
          </Button>
        ) : onCreate ? (
          <Button variant="outline" className="mt-3" onClick={onCreate}>
            {emptyActionLabel}
          </Button>
        ) : null}
      </div>
    )
  }

  // ── Data list ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {templates.map((template) => (
        <div
          key={template.id}
          className="flex items-center justify-between rounded-lg border p-4"
        >
          <div className="flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-yellow-50 dark:bg-yellow-900/20">
              <Lightning className="size-5 text-yellow-600" weight="fill" />
            </div>
            <div>
              <button
                type="button"
                className="text-left font-medium hover:underline"
                onClick={() => onSelectTemplate?.(template) ?? onSelect?.(template.id)}
              >
                {template.name}
              </button>
              <p className="text-sm text-muted-foreground">{template.slug}</p>
            </div>
          </div>
          <TemplateStatusBadge status={template.syncStatus ?? "NOT_SYNCED"} />
        </div>
      ))}
    </div>
  )
}
