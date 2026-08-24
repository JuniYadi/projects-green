"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, WarningCircle, DeviceMobile } from "@phosphor-icons/react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { useCreateTemplate } from "@/modules/whatsapp/templates/api/templates.hooks"
import type { TemplateFormInput } from "@/modules/whatsapp/templates/api/templates.hooks"
import { TemplateForm } from "@/modules/whatsapp/templates/ui/template-form"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"

export default function PortalNewTemplatePage() {
  const router = useRouter()
  const { create, creating } = useCreateTemplate()
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
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
          setDevices(body.devices)
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

  const activeDevices = React.useMemo(
    () => devices.filter((d) => d.status === "ACTIVE"),
    [devices]
  )

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
          Create Template
        </h1>
        <p className="text-muted-foreground">
          Create a new WhatsApp message template
        </p>
      </div>

      {loadingDevices ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : activeDevices.length === 0 ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader>
            <div className="flex items-center gap-2 text-warning">
              <WarningCircle className="size-5" />
              <CardTitle className="text-base font-semibold">
                Active WhatsApp Device Required
              </CardTitle>
            </div>
            <CardDescription>
              You need at least one active WhatsApp device with a valid subscription before you can create message templates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm">
              <Link href="../devices">
                <DeviceMobile className="mr-1.5 size-4" />
                Go to Devices
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
            <CardDescription>
              Fill in the template details and language variants
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TemplateForm
              devices={devices}
              submitting={creating}
              onSubmit={handleSubmit}
            />
          </CardContent>
        </Card>
      )}
    </main>
  )
}
