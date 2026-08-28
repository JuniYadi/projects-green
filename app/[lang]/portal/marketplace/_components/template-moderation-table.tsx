"use client"

import React, { useState } from "react"
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
import { Eye, CheckCircle, Star, MagnifyingGlass } from "@phosphor-icons/react"
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
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

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
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px] text-sm">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              <SelectItem value="AI">AI</SelectItem>
              <SelectItem value="CMS">CMS</SelectItem>
              <SelectItem value="DATABASE">Database</SelectItem>
              <SelectItem value="DEVELOPER_TOOLS">Developer Tools</SelectItem>
              <SelectItem value="ANALYTICS">Analytics</SelectItem>
              <SelectItem value="UTILITIES">Utilities</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[280px]">Template</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Runtime Image</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Featured</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm">
                  Loading templates...
                </TableCell>
              </TableRow>
            ) : filteredTemplates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No templates found in this view.
                </TableCell>
              </TableRow>
            ) : (
              filteredTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">
                        {template.name}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {template.slug} (v{template.version})
                      </span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {template.tagline}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {template.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">
                      {template.blueprintJson?.runtime?.image || "N/A"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={
                          template.visibility === "PUBLIC"
                            ? "default"
                            : template.visibility === "PENDING_REVIEW"
                              ? "secondary"
                              : "destructive"
                        }
                        className="text-xs"
                      >
                        {template.visibility}
                      </Badge>
                      {template.isOfficial && (
                        <Badge variant="outline" className="text-[10px]">
                          Official
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleFeatured(template.id)}
                      disabled={actionLoadingId === template.id}
                      title={template.isFeatured ? "Featured" : "Not Featured"}
                    >
                      <Star
                        className={`size-4 ${
                          template.isFeatured
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onInspect(template)}
                        className="h-8 gap-1 text-xs"
                      >
                        <Eye className="size-3.5" /> Inspect
                      </Button>
                      {template.visibility === "PENDING_REVIEW" && (
                        <Button
                          size="sm"
                          onClick={() => handleApprove(template.id)}
                          disabled={actionLoadingId === template.id}
                          className="h-8 gap-1 text-xs"
                        >
                          <CheckCircle className="size-3.5" /> Approve
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
