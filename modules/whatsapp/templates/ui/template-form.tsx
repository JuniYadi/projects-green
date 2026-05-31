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
  id?: string
  lang: string
  headerType: string
  headerText: string
  body: string
  footer: string
}

type TemplateFormProps = {
  initialData?: {
    name: string
    slug: string
    description?: string | null
    languages?: LanguageVariant[]
  }
  submitting: boolean
  onSubmit: (data: {
    name: string
    slug: string
    description?: string
    languages: LanguageVariant[]
  }) => Promise<void>
}

const emptyVariant = (): LanguageVariant => ({
  id: crypto.randomUUID(),
  lang: "en",
  headerType: "NONE",
  headerText: "",
  body: "",
  footer: "",
})

export function TemplateForm({
  initialData,
  submitting,
  onSubmit,
}: TemplateFormProps) {
  const [name, setName] = React.useState(initialData?.name ?? "")
  const [slug, setSlug] = React.useState(initialData?.slug ?? "")
  const [description, setDescription] = React.useState(
    initialData?.description ?? "",
  )
  const [variants, setVariants] = React.useState<LanguageVariant[]>(
    initialData?.languages?.length
      ? initialData.languages.map((v) => ({
          ...v,
          id: v.id ?? crypto.randomUUID(),
        }))
      : [emptyVariant()],
  )
  const [errors, setErrors] = React.useState<
    Record<string, string | undefined>
  >({})

  const validate = (): boolean => {
    const newErrors: Record<string, string | undefined> = {}

    if (!name.trim()) newErrors.name = "Name is required."
    if (!slug.trim()) newErrors.slug = "Slug is required."
    if (variants.length === 0)
      newErrors.variants = "At least one language variant is required."

    for (let i = 0; i < variants.length; i++) {
      if (!variants[i].lang.trim())
        newErrors[`variant_${i}_lang`] = "Language code is required."
      if (!variants[i].body.trim())
        newErrors[`variant_${i}_body`] = "Body is required."
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

    await onSubmit({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
      languages: variants.map(({
        id: _id,
        ...rest
      }) => ({
        ...rest,
        headerText: rest.headerType === "NONE" ? "" : rest.headerText,
      })),
    })
  }

  const addVariant = () => {
    setVariants([...variants, emptyVariant()])
  }

  const removeVariant = (index: number) => {
    if (variants.length <= 1) return
    setVariants(variants.filter((_, i) => i !== index))
  }

  const updateVariant = (
    index: number,
    field: keyof LanguageVariant,
    value: string,
  ) => {
    setVariants(
      variants.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Core fields ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Welcome Message"
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
          />
          {errors.slug && (
            <p className="text-xs text-destructive">{errors.slug}</p>
          )}
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

        {variants.map((variant, i) => (
          <div key={variant.id ?? i} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Variant {i + 1}
              </span>
              {variants.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => removeVariant(i)}
                >
                  <X className="size-3" />
                </Button>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`variant-${i}-lang`}>Language</Label>
                <Select
                  value={variant.lang}
                  onValueChange={(v) => updateVariant(i, "lang", v)}
                >
                  <SelectTrigger id={`variant-${i}-lang`}>
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
                {errors[`variant_${i}_lang`] && (
                  <p className="text-xs text-destructive">
                    {errors[`variant_${i}_lang`]}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`variant-${i}-header`}>Header Type</Label>
                <Select
                  value={variant.headerType}
                  onValueChange={(v) => updateVariant(i, "headerType", v)}
                >
                  <SelectTrigger id={`variant-${i}-header`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="TEXT">Text</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {variant.headerType === "TEXT" && (
              <div className="grid gap-2">
                <Label htmlFor={`variant-${i}-header-text`}>
                  Header Text
                </Label>
                <Input
                  id={`variant-${i}-header-text`}
                  value={variant.headerText}
                  onChange={(e) =>
                    updateVariant(i, "headerText", e.target.value)
                  }
                  placeholder="Header text (max 60 chars)"
                  maxLength={60}
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor={`variant-${i}-body`}>
                Body <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id={`variant-${i}-body`}
                value={variant.body}
                onChange={(e) => updateVariant(i, "body", e.target.value)}
                placeholder="Template body text (max 1024 chars)"
                rows={3}
                maxLength={1024}
              />
              {errors[`variant_${i}_body`] && (
                <p className="text-xs text-destructive">
                  {errors[`variant_${i}_body`]}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`variant-${i}-footer`}>Footer</Label>
              <Input
                id={`variant-${i}-footer`}
                value={variant.footer}
                onChange={(e) => updateVariant(i, "footer", e.target.value)}
                placeholder="Footer text (max 60 chars)"
                maxLength={60}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Submit ──────────────────────────────────────────────────────── */}
      <Button type="submit" disabled={submitting} className="w-full md:w-auto">
        {submitting ? "Saving..." : "Save Template"}
      </Button>
    </form>
  )
}
