"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Warning } from "@phosphor-icons/react"
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
  const [csvFileName, setCsvFileName] = React.useState("")
  const [csvRows, setCsvRows] = React.useState<CsvRecipient[]>([])
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
  const selectedLanguageBody = React.useMemo(
    () =>
      selectedTemplate?.languages.find(
        (language) => language.lang === templateLanguage
      )?.body,
    [selectedTemplate, templateLanguage]
  )
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
    needsMultiDayAck,
    selectedTemplate,
    templateLanguage,
    preflightRequestKey,
  ])

  // ─── Handlers ───────────────────────────────────────────────────────

  function handleTemplateChange(value: string) {
    setTemplateId(value)
    setTemplateLanguage("")
    setVariableValues({})
  }

  function handleDeviceChange(value: string) {
    setDeviceId(value)
    setTemplateId("")
    setTemplateLanguage("")
    setVariableValues({})
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
      toast.success("Broadcast berhasil dibuat")
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
        <h1 className="text-2xl font-bold tracking-tight">Broadcast Baru</h1>
        <p className="text-muted-foreground">
          Kirim pesan template WhatsApp ke banyak penerima dalam empat langkah
          mudah.
        </p>
      </div>

      <form
        className="space-y-6"
        onSubmit={(event) => void handleSubmit(event)}
      >
        {/* Step 1: Perangkat, Template, & Bahasa */}
        <Card>
          <CardHeader>
            <CardTitle>1. Perangkat, Template, & Bahasa</CardTitle>
            <CardDescription>
              Pilih perangkat pengirim, lalu template dan bahasa yang tersedia
              untuk perangkat tersebut.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="device">Perangkat WhatsApp</Label>
                <Select value={deviceId} onValueChange={handleDeviceChange}>
                  <SelectTrigger id="device">
                    <SelectValue placeholder="Pilih perangkat" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeDevices.map((device) => (
                      <SelectItem key={device.id} value={device.id}>
                        {device.phoneNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="template">Template</Label>
                <Select
                  value={templateId}
                  onValueChange={handleTemplateChange}
                  disabled={
                    !deviceId || templatesLoading || Boolean(templatesError)
                  }
                >
                  <SelectTrigger id="template">
                    <SelectValue
                      placeholder={
                        !deviceId
                          ? "Pilih perangkat terlebih dahulu"
                          : "Pilih template"
                      }
                    />
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
                <Label htmlFor="language">Bahasa</Label>
                <Select
                  value={templateLanguage}
                  onValueChange={setTemplateLanguage}
                  disabled={!templateId}
                >
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Pilih bahasa" />
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
            </div>

            {!deviceId ? (
              <p className="text-sm text-muted-foreground">
                Pilih perangkat untuk memuat template yang tersedia.
              </p>
            ) : templatesLoading ? (
              <p className="text-sm text-muted-foreground">
                Memuat template perangkat...
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
                  Coba lagi
                </Button>
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tidak ada template disetujui untuk perangkat ini.
              </p>
            ) : null}

            {deviceId &&
              (selectedDevice ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="success">Aktif</Badge>
                  <span className="text-muted-foreground">
                    Sisa kuota 24 jam:{" "}
                    {capacity
                      ? `${capacity.remainingToday} pesan`
                      : "menghitung…"}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Perangkat tidak ditemukan.
                </p>
              ))}
          </CardContent>
        </Card>

        {/* Step 2: Daftar Penerima */}
        <Card>
          <CardHeader>
            <CardTitle>2. Daftar Penerima</CardTitle>
            <CardDescription>
              Tentukan siapa saja yang akan menerima pesan ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs
              value={recipientTab}
              onValueChange={(value) => setRecipientTab(value as RecipientTab)}
            >
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="manual">Ketik / Paste Nomor</TabsTrigger>
                <TabsTrigger value="contacts">Daftar Kontak</TabsTrigger>
                <TabsTrigger value="csv">Upload CSV / Excel</TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="space-y-2 pt-2">
                <Textarea
                  id="recipients"
                  rows={8}
                  value={manualRecipients}
                  onChange={(event) => setManualRecipients(event.target.value)}
                  placeholder={"6281234567890\n6289876543210"}
                />
                <p className="text-xs text-muted-foreground">
                  Tulis satu nomor per baris atau pisahkan dengan koma.
                </p>
                {manualRecipients.trim().length > 0 && (
                  <p className="text-xs font-medium">
                    {validManualCount} nomor valid terdeteksi
                    {invalidManualCount > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {" "}
                        · {invalidManualCount} nomor tidak valid akan dilewati
                      </span>
                    )}
                  </p>
                )}
              </TabsContent>

              <TabsContent value="contacts" className="space-y-3 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <Input
                    id="contact-search"
                    value={contactSearch}
                    onChange={(event) => setContactSearch(event.target.value)}
                    placeholder="Cari nama atau nomor…"
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
                      Tidak ada kontak yang cocok.
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
                            onCheckedChange={() => toggleContact(contact.id)}
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
                  {selectedContactCount} kontak dipilih
                </p>
              </TabsContent>

              <TabsContent value="csv" className="space-y-3 pt-2">
                <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Template CSV penerima</p>
                    <p className="text-xs text-muted-foreground">
                      Unduh kolom yang sesuai dengan bahasa template. Kolom
                      Nomor WhatsApp dan Nama dikenali otomatis; variabel pesan
                      mengikuti urutan {"{{1}}"}, {"{{2}}"}, dan seterusnya.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ganti baris contoh fiktif sebelum mengunggah file.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!selectedTemplate || !templateLanguage}
                    onClick={downloadCsvTemplate}
                  >
                    Unduh template CSV
                  </Button>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="csv-file">File CSV / TXT</Label>
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
                      {validCsvRows.length} baris valid terdeteksi
                      {invalidCsvCount > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {" "}
                          · {invalidCsvCount} baris tidak valid akan dilewati
                        </span>
                      )}
                    </p>
                    {csvColumns.length > 1 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          Kolom terdeteksi:
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
                    Kolom pertama yang berisi nomor telepon akan dipakai
                    otomatis sebagai tujuan.
                  </p>
                )}
              </TabsContent>
            </Tabs>

            <p className="text-sm font-medium">
              Total penerima: {totalRecipients}
            </p>
          </CardContent>
        </Card>

        {placeholders.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>3. Variabel Pesan</CardTitle>
              <CardDescription>
                Isi nilai untuk variabel yang ada di dalam template.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {placeholders.map((placeholder) => (
                  <div key={placeholder} className="grid gap-2">
                    <Label htmlFor={`variable-${placeholder}`}>
                      Nilai untuk {`{{${placeholder}}}`}
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
                  CSV harus menggunakan kolom {"{{1}}"}, {"{{2}}"}, dan
                  seterusnya. Kolom yang tidak dipakai akan memblokir preflight.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {/* Final server-validated review before the campaign is created. */}
        <Card>
          <CardHeader>
            <CardTitle>
              {placeholders.length > 0 ? "4" : "3"}. Preflight & Jadwal
              Pengiriman
            </CardTitle>
            <CardDescription>
              Konfirmasi data yang divalidasi server sebelum membuat broadcast.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {localPreflightErrors.length > 0 ? (
              <Alert variant="destructive">
                <Warning weight="fill" />
                <AlertDescription>
                  {localPreflightErrors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </AlertDescription>
              </Alert>
            ) : null}
            {isPreflightErrorCurrent ? (
              <Alert variant="destructive">
                <Warning weight="fill" />
                <AlertDescription>{preflightError.message}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Perangkat</span>
                <span>
                  {isPreflightCurrent &&
                  serverPreflight.selection.deviceId === deviceId
                    ? selectedDevice?.phoneNumber
                    : "Belum tervalidasi"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Template</span>
                <span>
                  {isPreflightCurrent
                    ? serverPreflight.selection.templateName
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bahasa</span>
                <span>
                  {isPreflightCurrent
                    ? serverPreflight.selection.templateLanguage
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Penerima</span>
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
                <span className="text-muted-foreground">Mode kirim</span>
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
                    Variabel template
                  </span>
                  <span>{variableValidation.requiredVariables.join(", ")}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status preflight</span>
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
                <span className="text-muted-foreground">Estimasi selesai</span>
                <span>
                  {totalRecipients > 0 && capacity
                    ? formatDuration(estimatedMinutes)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Kecepatan pengiriman
                </span>
                <span>±{throttleMaxMessages} pesan/jam</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Kuota harian</span>
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
                  Pengiriman melebihi sisa kuota hari ini (
                  {capacity?.remainingToday} pesan). Broadcast akan otomatis
                  dikirim bertahap multi-hari.
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
                Batal
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
