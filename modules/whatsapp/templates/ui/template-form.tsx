/**
 * Template Form — Reusable create/edit form component
 *
 * Side-by-side interactive WhatsApp Template Builder:
 * - Left Panel: General config, auto-slug, language selector, header, body with auto-detected {{N}} sample variables, footer, dynamic buttons.
 * - Right Panel: Sticky WhatsApp chat bubble preview with real-time variable resolution + Clean internal JSON configuration inspector.
 * - Strict Meta anti-rejection rules (sequential variables, boundary checks, slug sanitization).
 */

"use client"

import * as React from "react"
import {
  Plus,
  Trash,
  WarningCircle,
  Code,
  Eye,
  Sparkle,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  formatTemplateSlug,
  validateTemplateBodyRules,
} from "../template-validator"
import {
  WhatsAppTemplatePreview,
  getLanguageDisplay,
  getTemplatePlaceholderIndexes,
} from "./template-preview"
import { StorageDropzone } from "@/modules/storage/ui/storage-dropzone"
import type { WhatsAppTemplateLanguage } from "@/lib/api/whatsapp-client"

export type TemplateButton =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; example?: string[] }
  | { type: "PHONE_NUMBER"; text: string; phoneNumber: string }
  | { type: "OTP"; otpType: "COPY_CODE" }

export type LanguageVariant = {
  id: string
  lang: string
  headerType: string
  headerText: string
  headerUrl: string
  body: string
  footer: string
  parameters?: unknown
  buttons?: unknown
}

type TemplateFormProps = {
  initialData?: {
    name: string
    slug: string
    description?: string | null
    category?: string | null
    languages?: Array<
      LanguageVariant & { parameters?: unknown; buttons?: unknown }
    >
  }
  submitting: boolean
  onSubmit: (data: {
    name: string
    slug: string
    description?: string
    category?: string
    languages: Omit<LanguageVariant, "id">[]
  }) => Promise<void>
  mode?: "create" | "edit"
  approvedTemplateLocked?: boolean
  lockedVariantIds?: string[]
  structureTemplate?: Pick<
    LanguageVariant,
    | "headerType"
    | "headerText"
    | "headerUrl"
    | "body"
    | "footer"
    | "parameters"
    | "buttons"
  > | null
}

const SUPPORTED_LANGUAGES = [
  { code: "id", label: "Indonesian", flag: "🇮🇩" },
  { code: "en", label: "English (US)", flag: "🇺🇸" },
  { code: "en_GB", label: "English (UK)", flag: "🇬🇧" },
  { code: "ms", label: "Malay", flag: "🇲🇾" },
  { code: "th", label: "Thai", flag: "🇹🇭" },
  { code: "vi", label: "Vietnamese", flag: "🇻🇳" },
  { code: "fil", label: "Filipino", flag: "🇵🇭" },
  { code: "zh_CN", label: "Chinese (Simplified)", flag: "🇨🇳" },
]

export function TemplateForm({
  initialData,
  submitting,
  onSubmit,
  approvedTemplateLocked = false,
}: TemplateFormProps) {
  const initialLang = initialData?.languages?.[0]

  const [name, setName] = React.useState(initialData?.name ?? "")
  const [slug, setSlug] = React.useState(initialData?.slug ?? "")
  const [slugManuallyEdited, setSlugManuallyEdited] = React.useState(
    Boolean(initialData?.slug)
  )
  const [description, setDescription] = React.useState(
    initialData?.description ?? ""
  )
  const [category, setCategory] = React.useState(
    initialData?.category ?? "UTILITY"
  )

  // Primary language variant state
  const [lang, setLang] = React.useState(initialLang?.lang ?? "id")
  const [headerType, setHeaderType] = React.useState(
    initialLang?.headerType ?? "NONE"
  )
  const [headerText, setHeaderText] = React.useState(
    initialLang?.headerText ?? ""
  )
  const [headerUrl, setHeaderUrl] = React.useState(initialLang?.headerUrl ?? "")
  const [body, setBody] = React.useState(initialLang?.body ?? "")
  const [footer, setFooter] = React.useState(initialLang?.footer ?? "")

  // Dynamic variable sample dictionary: { 1: "John", 2: "ORD-123" }
  const [sampleValues, setSampleValues] = React.useState<
    Record<number, string>
  >({})

  // Buttons state
  const [buttons, setButtons] = React.useState<TemplateButton[]>(() => {
    if (Array.isArray(initialLang?.buttons)) {
      return initialLang.buttons as TemplateButton[]
    }
    return []
  })

  // Preview tab state (visual bubble vs clean configuration JSON)
  const [previewTab, setPreviewTab] = React.useState<"visual" | "json">(
    "visual"
  )

  const [errors, setErrors] = React.useState<
    Record<string, string | undefined>
  >({})

  // Auto-slugify when name changes unless user typed custom slug
  const handleNameChange = (val: string) => {
    setName(val)
    if (!slugManuallyEdited && !approvedTemplateLocked) {
      setSlug(formatTemplateSlug(val))
    }
  }

  // Detect {{N}} in body and sync sample inputs
  const detectedPlaceholders = React.useMemo(
    () => getTemplatePlaceholderIndexes(body),
    [body]
  )

  // Body rule validation (boundary & sequential)
  const bodyValidation = React.useMemo(
    () => validateTemplateBodyRules(body),
    [body]
  )

  const handleSampleChange = (index: number, val: string) => {
    setSampleValues((prev) => ({ ...prev, [index]: val }))
  }

  // Button management
  const addButton = (type: TemplateButton["type"]) => {
    if (buttons.length >= 3) {
      toast.error("Maximum 3 buttons allowed for standard templates.")
      return
    }
    if (type === "QUICK_REPLY") {
      setButtons([...buttons, { type: "QUICK_REPLY", text: "Quick Action" }])
    } else if (type === "URL") {
      setButtons([
        ...buttons,
        { type: "URL", text: "Visit Website", url: "https://example.com" },
      ])
    } else if (type === "PHONE_NUMBER") {
      setButtons([
        ...buttons,
        {
          type: "PHONE_NUMBER",
          text: "Call Support",
          phoneNumber: "+6281234567890",
        },
      ])
    } else if (type === "OTP") {
      setButtons([...buttons, { type: "OTP", otpType: "COPY_CODE" }])
    }
  }

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index))
  }

  const updateButton = (index: number, patch: Partial<TemplateButton>) => {
    setButtons(
      buttons.map((b, i) =>
        i === index ? ({ ...b, ...patch } as TemplateButton) : b
      )
    )
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string | undefined> = {}

    if (!name.trim()) newErrors.name = "Name is required."
    if (!slug.trim()) newErrors.slug = "Slug is required."
    if (!body.trim()) newErrors.body = "Body text is required."

    if (!bodyValidation.isValid && bodyValidation.errors.length > 0) {
      newErrors.body = bodyValidation.errors[0]
    }

    if (headerType === "TEXT" && !headerText.trim()) {
      newErrors.headerText =
        "Header text is required when TEXT header is chosen."
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      toast.error("Please fix the highlighted fields.")
      return
    }

    // Build parameter samples
    const parameters = detectedPlaceholders.map((idx) => ({
      type: "BODY" as const,
      text: sampleValues[idx]?.trim() || `Sample ${idx}`,
    }))

    const languagePayload = {
      lang,
      headerType,
      headerText: headerType === "TEXT" ? headerText.trim() : "",
      headerUrl: ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType)
        ? headerUrl.trim()
        : "",
      body: body.trim(),
      footer: footer.trim(),
      parameters: parameters.length > 0 ? parameters : undefined,
      buttons: buttons.length > 0 ? buttons : undefined,
    }

    await onSubmit({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
      category,
      languages: [languagePayload],
    })
  }

  // Construct preview language object for live preview component
  const previewLanguage: WhatsAppTemplateLanguage = {
    id: "preview-temp",
    lang,
    headerType: headerType === "NONE" ? null : headerType,
    headerText: headerType === "TEXT" ? headerText : null,
    headerUrl: headerUrl || null,
    body,
    footer: footer || null,
    parameters: detectedPlaceholders.map((idx) => ({
      type: "BODY",
      text: sampleValues[idx] || `Sample ${idx}`,
    })),
    buttons: buttons.length > 0 ? buttons : null,
  }

  // Application JSON Configuration representation (NOT Meta payload)
  const configJson = JSON.stringify(
    {
      name: name.trim() || "template_name",
      slug: slug.trim() || "template_slug",
      category,
      description: description.trim() || undefined,
      languages: [
        {
          lang,
          headerType,
          headerText: headerType === "TEXT" ? headerText : undefined,
          headerUrl:
            ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType) && headerUrl
              ? headerUrl
              : undefined,
          body,
          footer: footer || undefined,
          parameters: detectedPlaceholders.map((idx) => ({
            index: idx,
            sample: sampleValues[idx] || `Sample ${idx}`,
          })),
          buttons: buttons.length > 0 ? buttons : undefined,
        },
      ],
    },
    null,
    2
  )

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* ── LEFT PANEL: Form Builder (7 cols) ────────────────────────── */}
        <div className="space-y-6 lg:col-span-7">
          {/* General Configuration */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                1. General Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Template Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Order Status Update"
                    disabled={approvedTemplateLocked}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">
                    Template Slug / Code{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => {
                      setSlugManuallyEdited(true)
                      setSlug(formatTemplateSlug(e.target.value))
                    }}
                    placeholder="order_status_update"
                    disabled={approvedTemplateLocked}
                    className="font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Lowercase letters, numbers, and underscores only.
                  </p>
                  {errors.slug && (
                    <p className="text-xs text-destructive">{errors.slug}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={category}
                    onValueChange={setCategory}
                    disabled={approvedTemplateLocked}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTILITY">Utility</SelectItem>
                      <SelectItem value="MARKETING">Marketing</SelectItem>
                      <SelectItem value="AUTHENTICATION">
                        Authentication
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lang">Language</Label>
                  <Select
                    value={lang}
                    onValueChange={setLang}
                    disabled={approvedTemplateLocked}
                  >
                    <SelectTrigger id="lang">
                      <SelectValue placeholder="Select Language" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map((l) => (
                        <SelectItem key={l.code} value={l.code}>
                          <span className="mr-2">{l.flag}</span>
                          {l.label} ({l.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Internal notes about when this template is sent"
                />
              </div>
            </CardContent>
          </Card>

          {/* Header Configuration */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                2. Header (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Header Type</Label>
                <div className="flex flex-wrap gap-2">
                  {(
                    ["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"] as const
                  ).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant={headerType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setHeaderType(type)}
                    >
                      {type === "NONE" ? "None" : type}
                    </Button>
                  ))}
                </div>
              </div>

              {headerType === "TEXT" && (
                <div className="space-y-2">
                  <Label htmlFor="headerText">
                    Header Text <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="headerText"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    maxLength={60}
                    placeholder="e.g. Order Confirmation"
                  />
                  {errors.headerText && (
                    <p className="text-xs text-destructive">
                      {errors.headerText}
                    </p>
                  )}
                </div>
              )}

              {["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType) && (
                <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
                  <div className="space-y-1">
                    <Label>Sample Media Asset</Label>
                    <p className="text-xs text-muted-foreground">
                      Upload a local {headerType.toLowerCase()} or provide a
                      sample URL for Meta template approval.
                    </p>
                  </div>
                  <StorageDropzone
                    mediaType={headerType as "IMAGE" | "VIDEO" | "DOCUMENT"}
                    accept={
                      headerType === "IMAGE"
                        ? "image/png,image/jpeg,image/webp"
                        : headerType === "VIDEO"
                          ? "video/mp4,video/3gpp"
                          : "application/pdf"
                    }
                    maxSizeBytes={
                      headerType === "IMAGE"
                        ? 5 * 1024 * 1024
                        : headerType === "VIDEO"
                          ? 16 * 1024 * 1024
                          : 100 * 1024 * 1024
                    }
                    value={headerUrl}
                    onUploadSuccess={(res) => {
                      setHeaderUrl(res.url || res.fileId)
                      toast.success(`${headerType} uploaded successfully`)
                    }}
                    onClear={() => setHeaderUrl("")}
                  />
                  <div className="pt-1">
                    <Label
                      htmlFor="headerUrl"
                      className="text-[11px] text-muted-foreground"
                    >
                      Or manual direct URL:
                    </Label>
                    <Input
                      id="headerUrl"
                      value={headerUrl}
                      onChange={(e) => setHeaderUrl(e.target.value)}
                      placeholder={`https://example.com/sample-${headerType.toLowerCase()}.${headerType === "IMAGE" ? "jpg" : headerType === "VIDEO" ? "mp4" : "pdf"}`}
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Body & Dynamic Placeholders */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                3. Body & Dynamic Placeholders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="body">
                    Body Text <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {body.length} / 1024
                  </span>
                </div>
                <Textarea
                  id="body"
                  rows={5}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={1024}
                  placeholder="Halo {{1}}, pesanan Anda {{2}} telah dikirim via {{3}}. Terima kasih telah berbelanja!"
                />
                {errors.body && (
                  <p className="text-xs text-destructive">{errors.body}</p>
                )}

                {/* Validation Warnings */}
                {bodyValidation.warnings.map((w, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 rounded-md bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400"
                  >
                    <WarningCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>

              {/* Detected Placeholders Sample Inputs */}
              {detectedPlaceholders.length > 0 && (
                <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
                  <div className="flex items-center gap-2">
                    <Sparkle className="size-4 text-primary" />
                    <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Dynamic Variable Samples ({detectedPlaceholders.length})
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {detectedPlaceholders.map((idx) => (
                      <div key={idx} className="space-y-1.5">
                        <Label
                          htmlFor={`sample-${idx}`}
                          className="font-mono text-xs"
                        >
                          Placeholder {`{{${idx}}}`} Sample
                        </Label>
                        <Input
                          id={`sample-${idx}`}
                          size={1}
                          value={sampleValues[idx] ?? ""}
                          onChange={(e) =>
                            handleSampleChange(idx, e.target.value)
                          }
                          placeholder={`e.g. John Doe`}
                          className="text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer Configuration */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                4. Footer (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="footer">Footer Text</Label>
              <Input
                id="footer"
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                maxLength={60}
                placeholder="e.g. PT Perusahaan Maju Jaya"
              />
              <p className="text-xs text-muted-foreground">
                Small disclaimer text displayed below message body (max 60
                chars).
              </p>
            </CardContent>
          </Card>

          {/* Interactive Buttons */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  5. Buttons (Optional - Max 3)
                </CardTitle>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addButton("QUICK_REPLY")}
                    disabled={buttons.length >= 3}
                  >
                    <Plus className="mr-1 size-3.5" /> Quick Reply
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addButton("URL")}
                    disabled={buttons.length >= 3}
                  >
                    <Plus className="mr-1 size-3.5" /> URL CTA
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addButton("PHONE_NUMBER")}
                    disabled={buttons.length >= 3}
                  >
                    <Plus className="mr-1 size-3.5" /> Phone
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {buttons.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No interactive buttons added.
                </p>
              ) : (
                buttons.map((btn, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <Badge variant="outline" className="text-xs">
                      {btn.type}
                    </Badge>
                    <div className="flex-1 space-y-2">
                      <Input
                        value={"text" in btn ? btn.text : ""}
                        onChange={(e) =>
                          updateButton(i, { text: e.target.value })
                        }
                        placeholder="Button Text"
                        className="text-xs"
                      />
                      {btn.type === "URL" && (
                        <Input
                          value={btn.url}
                          onChange={(e) =>
                            updateButton(i, { url: e.target.value })
                          }
                          placeholder="https://example.com/track"
                          className="font-mono text-xs"
                        />
                      )}
                      {btn.type === "PHONE_NUMBER" && (
                        <Input
                          value={btn.phoneNumber}
                          onChange={(e) =>
                            updateButton(i, { phoneNumber: e.target.value })
                          }
                          placeholder="+6281234567890"
                          className="font-mono text-xs"
                        />
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => removeButton(i)}
                    >
                      <Trash className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating Template..." : "Save Template"}
            </Button>
          </div>
        </div>

        {/* ── RIGHT PANEL: Sticky WhatsApp Preview (5 cols) ─────────── */}
        <div className="lg:col-span-5">
          <div className="sticky top-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Template Preview
              </h2>
              <div className="flex rounded-md border p-0.5">
                <Button
                  type="button"
                  variant={previewTab === "visual" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setPreviewTab("visual")}
                >
                  <Eye className="mr-1 size-3.5" /> Bubble
                </Button>
                <Button
                  type="button"
                  variant={previewTab === "json" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setPreviewTab("json")}
                >
                  <Code className="mr-1 size-3.5" /> Config JSON
                </Button>
              </div>
            </div>

            {previewTab === "visual" ? (
              <div className="rounded-2xl border bg-gradient-to-b from-muted/50 to-muted/20 p-5 shadow-sm">
                {/* Device Header Bar */}
                <div className="mb-4 flex items-center justify-between border-b pb-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 font-medium">
                    {getLanguageDisplay(lang).flag && (
                      <span className="text-sm">
                        {getLanguageDisplay(lang).flag}
                      </span>
                    )}
                    <span>{getLanguageDisplay(lang).label}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {category}
                    </Badge>
                  </div>
                  <span className="font-mono text-[11px]">
                    {slug || "slug"}
                  </span>
                </div>

                {/* WhatsApp Chat Bubble */}
                <WhatsAppTemplatePreview
                  language={previewLanguage}
                  values={sampleValues}
                />
              </div>
            ) : (
              <div className="rounded-2xl border bg-muted/40 p-4">
                <pre className="max-h-[500px] overflow-auto font-mono text-xs leading-relaxed text-foreground">
                  {configJson}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
