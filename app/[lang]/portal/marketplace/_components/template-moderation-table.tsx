"use client"

import React, { useState } from "react"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Eye,
  CheckCircle,
  Star,
  MagnifyingGlass,
  Copy,
  Check,
  ShieldCheck,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import type { AdminTemplateRecord } from "./template-inspector-drawer"

interface TemplateModerationTableProps {
  templates: AdminTemplateRecord[]
  isLoading?: boolean
  onInspect: (template: AdminTemplateRecord) => void
  onApprove: (id: string) => Promise<void>
  onReject?: (id: string, notes: string) => Promise<void>
  onToggleFeatured: (id: string) => Promise<void>
}

export function TemplateModerationTable({
  templates,
  isLoading = false,
  onInspect,
  onApprove,
  onReject: _onReject,
  onToggleFeatured,
}: TemplateModerationTableProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopyImage = (id: string, imageText: string) => {
    try {
      navigator.clipboard.writeText(imageText)
      setCopiedId(id)
      toast.success("Runtime image copied")
      setTimeout(() => {
        setCopiedId(null)
      }, 2000)
    } catch {
      // Fallback
    }
  }

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      searchTerm.trim() === "" ||
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.tagline.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory =
      categoryFilter === "ALL" || template.category === categoryFilter

    return matchesSearch && matchesCategory
  })

  const handleApprove = async (id: string) => {
    setActionLoadingId(id)
    try {
      await onApprove(id)
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleToggleFeatured = async (id: string) => {
    setActionLoadingId(id)
    try {
      await onToggleFeatured(id)
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <MagnifyingGlass className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={
              messages.pPortalMarketplaceTemplateModerationTable
                .searchPlaceholder
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px] text-sm">
              <SelectValue
                placeholder={
                  messages.pPortalMarketplaceTemplateModerationTable
                    .categoryPlaceholder
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">
                {
                  messages.pPortalMarketplaceTemplateModerationTable
                    .allCategoriesOption
                }
              </SelectItem>
              <SelectItem value="AI">
                {messages.pPortalMarketplaceTemplateModerationTable.categoryAi}
              </SelectItem>
              <SelectItem value="CMS">
                {messages.pPortalMarketplaceTemplateModerationTable.categoryCms}
              </SelectItem>
              <SelectItem value="DATABASE">
                {
                  messages.pPortalMarketplaceTemplateModerationTable
                    .categoryDatabase
                }
              </SelectItem>
              <SelectItem value="DEVELOPER_TOOLS">
                {
                  messages.pPortalMarketplaceTemplateModerationTable
                    .categoryDeveloperTools
                }
              </SelectItem>
              <SelectItem value="ANALYTICS">
                {
                  messages.pPortalMarketplaceTemplateModerationTable
                    .categoryAnalytics
                }
              </SelectItem>
              <SelectItem value="UTILITIES">
                {
                  messages.pPortalMarketplaceTemplateModerationTable
                    .categoryUtilities
                }
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[260px]">
                {messages.pPortalMarketplaceTemplateModerationTable.colTemplate}
              </TableHead>
              <TableHead className="w-[200px]">
                {
                  messages.pPortalMarketplaceTemplateModerationTable
                    .colRuntimeImage
                }
              </TableHead>
              <TableHead className="w-[140px]">
                {messages.pPortalMarketplaceTemplateModerationTable.colStatus}
              </TableHead>
              <TableHead className="w-[140px] text-right">
                {messages.pPortalMarketplaceTemplateModerationTable.colActions}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-sm">
                  {
                    messages.pPortalMarketplaceTemplateModerationTable
                      .loadingTemplates
                  }
                </TableCell>
              </TableRow>
            ) : filteredTemplates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {
                    messages.pPortalMarketplaceTemplateModerationTable
                      .noTemplatesFound
                  }
                </TableCell>
              </TableRow>
            ) : (
              filteredTemplates.map((template) => {
                const runtimeImage =
                  template.blueprintJson?.runtime?.image || "N/A"
                return (
                  <TableRow key={template.id} className="group">
                    <TableCell className="py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-foreground">
                            {template.name}
                          </span>
                          <Badge
                            variant="secondary"
                            className="px-1.5 py-0 font-mono text-[10px]"
                          >
                            v{template.version}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="px-1.5 py-0 font-mono text-[10px] text-muted-foreground uppercase"
                          >
                            {template.category}
                          </Badge>
                        </div>
                        <p
                          className="line-clamp-1 max-w-[320px] text-xs text-muted-foreground"
                          title={template.tagline || template.slug}
                        >
                          {template.tagline || template.slug}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1">
                        <span
                          className="inline-block max-w-[170px] truncate rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                          title={runtimeImage}
                        >
                          {runtimeImage}
                        </span>
                        {runtimeImage !== "N/A" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              handleCopyImage(template.id, runtimeImage)
                            }
                            title="Copy image"
                          >
                            {copiedId === template.id ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={
                            template.visibility === "PUBLIC"
                              ? "secondary"
                              : template.visibility === "PENDING_REVIEW"
                                ? "outline"
                                : "destructive"
                          }
                          className="text-[11px]"
                        >
                          {template.visibility}
                        </Badge>
                        {template.isOfficial && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-sky-500/30 bg-sky-500/10 px-1.5 py-0 text-[10px] text-sky-400"
                          >
                            <ShieldCheck className="size-3 text-sky-400" />
                            <span>
                              {
                                messages
                                  .pPortalMarketplaceTemplateModerationTable
                                  .officialBadge
                              }
                            </span>
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => handleToggleFeatured(template.id)}
                          disabled={actionLoadingId === template.id}
                          title={
                            template.isFeatured ? "Featured" : "Not Featured"
                          }
                        >
                          <Star
                            className={`size-4 ${
                              template.isFeatured
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onInspect(template)}
                          className="h-8 gap-1 text-xs"
                        >
                          <Eye className="size-3.5" />{" "}
                          <span>
                            {
                              messages.pPortalMarketplaceTemplateModerationTable
                                .inspectAction
                            }
                          </span>
                        </Button>
                        {template.visibility === "PENDING_REVIEW" && (
                          <Button
                            size="sm"
                            onClick={() => handleApprove(template.id)}
                            disabled={actionLoadingId === template.id}
                            className="h-8 gap-1 bg-primary text-xs text-primary-foreground"
                          >
                            <CheckCircle className="size-3.5" />{" "}
                            <span>
                              {
                                messages
                                  .pPortalMarketplaceTemplateModerationTable
                                  .approveAction
                              }
                            </span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
