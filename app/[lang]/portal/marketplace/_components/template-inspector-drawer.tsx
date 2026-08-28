"use client"

import React, { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  CheckCircle,
  XCircle,
  Star,
  Cpu,
  Database,
  Lock,
  Package,
} from "@phosphor-icons/react"
import type { AppTemplateBlueprint } from "@/modules/deploy/blueprint/app-template-blueprint.schema"

export interface AdminTemplateRecord {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  readmeMarkdown?: string | null
  iconUrl?: string | null
  category: string
  visibility: "PRIVATE" | "PENDING_REVIEW" | "PUBLIC" | "REJECTED" | "UNLISTED"
  version: string
  blueprintJson: AppTemplateBlueprint
  isOfficial: boolean
  isFeatured: boolean
  priceMonthly?: number | string | null
  currency?: string | null
  verifiedAt?: string | Date | null
  reviewNotes?: string | null
  installCount: number
  organizationId?: string | null
  createdAt: string | Date
  updatedAt: string | Date
}

interface TemplateInspectorDrawerProps {
  template: AdminTemplateRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove: (id: string) => Promise<void>
  onReject: (id: string, reviewNotes: string) => Promise<void>
  onToggleFeatured: (id: string) => Promise<void>
}

export function TemplateInspectorDrawer({
  template,
  open,
  onOpenChange,
  onApprove,
  onReject,
  onToggleFeatured,
}: TemplateInspectorDrawerProps) {
  const [rejectNote, setRejectNote] = useState("")
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!template) return null

  const blueprint = template.blueprintJson || {}
  const runtime = blueprint.runtime || {
    image: "N/A",
    defaultPort: 80,
    runAsNonRoot: true,
  }
  const resources = blueprint.resources || {
    defaultCpu: 500,
    defaultMemory: 512,
  }
  const storage = blueprint.storage
  const dependencies = blueprint.dependencies || []
  const envSchema = blueprint.envSchema || []

  const handleApprove = async () => {
    setIsSubmitting(true)
    try {
      await onApprove(template.id)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!rejectNote.trim()) return
    setIsSubmitting(true)
    try {
      await onReject(template.id, rejectNote.trim())
      setShowRejectForm(false)
      setRejectNote("")
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleFeatured = async () => {
    setIsSubmitting(true)
    try {
      await onToggleFeatured(template.id)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-2xl">
        <SheetHeader className="space-y-2 border-b pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {template.category}
              </Badge>
              {template.isOfficial && (
                <Badge variant="secondary" className="text-xs">
                  Official
                </Badge>
              )}
              {template.isFeatured && (
                <Badge variant="default" className="text-xs">
                  Featured
                </Badge>
              )}
              <Badge
                variant={
                  template.visibility === "PUBLIC"
                    ? "default"
                    : template.visibility === "PENDING_REVIEW"
                      ? "destructive"
                      : "secondary"
                }
                className="text-xs"
              >
                {template.visibility}
              </Badge>
            </div>
            <Button
              variant={template.isFeatured ? "default" : "outline"}
              size="sm"
              onClick={() => onToggleFeatured(template.id)}
              className="gap-1.5"
            >
              <Star
                className={`size-4 ${template.isFeatured ? "fill-amber-400" : ""}`}
              />
              {template.isFeatured ? "Featured" : "Feature on Marketplace"}
            </Button>
          </div>
          <SheetTitle className="text-xl font-bold">{template.name}</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {template.tagline}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-6">
            {/* Description */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Overview & Description
              </h4>
              <p className="text-sm leading-relaxed">{template.description}</p>
            </div>

            <Separator />

            {/* Container & Runtime Blueprint */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <Package className="size-4" /> Container Runtime
              </h4>
              <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Image:</span>
                  <p className="font-mono font-medium">{runtime.image}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">
                    Default Port:
                  </span>
                  <p className="font-mono font-medium">{runtime.defaultPort}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">
                    Non-Root Security:
                  </span>
                  <p className="font-medium">
                    {runtime.runAsNonRoot ? "Enforced (true)" : "Root (false)"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">
                    Health Check Path:
                  </span>
                  <p className="font-mono font-medium">
                    {runtime.healthCheckPath || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Resource Limits */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <Cpu className="size-4" /> Resource Allocation
              </h4>
              <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">
                    Default CPU:
                  </span>
                  <p className="font-mono font-medium">
                    {resources.defaultCpu}m
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">
                    Default Memory:
                  </span>
                  <p className="font-mono font-medium">
                    {resources.defaultMemory}Mi
                  </p>
                </div>
                {storage?.enabled && (
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground">
                      Persistent Volume:
                    </span>
                    <p className="font-mono font-medium">
                      {storage.sizeGbDefault}GB mounted at {storage.mountPath}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Database Dependencies / Managed Stocks */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <Database className="size-4" /> Required Database Stocks
              </h4>
              {dependencies.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No managed database dependencies required.
                </p>
              ) : (
                <div className="space-y-2">
                  {dependencies.map((dep, idx) => (
                    <div
                      key={`${dep.alias}-${idx}`}
                      className="flex items-center justify-between rounded border bg-muted/30 p-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {dep.serviceType}
                        </Badge>
                        <span className="font-medium">{dep.alias}</span>
                      </div>
                      <span className="font-mono text-muted-foreground">
                        Prefix: {dep.envPrefix}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Environment Variables Schema */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <Lock className="size-4" /> Environment Schema (
                {envSchema.length})
              </h4>
              {envSchema.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No additional environment variables declared.
                </p>
              ) : (
                <div className="space-y-2">
                  {envSchema.map((env, idx) => (
                    <div
                      key={`${env.key}-${idx}`}
                      className="rounded border bg-muted/30 p-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold">
                          {env.key}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {env.required && (
                            <Badge
                              variant="destructive"
                              className="h-4 px-1 text-[10px]"
                            >
                              Required
                            </Badge>
                          )}
                          {env.isSecret && (
                            <Badge
                              variant="secondary"
                              className="h-4 px-1 text-[10px]"
                            >
                              Secret
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className="h-4 px-1 text-[10px]"
                          >
                            {env.dataType}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {env.label}
                        {env.description ? ` — ${env.description}` : ""}
                      </p>
                      {env.defaultValue && (
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                          Default: {env.defaultValue}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rejection Note Form if active */}
            {showRejectForm && (
              <div className="space-y-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                <h4 className="text-xs font-semibold text-destructive">
                  Reason for Rejection
                </h4>
                <Textarea
                  placeholder="Provide detailed feedback on why this template was rejected..."
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  className="text-xs"
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowRejectForm(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleReject}
                    disabled={!rejectNote.trim() || isSubmitting}
                  >
                    Confirm Rejection
                  </Button>
                </div>
              </div>
            )}

            {/* Existing Review Notes if rejected */}
            {template.reviewNotes && (
              <div className="space-y-1 rounded border border-destructive/30 bg-destructive/10 p-3 text-xs">
                <span className="font-semibold text-destructive">
                  Past Review Notes:
                </span>
                <p className="text-muted-foreground">{template.reviewNotes}</p>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="border-t pt-4">
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleFeatured}
              disabled={isSubmitting}
              className="gap-1.5"
            >
              <Star
                className={`size-4 ${
                  template.isFeatured ? "fill-amber-400 text-amber-500" : ""
                }`}
              />
              {template.isFeatured ? "Unfeature" : "Feature"}
            </Button>

            <div className="flex items-center gap-2">
              {template.visibility !== "REJECTED" && !showRejectForm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRejectForm(true)}
                  disabled={isSubmitting}
                  className="gap-1.5 text-destructive hover:bg-destructive/10"
                >
                  <XCircle className="size-4" /> Reject
                </Button>
              )}

              {template.visibility !== "PUBLIC" && (
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="gap-1.5"
                >
                  <CheckCircle className="size-4" /> Approve Template
                </Button>
              )}
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
