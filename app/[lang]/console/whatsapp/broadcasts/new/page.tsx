"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  whatsappClient,
  type Device,
  type Template,
} from "@/modules/whatsapp/whatsapp-client"

function parseRecipients(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((phoneNumber) => phoneNumber.trim())
    .filter(Boolean)
    .map((phoneNumber) => ({ phoneNumber }))
}

export default function NewWhatsAppBroadcastPage() {
  const router = useRouter()
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const basePath = localizePathname({
    pathname: "/console/whatsapp/broadcasts",
    locale,
  })
  const [templates, setTemplates] = React.useState<Template[]>([])
  const [devices, setDevices] = React.useState<Device[]>([])
  const [templateId, setTemplateId] = React.useState("")
  const [templateLanguage, setTemplateLanguage] = React.useState("")
  const [deviceId, setDeviceId] = React.useState("")
  const [recipients, setRecipients] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    ;(async () => {
      try {
        const [templateItems, deviceItems] = await Promise.all([
          whatsappClient.listTemplates(),
          whatsappClient.listDevices(),
        ])
        setTemplates(templateItems)
        setDevices(deviceItems)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to load form data"
        )
      }
    })()
  }, [])

  const selectedTemplate = templates.find(
    (template) => template.id === templateId
  )
  const languages = React.useMemo(
    () => selectedTemplate?.languages ?? [],
    [selectedTemplate]
  )

  const handleTemplateChange = (value: string) => {
    setTemplateId(value)
    const template = templates.find((item) => item.id === value)
    setTemplateLanguage(template?.languages[0]?.lang ?? "")
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsedRecipients = parseRecipients(recipients)

    if (!selectedTemplate) {
      toast.error("Template is required")
      return
    }

    if (!templateLanguage) {
      toast.error("Template language is required")
      return
    }

    if (parsedRecipients.length === 0) {
      toast.error("At least one recipient is required")
      return
    }

    setIsSubmitting(true)
    try {
      const broadcast = await whatsappClient.createBroadcast({
        templateName: selectedTemplate.name,
        templateLanguage,
        whatsappDeviceId: deviceId || selectedTemplate.whatsappDeviceId,
        recipients: parsedRecipients,
      })
      toast.success("Broadcast created")
      router.push(`${basePath}/${broadcast.id}`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create broadcast"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New broadcast</h1>
        <p className="text-muted-foreground">
          Create a WhatsApp template campaign for a list of recipients.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign details</CardTitle>
          <CardDescription>
            Select an approved template, sending device, and recipient phone
            numbers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="grid gap-2">
              <Label htmlFor="template">Template</Label>
              <Select value={templateId} onValueChange={handleTemplateChange}>
                <SelectTrigger id="template">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="language">Language</Label>
              <Select
                value={templateLanguage}
                onValueChange={setTemplateLanguage}
              >
                <SelectTrigger id="language">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((language) => (
                    <SelectItem key={language.id} value={language.lang}>
                      {language.lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="device">Device</Label>
              <Select value={deviceId} onValueChange={setDeviceId}>
                <SelectTrigger id="device">
                  <SelectValue placeholder="Use template default device" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.phoneNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="recipients">Recipients</Label>
              <Textarea
                id="recipients"
                rows={8}
                value={recipients}
                onChange={(event) => setRecipients(event.target.value)}
                placeholder="6281234567890\n6289876543210"
              />
              <p className="text-xs text-muted-foreground">
                Enter one phone number per line or comma-separated.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(basePath)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating…" : "Create broadcast"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
