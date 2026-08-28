"use client"

import React, { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { TemplateEditorForm } from "@/modules/deploy/ui/template-editor-form"
import { eden } from "@/lib/eden"
import type { AdminTemplateRecord } from "@/app/[lang]/portal/marketplace/_components/template-inspector-drawer"

export default function PortalNewAppTemplatePage() {
  const router = useRouter()
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang || "en"
  const [isSaving, setIsSaving] = useState(false)

  const handleCreate = async (payload: Partial<AdminTemplateRecord>) => {
    setIsSaving(true)
    try {
      const adminApi = eden.api.admin as unknown as {
        templates: {
          post: (
            body: unknown
          ) => Promise<{
            data?: AdminTemplateRecord
            error?: { value: unknown }
          }>
        }
      }
      const res = await adminApi.templates.post(payload)
      if (res.error) {
        throw new Error(
          typeof res.error.value === "string"
            ? res.error.value
            : "Failed to create template"
        )
      }
      if (res.data) {
        toast.success("Template created successfully!")
        router.push(`/${lang}/portal/app/templates`)
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create template"
      toast.error(msg)
      throw err
    } finally {
      setIsSaving(false)
    }
  }

  return <TemplateEditorForm isNew onSave={handleCreate} isSaving={isSaving} />
}
