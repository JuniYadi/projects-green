/**
 * Template Detail — Reusable detail view component
 *
 * Shows template metadata, language variants, and action buttons.
 */

"use client"

import {
  WarningCircle,
  ArrowsClockwise,
  Lightning,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TemplateLanguageBadge,
  WhatsAppTemplatePreview,
} from "./template-preview"
import type { WhatsAppTemplate } from "@/lib/api/whatsapp-client"

type TemplateDetailProps = {
  template: WhatsAppTemplate | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onEdit?: () => void
  onDelete?: () => void
  onSync?: () => void
  syncing?: boolean
}

export function TemplateDetailView({
  template,
  loading,
  error,
  onRetry,
  onEdit,
  onDelete,
  onSync,
  syncing,
}: TemplateDetailProps) {
  // ── Loading skeleton ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
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

  // ── Not found ─────────────────────────────────────────────────────────

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Lightning
          className="mb-3 size-10 text-muted-foreground"
          weight="fill"
        />
        <p className="text-sm text-muted-foreground">Template not found.</p>
      </div>
    )
  }

  // ── Format date helper ────────────────────────────────────────────────

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date))

  // ── Main render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{template.name}</h1>
          <p className="text-sm text-muted-foreground">{template.slug}</p>
        </div>
        <div className="flex gap-2">
          {onSync && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={syncing}
            >
              <ArrowsClockwise
                className={`mr-1 size-4 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Syncing..." : "Sync"}
            </Button>
          )}
          {onEdit && (
            <Button variant="default" size="sm" onClick={onEdit}>
              Edit
            </Button>
          )}
          {onDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Template Info</CardTitle>
            <CardDescription>Core template details</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <InfoRow label="Slug" value={template.slug} />
              <InfoRow
                label="Description"
                value={template.description || "-"}
              />
              <InfoRow
                label="Status"
                value={
                  <Badge variant="outline">
                    {template.syncStatus ?? "NOT_SYNCED"}
                  </Badge>
                }
              />
              <InfoRow
                label="Device ID"
                value={template.whatsappDeviceId || "-"}
              />
              <InfoRow
                label="Category"
                value={template.category ?? "Uncategorized"}
              />
              <InfoRow label="Created" value={formatDate(template.createdAt)} />
              <InfoRow label="Last Updated" value={formatDate(template.updatedAt)} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Language Variants</CardTitle>
            <CardDescription>
              {template.languages.length} variant
              {template.languages.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {template.languages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No language variants.
              </p>
            ) : (
              <div className="space-y-3">
                {template.languages.map((lang) => (
                  <div key={lang.id} className="rounded-md border p-3">
                    <div className="mb-2">
                      <TemplateLanguageBadge lang={lang.lang} />
                    </div>
                    {lang.headerType && lang.headerType !== "NONE" && (
                      <p className="mb-1.5 text-xs text-muted-foreground">
                        Header: {lang.headerType}
                      </p>
                    )}
                    <WhatsAppTemplatePreview language={lang} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string | number | React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}
