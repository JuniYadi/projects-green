"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  useCreateTemplate,
  useTemplate,
} from "@/modules/whatsapp/templates/api/templates.hooks"
import type { TemplateFormInput } from "@/modules/whatsapp/templates/api/templates.hooks"
import { TemplateForm } from "@/modules/whatsapp/templates/ui/template-form"

export default function ConsoleNewTemplatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const duplicateId = searchParams.get("duplicate")

  const { template: sourceTemplate, loading: loadingSource } = useTemplate(
    duplicateId || ""
  )
  const { create, creating } = useCreateTemplate()

  const handleSubmit = async (data: {
    name: string
    slug: string
    description?: string
    category?: string
    languages: Array<{
      lang: string
      headerType: string
      headerText: string
      headerUrl: string
      body: string
      footer: string
      parameters?: unknown
      buttons?: unknown
    }>
  }) => {
    try {
      const template = await create(data as unknown as TemplateFormInput)
      toast.success("Template created successfully.")
      router.push(`./${template.id}`)
    } catch {
      toast.error("Failed to create template.")
    }
  }

  // Pre-fill initial data if duplicating
  const initialData = React.useMemo(() => {
    if (!sourceTemplate) return undefined

    return {
      name: `${sourceTemplate.name} Copy`,
      slug: `${sourceTemplate.slug}_copy`,
      description: sourceTemplate.description,
      category: sourceTemplate.category,
      languages: sourceTemplate.languages.map((l) => ({
        id: l.id,
        lang: l.lang,
        headerType: l.headerType ?? "NONE",
        headerText: l.headerText ?? "",
        headerUrl: l.headerUrl ?? "",
        body: l.body ?? "",
        footer: l.footer ?? "",
        parameters: l.parameters,
        buttons: l.buttons,
      })),
    }
  }, [sourceTemplate])

  if (duplicateId && loadingSource) {
    return (
      <div className="space-y-6">
        <p className="animate-pulse text-sm text-muted-foreground">
          Loading template to duplicate...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="w-fit px-0">
          <Link href="./">
            <ArrowLeft className="mr-1 size-4" />
            Back to Templates
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {duplicateId
            ? "Duplicate WhatsApp Template"
            : "Create WhatsApp Template"}
        </h1>
        <p className="text-muted-foreground">
          {duplicateId
            ? "Duplicating template with pre-filled content. Name and slug have been appended with '_copy'."
            : "Configure template details, variables, and verify live preview."}
        </p>
      </div>

      <TemplateForm
        initialData={initialData}
        submitting={creating}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
