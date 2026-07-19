"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
  type DeviceBroadcastCapacity,
  type BroadcastScheduleRecommendation,
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
    pathname: "/console/whatsapp/broadcasts",
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
  const [selectedContactIds, setSelectedContactIds] = React.useState<
    Set<string>
  >(new Set())
  const [manualRecipients, setManualRecipients] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [capacity, setCapacity] =
    React.useState<DeviceBroadcastCapacity | null>(null)
  const [recommendation, setRecommendation] =
    React.useState<BroadcastScheduleRecommendation | null>(null)
  const [throttleMaxMessages, setThrottleMaxMessages] =
    React.useState<number>(0)
  const [throttlePerMinutes, setThrottlePerMinutes] = React.useState<number>(60)
  const [showConfirmModal, setShowConfirmModal] = React.useState(false)
  const [acknowledgeMultiDay, setAcknowledgeMultiDay] = React.useState(false)

  const selectedTemplate = (templates ?? []).find(
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

  const allContactsSelected =
    contacts.length > 0 && selectedContactIds.size === contacts.length

  const totalRecipients = React.useMemo(() => {
    return (
      selectedContactPhones.length + parseRecipients(manualRecipients).length
    )
  }, [selectedContactPhones, manualRecipients])

  const effectiveDeviceId = deviceId || selectedTemplate?.whatsappDeviceId
  const hasScheduleInputs = Boolean(effectiveDeviceId && totalRecipients > 0)
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
  React.useEffect(() => {
    ;(async () => {
      try {
        const [templateItems, deviceItems, contactItems] = await Promise.all([
          whatsappClient.listTemplates(),
          whatsappClient.listDevices(),
          whatsappClient.listContacts(),
        ])
        setTemplates(Array.isArray(templateItems) ? templateItems : [])
        setDevices(Array.isArray(deviceItems) ? deviceItems : [])
        setContacts(Array.isArray(contactItems) ? contactItems : [])
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to load form data"
        )
      }
    })()
  }, [])

  React.useEffect(() => {
    const manualPhoneNumbers = parseRecipients(manualRecipients)
    const contactPhoneNumbers = selectedContactPhones.map((p) => ({
      phoneNumber: p,
    }))
    const allRecipients = [...contactPhoneNumbers, ...manualPhoneNumbers]

    if (!effectiveDeviceId || allRecipients.length === 0) {
      return
    }

    let cancelled = false
    whatsappClient
      .previewBroadcastSchedule({
        whatsappDeviceId: effectiveDeviceId,
        recipients: allRecipients,
      })
      .then((result) => {
        if (!cancelled) {
          setCapacity(result.capacity)
          setRecommendation(result.recommendation)
          setThrottleMaxMessages(result.recommendation.throttleMaxMessages)
          setThrottlePerMinutes(result.recommendation.throttlePerMinutes)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCapacity(null)
          setRecommendation(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [effectiveDeviceId, manualRecipients, selectedContactPhones])
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

    setShowConfirmModal(true)
  }

  const handleConfirmCreate = async () => {
    const manualPhoneNumbers = parseRecipients(manualRecipients)
    const contactPhoneNumbers = selectedContactPhones.map((phoneNumber) => ({
      phoneNumber,
    }))
    const allRecipients = [...contactPhoneNumbers, ...manualPhoneNumbers]

    if (!selectedTemplate) return

    setShowConfirmModal(false)
    setIsSubmitting(true)
    try {
      const broadcast = await whatsappClient.createBroadcast({
        templateName: selectedTemplate.name,
        templateLanguage,
        whatsappDeviceId: deviceId || selectedTemplate.whatsappDeviceId,
        throttleMaxMessages,
        throttlePerMinutes,
        acknowledgeMultiDay: acknowledgeMultiDay || undefined,
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
                      <span className="font-normal text-muted-foreground">
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
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  {contacts.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No contacts available.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {contacts.map((contact) => (
                        <label
                          key={contact.id}
                          className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selectedContactIds.has(contact.id)}
                            onCheckedChange={() => toggleContact(contact.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {contact.name || "Unnamed contact"}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
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

      {/* Scheduling card */}
      {hasScheduleInputs && (
        <Card>
          <CardHeader>
            <CardTitle>Scheduling</CardTitle>
            {capacity ? (
              <CardDescription>
                Device limit of {capacity.dailyLimit} messages / 24h (
                {capacity.hourlyLimit}/h). Used {capacity.dailyUsed} today,
                {capacity.hourlyUsed} this hour.
              </CardDescription>
            ) : (
              <CardDescription>Calculating schedule…</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {capacity && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="throttleMax">Messages per window</Label>
                    <Input
                      id="throttleMax"
                      type="number"
                      min={1}
                      value={throttleMaxMessages}
                      onChange={(e) =>
                        setThrottleMaxMessages(Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="throttleMin">Window (minutes)</Label>
                    <Input
                      id="throttleMin"
                      type="number"
                      min={1}
                      value={throttlePerMinutes}
                      onChange={(e) =>
                        setThrottlePerMinutes(Number(e.target.value))
                      }
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  ~
                  {Math.ceil(
                    (totalRecipients * throttlePerMinutes) /
                      (throttleMaxMessages || 1)
                  )}
                  m at{" "}
                  {Math.round((throttleMaxMessages / throttlePerMinutes) * 60)}
                  /h
                </p>
                {totalRecipients > capacity.remainingToday && (
                  <p className="text-sm text-amber-500">
                    {totalRecipients} recipients exceed{" "}
                    {capacity.remainingToday} remaining today — will span
                    multiple days.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmation dialog */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm broadcast</DialogTitle>
            <DialogDescription>
              Review the schedule before sending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Recipients</span>
              <span>{totalRecipients}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Daily limit</span>
              <span>{capacity?.dailyLimit ?? "—"} / day</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining today</span>
              <span>{capacity?.remainingToday ?? "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rate</span>
              <span>
                {throttleMaxMessages} msg / {throttlePerMinutes}m
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Est. duration</span>
              <span>
                ~
                {Math.ceil(
                  (totalRecipients * throttlePerMinutes) /
                    (throttleMaxMessages || 1)
                )}
                m
              </span>
            </div>
            {totalRecipients > (capacity?.remainingToday ?? 0) && (
              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  id="multiDay"
                  checked={acknowledgeMultiDay}
                  onCheckedChange={(v) => setAcknowledgeMultiDay(v === true)}
                />
                <Label htmlFor="multiDay" className="text-sm text-amber-500">
                  I understand this broadcast will span multiple days
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleConfirmCreate()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating…" : "Confirm & send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
