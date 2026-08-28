"use client"

import React, { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { TemplateEditorForm } from "@/modules/deploy/ui/template-editor-form"
import { eden } from "@/lib/eden"
import type { AdminTemplateRecord } from "@/app/[lang]/portal/marketplace/_components/template-inspector-drawer"
import { Spinner } from "@phosphor-icons/react"

export default function PortalEditAppTemplatePage() {
  const router = useRouter()
  const params = useParams<{ lang?: string; id?: string }>()
  const id = params?.id as string
  const lang = params?.lang || "en"

  const [template, setTemplate] = useState<AdminTemplateRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let isCancelled = false
    async function loadTemplate() {
      if (!id) return
      setIsLoading(true)
      try {
        const adminApi = eden.api.admin as unknown as {
          templates: Record<
            string,
            {
              get: () => Promise<{
                data?: AdminTemplateRecord
                error?: unknown
              }>
            }
          >
        }
        const res = await adminApi.templates[id]?.get()
        if (res?.data && !isCancelled) {
          setTemplate(res.data)
        }
      } catch (err) {
        console.error("Failed to load template", err)
        toast.error("Failed to load template")
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }
    loadTemplate()
    return () => {
      isCancelled = true
    }
  }, [id])

  const handleUpdate = async (payload: Partial<AdminTemplateRecord>) => {
    if (!id) return
    setIsSaving(true)
    try {
      const adminApi = eden.api.admin as unknown as {
        templates: Record<
          string,
          {
            put: (
              body: unknown
            ) => Promise<{ data?: AdminTemplateRecord; error?: unknown }>
          }
        >
      }
      const res = await adminApi.templates[id]?.put(payload)
      if (res?.data) {
        setTemplate(res.data)
        toast.success("Template saved successfully!")
      }
    } catch (err) {
      console.error("Failed to update template", err)
      toast.error("Failed to update template")
      throw err
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (templateId: string) => {
    const adminApi = eden.api.admin as unknown as {
      templates: Record<string, { delete: () => Promise<{ data?: unknown }> }>
    }
    await adminApi.templates[templateId]?.delete()
    toast.success("Template deleted")
  }

  const handleApprove = async (templateId: string) => {
    const adminApi = eden.api.admin as unknown as {
      templates: Record<
        string,
        { approve: { post: () => Promise<{ data?: AdminTemplateRecord }> } }
      >
    }
    const res = await adminApi.templates[templateId]?.approve.post()
    if (res?.data) {
      setTemplate(res.data)
      toast.success("Template approved and published to Live Marketplace")
    }
  }

  const handleReject = async (templateId: string, notes: string) => {
    const adminApi = eden.api.admin as unknown as {
      templates: Record<
        string,
        {
          reject: {
            post: (b: {
              reviewNotes: string
            }) => Promise<{ data?: AdminTemplateRecord }>
          }
        }
      >
    }
    const res = await adminApi.templates[templateId]?.reject.post({
      reviewNotes: notes,
    })
    if (res?.data) {
      setTemplate(res.data)
      toast.error("Template marked as rejected")
    }
  }

  const handleToggleFeatured = async (templateId: string) => {
    const adminApi = eden.api.admin as unknown as {
      templates: Record<
        string,
        {
          "toggle-featured": {
            post: () => Promise<{ data?: AdminTemplateRecord }>
          }
        }
      >
    }
    const res = await adminApi.templates[templateId]?.["toggle-featured"].post()
    if (res?.data) {
      setTemplate(res.data)
      toast.success(
        res.data.isFeatured
          ? "Template marked as Featured on Marketplace"
          : "Template removed from Featured list"
      )
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <Spinner className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Loading template editor...
        </p>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <p className="text-sm text-destructive">Template not found.</p>
        <button
          type="button"
          onClick={() => router.push(`/${lang}/portal/app/templates`)}
          className="text-xs text-primary underline"
        >
          Back to templates
        </button>
      </div>
    )
  }

  return (
    <TemplateEditorForm
      initialData={template}
      onSave={handleUpdate}
      onDelete={handleDelete}
      onApprove={handleApprove}
      onReject={handleReject}
      onToggleFeatured={handleToggleFeatured}
      isSaving={isSaving}
    />
  )
}
