"use client"
import {
  formatWhatsAppText,
  getWhatsAppText,
  WhatsAppText,
} from "@/modules/whatsapp/ui/whatsapp-text"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { CaretLeft, CaretRight, Warning } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  parseCsvRecipients,
  parseManualRecipients,
  type CsvRecipient,
} from "@/lib/whatsapp-phone-sanitizer"
import { buildRecipientCsvTemplate } from "@/modules/whatsapp/broadcasts/recipient-csv-template"
import {
  formatBroadcastVariableValidationError,
  validateBroadcastRecipientVariables,
} from "@/modules/whatsapp/broadcasts/broadcast-preflight"
import {
  whatsappClient,
  type Contact,
  type CreateBroadcastInput,
  type Device,
  type BroadcastPreflightResult,
} from "@/modules/whatsapp/whatsapp-client"
import { useTemplates } from "@/modules/whatsapp/templates/api/templates.hooks"
import {
  getFlagEmoji,
  getLanguageDisplay,
  WhatsAppTemplatePreview,
  type TemplatePreviewValues,
} from "@/modules/whatsapp/templates/ui/template-preview"
import { extractTemplateVariables } from "@/modules/whatsapp/templates/template-validator"

type RecipientTab = "manual" | "contacts" | "csv"

type BroadcastRecipientInput = CreateBroadcastInput["recipients"][number]

const THROTTLE_PER_MINUTES = 60
const FALLBACK_THROTTLE_MAX_MESSAGES = 40

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `~${minutes} menit`
  }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `~${hours} jam ${rest} menit` : `~${hours} jam`
}

function withFallbackVariableValues({
  source,
  fallback,
  placeholders,
}: {
  source?: Record<string, unknown> | null
  fallback: Record<string, string>
  placeholders: string[]
}): Record<string, unknown> | undefined {
  if (placeholders.length === 0) {
    return undefined
  }

  const values = { ...source }
  for (const placeholder of placeholders) {
    const variable = `{{${placeholder}}}`
    if (
      values[variable] === undefined &&
      values[placeholder] === undefined &&
      fallback[placeholder] !== undefined
    ) {
      values[variable] = fallback[placeholder]
    }
  }
  return values
}

function toTemplatePreviewValues(
  dynamicValues: Record<string, unknown> | undefined,
  placeholders: string[]
): TemplatePreviewValues {
  const resolved: TemplatePreviewValues = {}
  for (const placeholder of placeholders) {
    const value =
      dynamicValues?.[`{{${placeholder}}}`] ?? dynamicValues?.[placeholder]
    if (typeof value === "string" && value) {
      resolved[Number(placeholder)] = value
    }
  }
  return resolved
}

export default function NewWhatsAppBroadcastPage() {
  const router = useRouter()
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const basePath = localizePathname({
    pathname: "/console/whatsapp/broadcasts",
    locale,
  })

  const [devices, setDevices] = React.useState<Device[]>([])
  const [contacts, setContacts] = React.useState<Contact[]>([])
  const [templateId, setTemplateId] = React.useState("")
  const [templateLanguage, setTemplateLanguage] = React.useState("")
  const [deviceId, setDeviceId] = React.useState("")
  const [recipientTab, setRecipientTab] = React.useState<RecipientTab>("manual")
  const [manualRecipients, setManualRecipients] = React.useState("")
  const [selectedContactIds, setSelectedContactIds] = React.useState<
    Set<string>
  >(new Set())
  const [contactSearch, setContactSearch] = React.useState("")
  const [templateSearch, setTemplateSearch] = React.useState("")
  const [csvFileName, setCsvFileName] = React.useState("")
  const [csvRows, setCsvRows] = React.useState<CsvRecipient[]>([])
  const [previewIndex, setPreviewIndex] = React.useState(0)
  const [variableValues, setVariableValues] = React.useState<
    Record<string, string>
  >({})
  const [serverPreflight, setServerPreflight] =
    React.useState<BroadcastPreflightResult | null>(null)
  const [validatedPreflightKey, setValidatedPreflightKey] = React.useState<
    string | null
  >(null)
  const [preflightError, setPreflightError] = React.useState<{
    key: string
    message: string
  } | null>(null)
  const [acknowledgeMultiDay, setAcknowledgeMultiDay] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // ─── Derived form data ──────────────────────────────────────────────

  const activeDevices = React.useMemo(
    () => devices.filter((device) => device.status === "ACTIVE"),
    [devices]
  )
  const {
    templates,
    loading: templatesLoading,
    error: templatesError,
    reload: reloadTemplates,
  } = useTemplates({
    broadcastEligible: true,
    whatsappDeviceId: deviceId || undefined,
    enabled: Boolean(deviceId),
    sort: "desc",
  })
  const selectedTemplate = templates.find(
    (template) => template.id === templateId
  )
  const languages = React.useMemo(
    () =>
      selectedTemplate?.languages.filter(
        (language) => language.isApproved || language.metaStatus === "APPROVED"
      ) ?? [],
    [selectedTemplate]
  )
  const selectedLanguage = React.useMemo(
    () =>
      selectedTemplate?.languages.find(
        (language) => language.lang === templateLanguage
      ),
    [selectedTemplate, templateLanguage]
  )
  const selectedLanguageBody = selectedLanguage?.body
  const placeholders = React.useMemo(
    () => extractTemplateVariables(selectedLanguageBody).map(String),
    [selectedLanguageBody]
  )

  const manualParsed = React.useMemo(
    () => parseManualRecipients(manualRecipients),
    [manualRecipients]
  )
  const validManualCount = manualParsed.filter((r) => r.isValid).length
  const invalidManualCount = manualParsed.length - validManualCount

  const filteredTemplates = React.useMemo(() => {
    const query = templateSearch.trim().toLowerCase()
    if (!query) {
      return templates
    }
    return templates.filter((template) =>
      template.name.toLowerCase().includes(query)
    )
  }, [templates, templateSearch])

  const filteredContacts = React.useMemo(() => {
    const query = contactSearch.trim().toLowerCase()
    if (!query) {
      return contacts
    }
    return contacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(query) ||
        contact.phoneNumber.toLowerCase().includes(query)
    )
  }, [contacts, contactSearch])
  const allVisibleSelected =
    filteredContacts.length > 0 &&
    filteredContacts.every((contact) => selectedContactIds.has(contact.id))
  const selectedContactCount = selectedContactIds.size

  const validCsvRows = React.useMemo(
    () => csvRows.filter((row) => row.isValid),
    [csvRows]
  )
  const invalidCsvCount = csvRows.length - validCsvRows.length
  const csvColumns = React.useMemo(() => {
    const hasNameColumn = csvRows.some((row) => row.name)
    const dynamicColumns = new Set<string>()
    for (const row of csvRows) {
      for (const column of Object.keys(row.dynamicValues)) {
        dynamicColumns.add(column)
      }
    }
    return [
      "Nomor WhatsApp",
      ...(hasNameColumn ? ["Nama"] : []),
      ...[...dynamicColumns],
    ]
  }, [csvRows])

  const activeRecipients = React.useMemo<BroadcastRecipientInput[]>(() => {
    if (recipientTab === "contacts") {
      return contacts
        .filter((contact) => selectedContactIds.has(contact.id))
        .map((contact) => ({
          phoneNumber: contact.phoneNumber,
          name: contact.name || undefined,
          dynamicValues: withFallbackVariableValues({
            source: contact.dynamicValues,
            fallback: variableValues,
            placeholders,
          }),
        }))
    }
    if (recipientTab === "csv") {
      return validCsvRows.map((row) => {
        return {
          phoneNumber: row.phoneNumber,
          name: row.name || undefined,
          dynamicValues: withFallbackVariableValues({
            source: row.dynamicValues,
            fallback: variableValues,
            placeholders,
          }),
        }
      })
    }
    return manualParsed
      .filter((entry) => entry.isValid)
      .map((entry) => ({
        phoneNumber: entry.phoneNumber,
        dynamicValues: withFallbackVariableValues({
          fallback: variableValues,
          placeholders,
        }),
      }))
  }, [
    recipientTab,
    contacts,
    selectedContactIds,
    variableValues,
    validCsvRows,
    manualParsed,
    placeholders,
  ])
  const totalRecipients = activeRecipients.length
  const clampedPreviewIndex =
    totalRecipients > 0 ? Math.min(previewIndex, totalRecipients - 1) : 0
  const previewRecipient = activeRecipients[clampedPreviewIndex]
  const variableValidation = React.useMemo(
    () =>
      validateBroadcastRecipientVariables({
        templateBody: selectedLanguageBody,
        recipients: activeRecipients,
      }),
    [activeRecipients, selectedLanguageBody]
  )
  const hasInvalidRecipients =
    (recipientTab === "manual" && invalidManualCount > 0) ||
    (recipientTab === "csv" && invalidCsvCount > 0)
  const localPreflightErrors = React.useMemo(() => {
    const errors: string[] = []
    if (!deviceId) errors.push("Pilih perangkat WhatsApp.")
    if (!selectedTemplate) errors.push("Pilih template yang disetujui.")
    if (!templateLanguage) errors.push("Pilih bahasa template yang valid.")
    if (totalRecipients === 0)
      errors.push("Tambahkan minimal satu penerima valid.")
    if (hasInvalidRecipients) {
      errors.push("Perbaiki atau hapus penerima yang tidak valid.")
    }
    if (placeholders.length > 0 && !variableValidation.isValid) {
      errors.push(formatBroadcastVariableValidationError(variableValidation))
    }
    return errors
  }, [
    deviceId,
    hasInvalidRecipients,
    placeholders.length,
    selectedTemplate,
    templateLanguage,
    totalRecipients,
    variableValidation,
  ])

  const selectedDevice = (devices ?? []).find(
    (device) => device.id === deviceId
  )
  const preflightRequestKey = React.useMemo(
    () =>
      JSON.stringify({
        templateId: selectedTemplate?.id,
        templateLanguage,
        deviceId,
        recipients: activeRecipients,
      }),
    [activeRecipients, deviceId, selectedTemplate?.id, templateLanguage]
  )
  const isPreflightCurrent =
    serverPreflight !== null && validatedPreflightKey === preflightRequestKey
  const capacity = isPreflightCurrent ? serverPreflight.capacity : null
  const needsMultiDayAck = Boolean(
    capacity && totalRecipients > capacity.remainingToday
  )
  const throttleMaxMessages =
    capacity?.hourlyLimit || FALLBACK_THROTTLE_MAX_MESSAGES
  const estimatedMinutes =
    totalRecipients > 0
      ? Math.ceil(
          totalRecipients / (throttleMaxMessages / THROTTLE_PER_MINUTES)
        )
      : 0
  const isPreflightErrorCurrent = preflightError?.key === preflightRequestKey
  const canSubmit = Boolean(
    selectedTemplate &&
    templateLanguage &&
    deviceId &&
    totalRecipients > 0 &&
    localPreflightErrors.length === 0 &&
    isPreflightCurrent &&
    !isPreflightErrorCurrent &&
    !isSubmitting &&
    (!needsMultiDayAck || acknowledgeMultiDay)
  )

  // ─── Data loading ───────────────────────────────────────────────────

  React.useEffect(() => {
    ;(async () => {
      try {
        const [deviceItems, contactItems] = await Promise.all([
          whatsappClient.listDevices(),
          whatsappClient.listContacts(),
        ])
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
    if (!deviceId && activeDevices.length === 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeviceId(activeDevices[0].id)
    }
  }, [activeDevices, deviceId])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewIndex(0)
  }, [recipientTab])

  React.useEffect(() => {
    let cancelled = false
    if (
      !deviceId ||
      !selectedTemplate ||
      !templateLanguage ||
      localPreflightErrors.length > 0
    ) {
      return
    }
    whatsappClient
      .preflightBroadcast({
        templateId: selectedTemplate.id,
        templateLanguage,
        whatsappDeviceId: deviceId,
        recipients: activeRecipients,
      })
      .then((result) => {
        if (!cancelled) {
          setServerPreflight(result)
          setValidatedPreflightKey(preflightRequestKey)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPreflightError({
            key: preflightRequestKey,
            message:
              error instanceof Error
                ? error.message
                : "Preflight broadcast tidak dapat divalidasi.",
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [
    activeRecipients,
    deviceId,
    localPreflightErrors.length,
    selectedTemplate,
    templateLanguage,
    preflightRequestKey,
  ])

  // ─── Handlers ───────────────────────────────────────────────────────

  function handleTemplateChange(value: string) {
    setTemplateId(value)
    const target = templates.find((t) => t.id === value)
    const approvedLanguages =
      target?.languages.filter(
        (l) => l.isApproved || l.metaStatus === "APPROVED"
      ) ?? []
    if (approvedLanguages.length === 1 && approvedLanguages[0]) {
      setTemplateLanguage(approvedLanguages[0].lang)
    } else {
      setTemplateLanguage("")
    }
    setVariableValues({})
  }

  function handleDeviceChange(value: string) {
    setDeviceId(value)
    setTemplateId("")
    setTemplateLanguage("")
    setVariableValues({})
    setTemplateSearch("")
  }

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

  function toggleAllVisibleContacts() {
    setSelectedContactIds((prev) => {
      const next = new Set(prev)
      for (const contact of filteredContacts) {
        if (allVisibleSelected) {
          next.delete(contact.id)
        } else {
          next.add(contact.id)
        }
      }
      return next
    })
  }

  async function handleCsvFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    setCsvFileName(file.name)
    try {
      const content = await file.text()
      setCsvRows(parseCsvRecipients(content))
    } catch {
      toast.error("Unable to read the CSV file.")
      setCsvRows([])
    }
  }

  function downloadCsvTemplate() {
    const csv = buildRecipientCsvTemplate(selectedLanguageBody)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")

    link.href = url
    link.download = "template-penerima-whatsapp.csv"
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!deviceId) {
      toast.error("Pilih perangkat WhatsApp terlebih dahulu.")
      return
    }
    if (!selectedTemplate) {
      toast.error("Pilih template terlebih dahulu.")
      return
    }
    if (
      !templateLanguage ||
      !languages.some((lang) => lang.lang === templateLanguage)
    ) {
      toast.error("Pilih bahasa template yang valid terlebih dahulu.")
      return
    }
    if (totalRecipients === 0) {
      toast.error("Tambahkan minimal satu penerima.")
      return
    }
    if (needsMultiDayAck && !acknowledgeMultiDay) {
      toast.error("Centang konfirmasi pengiriman multi-hari untuk melanjutkan.")
      return
    }

    setIsSubmitting(true)
    try {
      const broadcast = await whatsappClient.createBroadcast({
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        templateLanguage,
        whatsappDeviceId: deviceId,
        throttleMaxMessages,
        throttlePerMinutes: THROTTLE_PER_MINUTES,
        acknowledgeMultiDay: needsMultiDayAck || undefined,
        recipients: activeRecipients,
      })
      toast.success(
        "Broadcast berhasil dibuat sebagai Draf. Silakan tinjau penerima dan klik 'Kirim Broadcast' untuk memulai pengiriman."
      )
      router.push(`${basePath}/${broadcast.id}`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create broadcast"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          <WhatsAppText id="s309" locale={locale} />
        </h1>
        <p className="text-muted-foreground">
          <WhatsAppText id="s310" locale={locale} />
        </p>
      </div>

      <form
        className="space-y-6"
        onSubmit={(event) => void handleSubmit(event)}
      >
        {/* Step 1: Perangkat, Template, & Bahasa */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  <WhatsAppText id="s311" locale={locale} />
                </CardTitle>
                <CardDescription>
                  <WhatsAppText id="s312" locale={locale} />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Device & Category Row */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor="device"
                      className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                    >
                      <WhatsAppText id="s313" locale={locale} />
                    </Label>
                    <Select value={deviceId} onValueChange={handleDeviceChange}>
                      <SelectTrigger
                        id="device"
                        className="h-9 w-full bg-background/50 text-xs font-medium"
                      >
                        <SelectValue
                          placeholder={getWhatsAppText("s314", locale)}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {activeDevices.map((device) => (
                          <SelectItem
                            key={device.id}
                            value={device.id}
                            className="text-xs"
                          >
                            {device.phoneNumber}{" "}
                            {device.verifiedName
                              ? `(${device.verifiedName})`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Live Quota Pill */}
                  <div className="flex flex-col justify-end">
                    {deviceId && selectedDevice ? (
                      <div className="flex h-9 items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-1.5 text-[11px]">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="inline-block size-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                          <span className="truncate font-medium text-foreground">
                            {selectedDevice.phoneNumber}
                          </span>
                        </div>
                        <div className="shrink-0 text-muted-foreground">
                          {capacity ? (
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {locale === "id"
                                ? `Sisa: ${capacity.remainingToday.toLocaleString()} pesan`
                                : `Quota: ${capacity.remainingToday.toLocaleString()} msgs`}
                            </span>
                          ) : (
                            <span className="italic">
                              {locale === "id"
                                ? "Memvalidasi kuota..."
                                : "Checking quota..."}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-9 items-center rounded-lg border border-dashed border-border/60 px-3 text-[11px] text-muted-foreground italic">
                        <WhatsAppText id="s325" locale={locale} />
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Unified Searchable Template Selector */}
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="template"
                      className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                    >
                      <WhatsAppText id="s16" locale={locale} />
                    </Label>
                    {selectedTemplate && (
                      <span className="text-[11px] text-muted-foreground">
                        {filteredTemplates.length}{" "}
                        {locale === "id"
                          ? "template ditemukan"
                          : "templates available"}
                      </span>
                    )}
                  </div>

                  {/* Input Search + Dropdown in a single connected toolbar */}
                  <div className="grid gap-1.5 sm:grid-cols-[160px_1fr]">
                    <div className="relative">
                      <Input
                        id="template-search"
                        className="h-9 w-full bg-background/50 pl-7 text-xs placeholder:text-muted-foreground/70"
                        value={templateSearch}
                        onChange={(event) =>
                          setTemplateSearch(event.target.value)
                        }
                        placeholder={getWhatsAppText("s403", locale)}
                        disabled={
                          !deviceId ||
                          templatesLoading ||
                          Boolean(templatesError)
                        }
                      />
                      <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-muted-foreground/70">
                        <svg
                          className="size-3.5"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.3-4.3" />
                        </svg>
                      </span>
                    </div>

                    <Select
                      value={templateId}
                      onValueChange={handleTemplateChange}
                      disabled={
                        !deviceId || templatesLoading || Boolean(templatesError)
                      }
                    >
                      <SelectTrigger
                        id="template"
                        className="h-9 w-full bg-background/50 text-xs"
                      >
                        <SelectValue
                          placeholder={
                            !deviceId
                              ? getWhatsAppText("s315", locale)
                              : getWhatsAppText("s316", locale)
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredTemplates.map((template) => {
                          const primaryLang = template.languages?.[0]
                          const varCount = extractTemplateVariables(
                            primaryLang?.body
                          ).length
                          const hasMedia =
                            primaryLang?.headerType &&
                            primaryLang.headerType !== "NONE" &&
                            primaryLang.headerType !== "TEXT"
                          const hasHeaderTxt = primaryLang?.headerText
                          const hasBtns =
                            Array.isArray(primaryLang?.buttons) &&
                            (primaryLang.buttons as unknown[]).length > 0
                          const category = template.category ?? "UTILITY"
                          return (
                            <SelectItem
                              key={template.id}
                              value={template.id}
                              textValue={template.name}
                              className="py-1.5 text-xs"
                            >
                              <div className="flex w-full items-center justify-between gap-3 text-left">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="truncate font-medium text-foreground">
                                    {template.name}
                                  </span>
                                  <span
                                    aria-hidden="true"
                                    className={`py-0.2 shrink-0 rounded px-1.5 text-[9px] font-bold tracking-wider uppercase ${
                                      category === "MARKETING"
                                        ? "border border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                        : category === "AUTHENTICATION"
                                          ? "border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                          : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    }`}
                                  >
                                    {category}
                                  </span>
                                </div>
                                <div
                                  className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground"
                                  aria-hidden="true"
                                >
                                  {varCount > 0 ? (
                                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                                      {varCount}{" "}
                                      {varCount === 1 ? "var" : "vars"}
                                    </span>
                                  ) : (
                                    <span className="opacity-60">static</span>
                                  )}
                                  {hasMedia ? (
                                    <span className="font-medium text-amber-600 dark:text-amber-400">
                                      • {primaryLang.headerType.toLowerCase()}
                                    </span>
                                  ) : hasHeaderTxt ? (
                                    <span className="text-amber-600 dark:text-amber-400">
                                      • header
                                    </span>
                                  ) : null}
                                  {hasBtns ? (
                                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                      • btn
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* 3. Language Selection */}
                <div className="grid gap-1.5 pt-1">
                  <Label
                    id="language-label"
                    className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                  >
                    <WhatsAppText id="s317" locale={locale} />
                  </Label>
                  <div
                    role="radiogroup"
                    aria-labelledby="language-label"
                    className="flex flex-wrap items-center gap-1.5"
                  >
                    {languages.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">
                        {getWhatsAppText("s318", locale)}
                      </span>
                    ) : (
                      languages.map((language) => {
                        const { code, label, flag } = getLanguageDisplay(
                          language.lang
                        )
                        const checked = templateLanguage === language.lang
                        return (
                          <button
                            key={language.id}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            onClick={() => setTemplateLanguage(language.lang)}
                            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all ${
                              checked
                                ? "border-primary bg-primary/10 font-semibold text-foreground shadow-xs"
                                : "border-border/80 bg-background/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            }`}
                          >
                            {flag ? (
                              <span className="text-sm leading-none">
                                {getFlagEmoji(flag)}
                              </span>
                            ) : null}
                            <span>{label}</span>
                            <span className="opacity-70">({code})</span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
                {!deviceId ? (
                  <p className="text-xs text-muted-foreground">
                    <WhatsAppText id="s319" locale={locale} />
                  </p>
                ) : templatesLoading ? (
                  <p className="text-xs text-muted-foreground">
                    <WhatsAppText id="s320" locale={locale} />
                  </p>
                ) : templatesError ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/50 p-3">
                    <p className="text-sm text-destructive">{templatesError}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={reloadTemplates}
                    >
                      <WhatsAppText id="s101" locale={locale} />
                    </Button>
                  </div>
                ) : templates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    <WhatsAppText id="s321" locale={locale} />
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {/* Step 2: Daftar Penerima */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <WhatsAppText id="s326" locale={locale} />
                </CardTitle>
                <CardDescription>
                  <WhatsAppText id="s327" locale={locale} />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs
                  value={recipientTab}
                  onValueChange={(value) =>
                    setRecipientTab(value as RecipientTab)
                  }
                >
                  <TabsList className="w-full sm:w-auto">
                    <TabsTrigger value="manual">
                      <WhatsAppText id="s328" locale={locale} />
                    </TabsTrigger>
                    <TabsTrigger value="contacts">
                      <WhatsAppText id="s329" locale={locale} />
                    </TabsTrigger>
                    <TabsTrigger value="csv">
                      <WhatsAppText id="s17" locale={locale} />
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="manual" className="space-y-2 pt-2">
                    <Textarea
                      id="recipients"
                      rows={8}
                      value={manualRecipients}
                      onChange={(event) =>
                        setManualRecipients(event.target.value)
                      }
                      placeholder={"6281234567890\n6289876543210"}
                    />
                    <p className="text-xs text-muted-foreground">
                      <WhatsAppText id="s330" locale={locale} />
                    </p>
                    {manualRecipients.trim().length > 0 && (
                      <p className="text-xs font-medium">
                        {formatWhatsAppText(
                          "s331",
                          { count: validManualCount },
                          locale
                        )}
                        {invalidManualCount > 0 && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {" "}
                            {formatWhatsAppText(
                              "s332",
                              { count: invalidManualCount },
                              locale
                            )}
                          </span>
                        )}
                      </p>
                    )}
                    <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        <WhatsAppText id="s409" locale={locale} />
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!selectedTemplate || !templateLanguage}
                        onClick={downloadCsvTemplate}
                      >
                        <WhatsAppText id="s19" locale={locale} />
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="contacts" className="space-y-3 pt-2">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        id="contact-search"
                        value={contactSearch}
                        onChange={(event) =>
                          setContactSearch(event.target.value)
                        }
                        placeholder={getWhatsAppText("s333", locale)}
                        className="max-w-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={toggleAllVisibleContacts}
                        className="h-auto p-0 text-xs"
                        disabled={filteredContacts.length === 0}
                      >
                        {allVisibleSelected ? "Batalkan semua" : "Pilih semua"}
                      </Button>
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-md border">
                      {filteredContacts.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          <WhatsAppText id="s334" locale={locale} />
                        </div>
                      ) : (
                        <div className="divide-y">
                          {filteredContacts.map((contact) => (
                            <label
                              key={contact.id}
                              className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
                            >
                              <Checkbox
                                checked={selectedContactIds.has(contact.id)}
                                onCheckedChange={() =>
                                  toggleContact(contact.id)
                                }
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">
                                  {contact.name || "Kontak tanpa nama"}
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
                    <p className="text-xs text-muted-foreground">
                      {formatWhatsAppText(
                        "s335",
                        { count: selectedContactCount },
                        locale
                      )}
                    </p>
                  </TabsContent>

                  <TabsContent value="csv" className="space-y-3 pt-2">
                    <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          <WhatsAppText id="s336" locale={locale} />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatWhatsAppText(
                            "s381",
                            { first: "{{1}}", second: "{{2}}" },
                            locale
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <WhatsAppText id="s337" locale={locale} />
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!selectedTemplate || !templateLanguage}
                        onClick={downloadCsvTemplate}
                      >
                        <WhatsAppText id="s19" locale={locale} />
                      </Button>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="csv-file">
                        <WhatsAppText id="s20" locale={locale} />
                      </Label>
                      <Input
                        id="csv-file"
                        type="file"
                        accept=".csv,.txt,text/csv,text/plain"
                        onChange={(event) => void handleCsvFileChange(event)}
                      />
                    </div>
                    {csvFileName ? (
                      <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
                        <p className="font-medium">{csvFileName}</p>
                        <p>
                          {formatWhatsAppText(
                            "s338",
                            { count: validCsvRows.length },
                            locale
                          )}
                          {invalidCsvCount > 0 && (
                            <span className="text-amber-600 dark:text-amber-400">
                              {" "}
                              {formatWhatsAppText(
                                "s339",
                                { count: invalidCsvCount },
                                locale
                              )}
                            </span>
                          )}
                        </p>
                        {csvColumns.length > 1 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">
                              {formatWhatsAppText(
                                "s340",
                                { columns: "" },
                                locale
                              )}
                            </span>
                            {csvColumns.map((column) => (
                              <Badge key={column} variant="outline">
                                {column}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        <WhatsAppText id="s368" locale={locale} />
                      </p>
                    )}
                  </TabsContent>
                </Tabs>

                <p className="text-sm font-medium">
                  {formatWhatsAppText(
                    "s341",
                    { count: totalRecipients },
                    locale
                  )}
                </p>
              </CardContent>
            </Card>

            {placeholders.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>
                    <WhatsAppText id="s342" locale={locale} />
                  </CardTitle>
                  <CardDescription>
                    <WhatsAppText id="s343" locale={locale} />
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {placeholders.map((placeholder) => (
                      <div key={placeholder} className="grid gap-2">
                        <Label htmlFor={`variable-${placeholder}`}>
                          {formatWhatsAppText(
                            "s344",
                            { variable: `{{${placeholder}}}` },
                            locale
                          )}
                        </Label>
                        <Input
                          id={`variable-${placeholder}`}
                          value={variableValues[placeholder] ?? ""}
                          onChange={(event) =>
                            setVariableValues((prev) => ({
                              ...prev,
                              [placeholder]: event.target.value,
                            }))
                          }
                          placeholder={`Nilai default {${`{${placeholder}}`}}`}
                        />
                      </div>
                    ))}
                  </div>
                  {recipientTab === "csv" ? (
                    <p className="text-xs text-muted-foreground">
                      <WhatsAppText id="s369" locale={locale} />
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="lg:sticky lg:top-6">
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="border-b bg-muted/20 pb-3">
                <CardTitle className="text-base font-semibold">
                  <WhatsAppText id="s404" locale={locale} />
                </CardTitle>
                {recipientTab !== "manual" && totalRecipients > 0 ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      disabled={clampedPreviewIndex === 0}
                      onClick={() =>
                        setPreviewIndex((index) => Math.max(index - 1, 0))
                      }
                      aria-label={getWhatsAppText("s407", locale)}
                    >
                      <CaretLeft />
                    </Button>
                    {formatWhatsAppText(
                      "s406",
                      {
                        current: clampedPreviewIndex + 1,
                        total: totalRecipients,
                      },
                      locale
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      disabled={clampedPreviewIndex >= totalRecipients - 1}
                      onClick={() =>
                        setPreviewIndex((index) =>
                          Math.min(index + 1, totalRecipients - 1)
                        )
                      }
                      aria-label={getWhatsAppText("s408", locale)}
                    >
                      <CaretRight />
                    </Button>
                  </div>
                ) : (
                  <CardDescription className="text-xs">
                    <WhatsAppText id="s405" locale={locale} />
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="p-4">
                {/* Smartphone Preview Frame */}
                <div className="overflow-hidden rounded-xl border border-border/70 bg-[#EFEAE2] shadow-inner dark:bg-[#0B141A]">
                  {/* Phone Mockup Header */}
                  <div className="flex items-center gap-2.5 border-b border-border/40 bg-[#008069] px-3.5 py-2.5 text-white dark:bg-[#1F2C34]">
                    <div className="flex size-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                      WA
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs leading-tight font-semibold">
                        {selectedDevice?.phoneNumber || "WhatsApp Business"}
                      </p>
                      <p className="text-[10px] leading-none text-white/80">
                        Online
                      </p>
                    </div>
                  </div>

                  {/* Chat Area Wallpaper & Content */}
                  <div className="min-h-[200px] p-3">
                    {selectedLanguage ? (
                      <WhatsAppTemplatePreview
                        language={selectedLanguage}
                        values={toTemplatePreviewValues(
                          previewRecipient?.dynamicValues ?? variableValues,
                          placeholders
                        )}
                      />
                    ) : (
                      <div className="flex min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center text-xs text-muted-foreground">
                        <p>
                          <WhatsAppText id="s410" locale={locale} />
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Final server-validated review before the campaign is created. */}
        <Card>
          <CardHeader>
            <CardTitle>
              <WhatsAppText id="s345" locale={locale} />
            </CardTitle>
            <CardDescription>
              <WhatsAppText id="s346" locale={locale} />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isPreflightErrorCurrent ? (
              <Alert variant="destructive">
                <Warning weight="fill" />
                <AlertDescription>{preflightError.message}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  <WhatsAppText id="s113" locale={locale} />
                </span>
                <span>
                  {isPreflightCurrent &&
                  serverPreflight.selection.deviceId === deviceId
                    ? selectedDevice?.phoneNumber
                    : "Belum tervalidasi"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  <WhatsAppText id="s16" locale={locale} />
                </span>
                <span>
                  {isPreflightCurrent
                    ? serverPreflight.selection.templateName
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  <WhatsAppText id="s317" locale={locale} />
                </span>
                <span>
                  {isPreflightCurrent
                    ? serverPreflight.selection.templateLanguage
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  <WhatsAppText id="s347" locale={locale} />
                </span>
                <span>
                  {isPreflightCurrent
                    ? serverPreflight.recipientCount
                    : totalRecipients}{" "}
                  ({" "}
                  {recipientTab === "manual"
                    ? "ketik/paste"
                    : recipientTab === "contacts"
                      ? "daftar kontak"
                      : csvFileName || "CSV"}
                  )
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  <WhatsAppText id="s348" locale={locale} />
                </span>
                <span>
                  {isPreflightCurrent &&
                  serverPreflight.dispatchMode === "MANUAL_DISPATCH"
                    ? "Buat antrean, kirim manual"
                    : "Belum tervalidasi"}
                </span>
              </div>
              {placeholders.length > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    <WhatsAppText id="s21" locale={locale} />
                  </span>
                  <span>{variableValidation.requiredVariables.join(", ")}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  <WhatsAppText id="s349" locale={locale} />
                </span>
                <span>
                  {isPreflightCurrent
                    ? needsMultiDayAck && !acknowledgeMultiDay
                      ? "Perlu konfirmasi multi-hari"
                      : "Lulus"
                    : isPreflightErrorCurrent
                      ? "Gagal"
                      : localPreflightErrors.length === 0
                        ? "Memvalidasi server…"
                        : "Menunggu data valid"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  <WhatsAppText id="s350" locale={locale} />
                </span>
                <span>
                  {totalRecipients > 0 && capacity
                    ? formatDuration(estimatedMinutes)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  <WhatsAppText id="s351" locale={locale} />
                </span>
                <span>
                  ±{throttleMaxMessages}{" "}
                  <WhatsAppText id="s352" locale={locale} />
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  <WhatsAppText id="s353" locale={locale} />
                </span>
                <span>
                  {capacity
                    ? `${capacity.dailyUsed + Math.min(totalRecipients, capacity.remainingToday)} / ${capacity.dailyLimit} kuota harian terpakai`
                    : "—"}
                </span>
              </div>
            </div>

            {needsMultiDayAck && (
              <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                <Warning weight="fill" />
                <AlertDescription className="text-amber-700 dark:text-amber-300">
                  {formatWhatsAppText(
                    "s370",
                    { count: capacity?.remainingToday ?? 0 },
                    locale
                  )}
                </AlertDescription>
                <div className="mt-2 flex items-center gap-2">
                  <Checkbox
                    id="multi-day-ack"
                    checked={acknowledgeMultiDay}
                    onCheckedChange={(checked) =>
                      setAcknowledgeMultiDay(checked === true)
                    }
                  />
                  <Label
                    htmlFor="multi-day-ack"
                    className="text-sm font-normal"
                  >
                    Saya memahami dan menyetujui pengiriman multi-hari ini.
                  </Label>
                </div>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(basePath)}
                disabled={isSubmitting}
              >
                <WhatsAppText id="s354" locale={locale} />
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {isSubmitting ? "Membuat broadcast…" : "Buat Broadcast"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
