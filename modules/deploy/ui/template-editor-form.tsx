"use client"

import React, { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Star,
  FloppyDisk,
  Trash,
  Code,
  ShieldCheck,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import type { AdminTemplateRecord } from "@/app/[lang]/portal/marketplace/_components/template-inspector-drawer"
import type { AppTemplateBlueprint } from "@/modules/deploy/blueprint/app-template-blueprint.schema"

export interface TemplateEditorFormProps {
  initialData?: AdminTemplateRecord | null
  isNew?: boolean
  onSave: (payload: Partial<AdminTemplateRecord>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onApprove?: (id: string) => Promise<void>
  onReject?: (id: string, notes: string) => Promise<void>
  onToggleFeatured?: (id: string) => Promise<void>
  isSaving?: boolean
}

export function TemplateEditorForm({
  initialData,
  isNew = false,
  onSave,
  onDelete,
  onApprove,
  onReject,
  onToggleFeatured,
  isSaving = false,
}: TemplateEditorFormProps) {
  const router = useRouter()
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang || "en"

  const [name, setName] = useState(initialData?.name || "")
  const [slug, setSlug] = useState(initialData?.slug || "")
  const [tagline, setTagline] = useState(initialData?.tagline || "")
  const [description, setDescription] = useState(initialData?.description || "")
  const [readmeMarkdown, setReadmeMarkdown] = useState(
    initialData?.readmeMarkdown || ""
  )
  const [iconUrl, setIconUrl] = useState(initialData?.iconUrl || "")
  const [category, setCategory] = useState(initialData?.category || "UTILITIES")
  const [visibility, setVisibility] = useState(
    initialData?.visibility || (isNew ? "PUBLIC" : "PRIVATE")
  )
  const [version, setVersion] = useState(initialData?.version || "1.0.0")
  const [isOfficial, setIsOfficial] = useState(initialData?.isOfficial ?? true)
  const [isFeatured, setIsFeatured] = useState(initialData?.isFeatured ?? false)
  const [priceMonthly, setPriceMonthly] = useState<string>(
    initialData?.priceMonthly?.toString() || ""
  )
  const [currency] = useState(initialData?.currency || "USD")

  // Raw Blueprint JSON Editor state
  const defaultBlueprint: AppTemplateBlueprint = {
    schemaVersion: "1.0.0",
    name: name || "Custom App",
    slug: slug || "custom-app",
    version: version || "1.0.0",
    image: "nginx:alpine",
    port: 80,
    runAsNonRoot: true,
    resources: {
      defaultCpu: 500,
      defaultMemory: 512,
    },
    dependencies: [],
    envSchema: [],
  }

  const [blueprintJsonStr, setBlueprintJsonStr] = useState(() => {
    return JSON.stringify(
      initialData?.blueprintJson || defaultBlueprint,
      null,
      2
    )
  })
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("general")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [rejectNotes, setRejectNotes] = useState("")
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  const handleSlugAutoFill = (val: string) => {
    setName(val)
    if (isNew && !slug) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
      )
    }
  }

  const handleJsonChange = (val: string) => {
    setBlueprintJsonStr(val)
    try {
      JSON.parse(val)
      setJsonError(null)
    } catch (e: unknown) {
      if (e instanceof Error) setJsonError(e.message)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    let parsedBlueprint: AppTemplateBlueprint
    try {
      parsedBlueprint = JSON.parse(blueprintJsonStr)
    } catch {
      toast.error("Invalid Blueprint JSON structure")
      setActiveTab("blueprint")
      return
    }

    if (!name.trim()) {
      toast.error("Template name is required")
      setActiveTab("general")
      return
    }
    if (!slug.trim()) {
      toast.error("Template slug is required")
      setActiveTab("general")
      return
    }

    const payload: Partial<AdminTemplateRecord> = {
      name: name.trim(),
      slug: slug.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      readmeMarkdown: readmeMarkdown.trim() || null,
      iconUrl: iconUrl.trim() || null,
      category,
      visibility,
      version: version.trim() || "1.0.0",
      blueprintJson: parsedBlueprint,
      isOfficial,
      isFeatured,
      priceMonthly: priceMonthly ? Number(priceMonthly) : undefined,
      currency,
    }

    try {
      await onSave(payload)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save template"
      toast.error(msg)
    }
  }

  const handleDelete = async () => {
    if (!initialData?.id || !onDelete) return
    try {
      await onDelete(initialData.id)
      router.push(`/${lang}/portal/app/templates`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete"
      toast.error(msg)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-1 flex-col gap-6 p-6 pt-0"
    >
      {/* Top Header / Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => router.push(`/${lang}/portal/app/templates`)}
            className="size-8"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">
                {isNew
                  ? "Create Marketplace Template"
                  : `Edit ${name || "Template"}`}
              </h1>
              {isOfficial && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <ShieldCheck className="size-3 text-emerald-500" />
                  Official
                </Badge>
              )}
              {isFeatured && (
                <Badge variant="default" className="gap-1 text-xs">
                  <Star className="size-3 fill-amber-400" />
                  Featured
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isNew
                ? "Author first-party stack or community blueprint with full configuration specs."
                : `ID: ${initialData?.id} · Version: ${version}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isNew && initialData?.id && (
            <>
              {initialData.visibility === "PENDING_REVIEW" && onApprove && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onApprove(initialData.id)}
                  className="gap-1 text-emerald-600 hover:text-emerald-700"
                >
                  <CheckCircle className="size-4" /> Approve
                </Button>
              )}
              {initialData.visibility === "PENDING_REVIEW" && onReject && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRejectDialog(true)}
                  className="gap-1 text-destructive hover:text-destructive"
                >
                  <XCircle className="size-4" /> Reject
                </Button>
              )}
              {onToggleFeatured && (
                <Button
                  type="button"
                  variant={isFeatured ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsFeatured(!isFeatured)
                    onToggleFeatured(initialData.id)
                  }}
                  className="gap-1 text-xs"
                >
                  <Star
                    className={`size-4 ${isFeatured ? "fill-amber-400" : ""}`}
                  />
                  {isFeatured ? "Featured" : "Feature"}
                </Button>
              )}
              {onDelete && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-1 text-destructive hover:bg-destructive/10"
                >
                  <Trash className="size-4" /> Delete
                </Button>
              )}
            </>
          )}

          <Button
            type="submit"
            disabled={isSaving}
            className="gap-1.5 bg-primary text-primary-foreground"
          >
            <FloppyDisk className="size-4" />
            {isSaving
              ? "Saving..."
              : isNew
                ? "Create Template"
                : "Save Changes"}
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="general">General Details</TabsTrigger>
          <TabsTrigger value="blueprint">
            Blueprint Specification (JSON)
          </TabsTrigger>
          <TabsTrigger value="documentation">Docs & Readme</TabsTrigger>
        </TabsList>

        {/* Tab 1: General Info */}
        <TabsContent value="general" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Identity & Presentation
                </CardTitle>
                <CardDescription>
                  Primary marketplace catalog listing info
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="template-name">Display Name *</Label>
                  <Input
                    id="template-name"
                    data-testid="template-name-input"
                    value={name}
                    onChange={(e) => handleSlugAutoFill(e.target.value)}
                    placeholder="e.g. n8n Automation"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="template-slug">URL Slug *</Label>
                  <Input
                    id="template-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. n8n"
                    className="font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="template-tagline">Tagline / Short Hook</Label>
                  <Input
                    id="template-tagline"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g. Fair-code workflow automation platform"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="template-desc">Description *</Label>
                  <Textarea
                    id="template-desc"
                    data-testid="template-desc-input"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed explanation of features and capabilities"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="template-icon">
                    Icon URL / SVG identifier
                  </Label>
                  <Input
                    id="template-icon"
                    value={iconUrl}
                    onChange={(e) => setIconUrl(e.target.value)}
                    placeholder="e.g. /app-hosting/icons/n8n.svg or https://..."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Governance & Classification
                </CardTitle>
                <CardDescription>
                  Category, visibility, and commercial terms
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="template-category">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger id="template-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AI">AI</SelectItem>
                        <SelectItem value="AUTOMATION">Automation</SelectItem>
                        <SelectItem value="CMS">CMS</SelectItem>
                        <SelectItem value="DATABASE">Database</SelectItem>
                        <SelectItem value="DEVELOPER_TOOLS">
                          Developer Tools
                        </SelectItem>
                        <SelectItem value="ANALYTICS">Analytics</SelectItem>
                        <SelectItem value="UTILITIES">Utilities</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="template-visibility">
                      Visibility Status
                    </Label>
                    <Select
                      value={visibility}
                      onValueChange={(
                        v:
                          | "PRIVATE"
                          | "PENDING_REVIEW"
                          | "PUBLIC"
                          | "REJECTED"
                          | "UNLISTED"
                      ) => setVisibility(v)}
                    >
                      <SelectTrigger id="template-visibility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PUBLIC">PUBLIC (Live)</SelectItem>
                        <SelectItem value="PENDING_REVIEW">
                          PENDING_REVIEW
                        </SelectItem>
                        <SelectItem value="PRIVATE">PRIVATE</SelectItem>
                        <SelectItem value="REJECTED">REJECTED</SelectItem>
                        <SelectItem value="UNLISTED">UNLISTED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="template-version">Release Version</Label>
                    <Input
                      id="template-version"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="1.0.0"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="template-price">
                      Monthly Price (Optional)
                    </Label>
                    <Input
                      id="template-price"
                      type="number"
                      value={priceMonthly}
                      onChange={(e) => setPriceMonthly(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">
                        Official Platform Template
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Verified and guaranteed first-party stack
                      </p>
                    </div>
                    <Switch
                      checked={isOfficial}
                      onCheckedChange={setIsOfficial}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">
                        Featured on Marketplace
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Highlight template on marketplace top showcase
                      </p>
                    </div>
                    <Switch
                      checked={isFeatured}
                      onCheckedChange={setIsFeatured}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Blueprint JSON */}
        <TabsContent value="blueprint" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Code className="size-4" /> Container Runtime & Blueprint
                  Schema
                </CardTitle>
                <CardDescription>
                  Define image, exposed ports, database dependencies, volumes,
                  and environment variables schema
                </CardDescription>
              </div>
              {jsonError ? (
                <Badge variant="destructive" className="text-xs">
                  Invalid JSON: {jsonError}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs text-emerald-600">
                  Valid JSON Schema
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <Textarea
                rows={18}
                value={blueprintJsonStr}
                onChange={(e) => handleJsonChange(e.target.value)}
                className="font-mono text-xs"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Documentation */}
        <TabsContent value="documentation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Template Documentation (Markdown)
              </CardTitle>
              <CardDescription>
                Full readme and deployment manual shown in template detail view
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={14}
                value={readmeMarkdown}
                onChange={(e) => setReadmeMarkdown(e.target.value)}
                placeholder="# Getting Started with this Stack..."
                className="font-mono text-xs"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete template &ldquo;{name}
              &rdquo;? Existing deployed stacks will not be disrupted, but this
              blueprint will be removed from marketplace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Note Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Template Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Provide clear feedback explaining why this template submission was
              rejected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              rows={3}
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="e.g. Container image runs as root user or invalid database prefix..."
              required
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (initialData?.id && onReject && rejectNotes.trim()) {
                  onReject(initialData.id, rejectNotes.trim())
                  setShowRejectDialog(false)
                }
              }}
              disabled={!rejectNotes.trim()}
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            >
              Confirm Rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
