/**
 * Template Form — Reusable create/edit form component
 *
 * Fields: name, slug, description, device, language variants with body,
 * header type/url/text, footer, buttons.
 */

"use client"

import * as React from "react"
import { Plus, X } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

const emptyVariant = (): LanguageVariant => ({
  id: crypto.randomUUID(),
  lang: "en",
  headerType: "NONE",
  headerText: "",
  headerUrl: "",
  body: "",
  footer: "",
})

export function TemplateForm({
  initialData,
  submitting,
  onSubmit,
  mode = "create",
  approvedTemplateLocked = false,
  lockedVariantIds = [],
  structureTemplate = null,
}: TemplateFormProps) {
  const [name, setName] = React.useState(initialData?.name ?? "")
  const [slug, setSlug] = React.useState(initialData?.slug ?? "")
  const [description, setDescription] = React.useState(
    initialData?.description ?? ""
  )
  const [category, setCategory] = React.useState(
    initialData?.category ?? "UTILITY"
  )
  const [variants, setVariants] = React.useState<LanguageVariant[]>(
    initialData?.languages?.length
      ? initialData.languages.map((v) => ({
          ...v,
          id: v.id ?? crypto.randomUUID(),
          headerUrl: v.headerUrl ?? "",
        }))
      : [emptyVariant()]
  )
  const [errors, setErrors] = React.useState<
    Record<string, string | undefined>
  >({})

  const isLockedVariant = (variantId: string) =>
    approvedTemplateLocked && lockedVariantIds.includes(variantId)

  const validate = (): boolean => {
    const newErrors: Record<string, string | undefined> = {}

    if (!name.trim()) newErrors.name = "Name is required."
    if (!slug.trim()) newErrors.slug = "Slug is required."
    if (variants.length === 0)
      newErrors.variants = "At least one language variant is required."

    for (let i = 0; i < variants.length; i++) {
      if (!variants[i].lang.trim())
        newErrors[`variant_${variants[i].id}_lang`] =
          "Language code is required."
      if (!variants[i].body.trim())
        newErrors[`variant_${variants[i].id}_body`] = "Body is required."
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

    if (approvedTemplateLocked) {
      // Only submit new (non-locked) variants for approved locked templates
      const newVariants = variants.filter(
        (v) => !lockedVariantIds.includes(v.id)
      )
      await onSubmit({
        name: initialData!.name,
        slug: initialData!.slug,
        description: initialData!.description ?? undefined,
        category: initialData!.category ?? undefined,
        languages: newVariants.map((v) => {
          const base = {
            lang: v.lang,
            headerType: v.headerType,
            headerText: v.headerType === "NONE" ? "" : v.headerText,
            headerUrl: ["IMAGE", "VIDEO", "DOCUMENT"].includes(v.headerType)
              ? v.headerUrl
              : "",
            body: v.body,
            footer: v.footer,
          }
          if (v.parameters !== undefined) {
            return { ...base, parameters: v.parameters }
          }
          if (v.buttons !== undefined) {
            return { ...base, buttons: v.buttons }
          }
          return base
        }),
      })
      return
    }

    await onSubmit({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
      category: category,
      languages: variants.map((v) => {
        return {
          lang: v.lang,
          headerType: v.headerType,
          headerText: v.headerType === "NONE" ? "" : v.headerText,
          headerUrl: ["IMAGE", "VIDEO", "DOCUMENT"].includes(v.headerType)
            ? v.headerUrl
            : "",
          body: v.body,
          footer: v.footer,
        }
      }),
    })
  }

  const addVariant = () => {
    if (approvedTemplateLocked && structureTemplate) {
      setVariants([
        ...variants,
        {
          id: crypto.randomUUID(),
          lang: "en",
          headerType: structureTemplate.headerType ?? "NONE",
          headerText: structureTemplate.headerText ?? "",
          headerUrl: structureTemplate.headerUrl ?? "",
          body: structureTemplate.body ?? "",
          footer: structureTemplate.footer ?? "",
          parameters: structureTemplate.parameters,
          buttons: structureTemplate.buttons,
        },
      ])
    } else {
      setVariants([...variants, emptyVariant()])
    }
  }

  const removeVariant = (id: string) => {
    if (variants.length <= 1) return
    setVariants(variants.filter((v) => v.id !== id))
  }

  const updateVariant = (
    id: string,
    field: keyof LanguageVariant,
    value: string
  ) => {
    setVariants(
      variants.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Core fields ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Welcome Message"
            disabled={approvedTemplateLocked}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="slug">
            Slug <span className="text-destructive">*</span>
          </Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="welcome_message"
            disabled={approvedTemplateLocked}
          />
          {errors.slug && (
            <p className="text-xs text-destructive">{errors.slug}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="category">
            Category <span className="text-destructive">*</span>
          </Label>
          <Select
            value={category}
            onValueChange={setCategory}
            disabled={approvedTemplateLocked}
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MARKETING">Marketing</SelectItem>
              <SelectItem value="UTILITY">Utility</SelectItem>
              <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description of this template"
          rows={2}
          disabled={approvedTemplateLocked}
        />
      </div>

      {/* ── Language variants ───────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">
            Language Variants <span className="text-destructive">*</span>
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addVariant}
          >
            <Plus className="mr-1 size-3" />
            Add Variant
          </Button>
        </div>

        {errors.variants && (
          <p className="text-xs text-destructive">{errors.variants}</p>
        )}

        {variants.map((variant, i) => {
          const idx = i + 1
          const locked = isLockedVariant(variant.id)
          return (
            <div key={variant.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Variant {idx}</span>
                {variants.length > 1 && !locked && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => removeVariant(variant.id)}
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor={`variant-${variant.id}-lang`}>Language</Label>
                  <Select
                    value={variant.lang}
                    onValueChange={(v) => updateVariant(variant.id, "lang", v)}
                    disabled={locked}
                  >
                    <SelectTrigger id={`variant-${variant.id}-lang`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="id">Indonesian</SelectItem>
                      <SelectItem value="ms">Malay</SelectItem>
                      <SelectItem value="zh">Chinese</SelectItem>
                      <SelectItem value="ar">Arabic</SelectItem>
                      <SelectItem value="ja">Japanese</SelectItem>
                      <SelectItem value="ko">Korean</SelectItem>
                      <SelectItem value="th">Thai</SelectItem>
                      <SelectItem value="vi">Vietnamese</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors[`variant_${variant.id}_lang`] && (
                    <p className="text-xs text-destructive">
                      {errors[`variant_${variant.id}_lang`]}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={`variant-${variant.id}-header`}>
                    Header Type
                  </Label>
                  <Select
                    value={variant.headerType}
                    onValueChange={(v) =>
                      updateVariant(variant.id, "headerType", v)
                    }
                    disabled={locked}
                  >
                    <SelectTrigger id={`variant-${variant.id}-header`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      <SelectItem value="TEXT">Text</SelectItem>
                      <SelectItem value="IMAGE">Image</SelectItem>
                      <SelectItem value="VIDEO">Video</SelectItem>
                      <SelectItem value="DOCUMENT">Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {variant.headerType === "TEXT" && (
                <div className="grid gap-2">
                  <Label htmlFor={`variant-${variant.id}-header-text`}>
                    Header Text
                  </Label>
                  <Input
                    id={`variant-${variant.id}-header-text`}
                    value={variant.headerText}
                    onChange={(e) =>
                      updateVariant(variant.id, "headerText", e.target.value)
                    }
                    placeholder="Header text (max 60 chars)"
                    maxLength={60}
                    disabled={locked}
                  />
                </div>
              )}

              {["IMAGE", "VIDEO", "DOCUMENT"].includes(variant.headerType) && (
                <div className="grid gap-2">
                  <Label htmlFor={`variant-${variant.id}-header-url`}>
                    Header{" "}
                    {variant.headerType.charAt(0) +
                      variant.headerType.slice(1).toLowerCase()}{" "}
                    URL
                  </Label>
                  <Input
                    id={`variant-${variant.id}-header-url`}
                    value={variant.headerUrl}
                    onChange={(e) =>
                      updateVariant(variant.id, "headerUrl", e.target.value)
                    }
                    placeholder="https://example.com/media.jpg"
                    type="url"
                    disabled={locked}
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor={`variant-${variant.id}-body`}>
                  Body <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id={`variant-${variant.id}-body`}
                  value={variant.body}
                  onChange={(e) =>
                    updateVariant(variant.id, "body", e.target.value)
                  }
                  placeholder="Template body text (max 1024 chars)"
                  rows={3}
                  maxLength={1024}
                  disabled={locked}
                />
                {errors[`variant_${variant.id}_body`] && (
                  <p className="text-xs text-destructive">
                    {errors[`variant_${variant.id}_body`]}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`variant-${variant.id}-footer`}>Footer</Label>
                <Input
                  id={`variant-${variant.id}-footer`}
                  value={variant.footer}
                  onChange={(e) =>
                    updateVariant(variant.id, "footer", e.target.value)
                  }
                  placeholder="Footer text (max 60 chars)"
                  maxLength={60}
                  disabled={locked}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Submit ──────────────────────────────────────────────────────── */}
      <Button type="submit" disabled={submitting} className="w-full md:w-auto">
        {submitting ? "Saving..." : "Save Template"}
      </Button>
    </form>
  )
}
