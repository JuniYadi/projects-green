"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, WarningCircle } from "@phosphor-icons/react"
import { toast } from "sonner"
import { eden } from "@/lib/eden"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  useCreateTemplate,
  useTemplate,
} from "@/modules/whatsapp/templates/api/templates.hooks"
import type { TemplateFormInput } from "@/modules/whatsapp/templates/api/templates.hooks"
import { TemplateForm } from "@/modules/whatsapp/templates/ui/template-form"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"

export default function PortalNewTemplatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const duplicateId = searchParams.get("duplicate")

  const { template: sourceTemplate, loading: loadingSource } = useTemplate(
    duplicateId ?? ""
  )
  const { create, creating } = useCreateTemplate()
  const [activeDevices, setActiveDevices] = React.useState<DeviceListItem[]>([])
  const [loadingDevices, setLoadingDevices] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function fetchDevices() {
      try {
        const res = await eden.api.whatsapp.devices.get()
        const body = res.data as unknown as {
          ok: boolean
          devices?: DeviceListItem[]
        }
        if (!cancelled && body?.ok && Array.isArray(body.devices)) {
          setActiveDevices(body.devices.filter((d) => d.status === "ACTIVE"))
        }
      } catch {
        // Fallback
      } finally {
        if (!cancelled) setLoadingDevices(false)
      }
    }
    void fetchDevices()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (data: {
    name: string
    slug: string
    description?: string
    category?: string
    whatsappDeviceId?: string
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
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <p className="animate-pulse text-sm text-muted-foreground">
          Loading template to duplicate...
        </p>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div>
        <Button asChild variant="ghost" size="sm" className="w-fit px-0">
          <Link href="./">
            <ArrowLeft className="mr-1 size-4" />
            Back to Templates
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {duplicateId ? "Duplicate Template" : "Create Template"}
        </h1>
        <p className="text-muted-foreground">
          {duplicateId
            ? "Create a new template based on an existing one."
            : "Create a new WhatsApp message template."}
        </p>
      </div>

      {!loadingDevices && activeDevices.length === 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-4">
            <WarningCircle className="text-warning size-5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                No Active WhatsApp Devices
              </p>
              <p className="text-muted-foreground">
                You need at least one active WhatsApp device to create
                templates.{" "}
                <Link
                  href="/portal/whatsapp/devices/new"
                  className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  Connect a device
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
          <CardDescription>
            Configure the template name, category, and language variants.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateForm
            initialData={initialData}
            submitting={creating}
            onSubmit={handleSubmit}
            mode="create"
            devices={activeDevices.map((d) => ({
              id: d.id,
              phoneNumber: d.phoneNumber,
              name: d.name ?? undefined,
            }))}
          />
        </CardContent>
      </Card>
    </main>
  )
}
