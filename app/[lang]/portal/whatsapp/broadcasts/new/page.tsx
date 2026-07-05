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
import { Checkbox } from "@/components/ui/checkbox"
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
  type Contact,
  type Device,
  type Template,
} from "@/modules/whatsapp/whatsapp-client"

type RecipientSource = "contacts" | "manual"

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
    pathname: "/portal/whatsapp/broadcasts",
    locale,
  })
  const [templates, setTemplates] = React.useState<Template[]>([])
  const [devices, setDevices] = React.useState<Device[]>([])
  const [contacts, setContacts] = React.useState<Contact[]>([])
  const [templateId, setTemplateId] = React.useState("")
  const [templateLanguage, setTemplateLanguage] = React.useState("")
  const [deviceId, setDeviceId] = React.useState("")
  const [recipientSource, setRecipientSource] =
    React.useState<RecipientSource>("manual")
  const [selectedContactIds, setSelectedContactIds] = React.useState<Set<string>>(new Set())
  const [manualRecipients, setManualRecipients] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    ;(async () => {
      try {
        const [templateItems, deviceItems, contactItems] = await Promise.all([
          whatsappClient.listTemplates(),
          whatsappClient.listDevices(),
          whatsappClient.listContacts(),
        ])
        setTemplates(templateItems)
        setDevices(deviceItems)
        setContacts(contactItems)
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

  const selectedContactPhones = React.useMemo(() => {
    return contacts
      .filter((c) => selectedContactIds.has(c.id))
      .map((c) => c.phoneNumber)
  }, [contacts, selectedContactIds])

  const allContactsSelected = contacts.length > 0 && selectedContactIds.size === contacts.length

  function toggleContact(id: string) {
    setSelectedContactIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleAllContacts() {
    if (allContactsSelected) {
      setSelectedContactIds(new Set())
    } else {
      setSelectedContactIds(new Set(contacts.map((c) => c.id)))
    }
  }

  const handleTemplateChange = (value: string) => {
    setTemplateId(value)
    const template = templates.find((item) => item.id === value)
    setTemplateLanguage(template?.languages[0]?.lang ?? "")
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const manualPhoneNumbers = parseRecipients(manualRecipients)
    const contactPhoneNumbers = selectedContactPhones.map((phoneNumber) => ({
      phoneNumber,
    }))
    const allRecipients = [...contactPhoneNumbers, ...manualPhoneNumbers]

    if (!selectedTemplate) {
      toast.error("Template is required")
      return
    }

    if (!templateLanguage) {
      toast.error("Template language is required")
      return
    }

    if (allRecipients.length === 0) {
      toast.error("At least one recipient is required")
      return
    }

    setIsSubmitting(true)
    try {
      const broadcast = await whatsappClient.createBroadcast({
        templateName: selectedTemplate.name,
        templateLanguage,
        whatsappDeviceId: deviceId || selectedTemplate.whatsappDeviceId,
        recipients: allRecipients,
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
              <Label htmlFor="recipient-source">Recipient source</Label>
              <Select
                value={recipientSource}
                onValueChange={(value) =>
                  setRecipientSource(value as RecipientSource)
                }
              >
                <SelectTrigger id="recipient-source">
                  <SelectValue placeholder="Select recipient source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contacts">From contacts</SelectItem>
                  <SelectItem value="manual">Manual entry</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {recipientSource === "contacts" && (
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Select contacts{" "}
                    {selectedContactIds.size > 0 && (
                      <span className="text-muted-foreground font-normal">
                        ({selectedContactIds.size} selected)
                      </span>
                    )}
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleAllContacts}
                    className="h-auto p-0 text-xs"
                  >
                    {allContactsSelected ? "Deselect all" : "Select all"}
                  </Button>
                </div>
                <div className="rounded-md border max-h-64 overflow-y-auto">
                  {contacts.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No contacts available.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {contacts.map((contact) => (
                        <label
                          key={contact.id}
                          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={selectedContactIds.has(contact.id)}
                            onCheckedChange={() => toggleContact(contact.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {contact.name || "Unnamed contact"}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {contact.phoneNumber}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {selectedContactIds.size > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedContactIds.size} contact
                    {selectedContactIds.size !== 1 ? "s" : ""} selected from
                    contacts
                  </p>
                )}
              </div>
            )}

            {recipientSource === "manual" && (
              <div className="grid gap-2">
                <Label htmlFor="recipients">Phone numbers</Label>
                <Textarea
                  id="recipients"
                  rows={8}
                  value={manualRecipients}
                  onChange={(event) => setManualRecipients(event.target.value)}
                  placeholder="6281234567890\n6289876543210"
                />
                <p className="text-xs text-muted-foreground">
                  Enter one phone number per line or comma-separated.
                </p>
              </div>
            )}

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
