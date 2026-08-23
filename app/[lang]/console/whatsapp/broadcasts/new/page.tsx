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
import {
  whatsappClient,
  type Contact,
  type CreateBroadcastInput,
  type Device,
  type DeviceBroadcastCapacity,
  type Template,
} from "@/modules/whatsapp/whatsapp-client"

type RecipientTab = "manual" | "contacts" | "csv"

type BroadcastRecipientInput = CreateBroadcastInput["recipients"][number]

const THROTTLE_PER_MINUTES = 60
const FALLBACK_THROTTLE_MAX_MESSAGES = 40
const PLACEHOLDER_PATTERN = /\{\{(\d+)\}\}/g

function extractPlaceholders(body?: string | null): string[] {
  if (!body) {
    return []
  }
  const found = new Set<string>()
  for (const match of body.matchAll(PLACEHOLDER_PATTERN)) {
    found.add(match[1])
  }
  return [...found].sort((a, b) => Number(a) - Number(b))
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `~${minutes} menit`
  }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `~${hours} jam ${rest} menit` : `~${hours} jam`
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
  const [capacity, setCapacity] =
    React.useState<DeviceBroadcastCapacity | null>(null)
  const [acknowledgeMultiDay, setAcknowledgeMultiDay] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // ─── Derived form data ──────────────────────────────────────────────

  const selectedTemplate = (templates ?? []).find(
    (template) => template.id === templateId
  )
  const languages = React.useMemo(
    () => selectedTemplate?.languages ?? [],
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
    () => extractPlaceholders(selectedLanguageBody),
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
    return [
      "Nomor WhatsApp",
      ...(hasNameColumn ? ["Nama"] : []),
      ...Object.keys(csvRows[0]?.dynamicValues ?? {}),
    ]
  }, [csvRows])

  const activeRecipients = React.useMemo<BroadcastRecipientInput[]>(() => {
    if (recipientTab === "contacts") {
      return contacts
        .filter((contact) => selectedContactIds.has(contact.id))
        .map((contact) => ({
          phoneNumber: contact.phoneNumber,
          name: contact.name || undefined,
          dynamicValues:
            contact.dynamicValues && Object.keys(contact.dynamicValues).length
              ? contact.dynamicValues
              : variableValues,
        }))
    }
    if (recipientTab === "csv") {
      return validCsvRows.map((row) => {
        const rowValues = Object.values(row.dynamicValues)
        const mappedValues: Record<string, string> = {}

        if (rowValues.length > 0) {
          // Positional mapping: assign CSV extra columns to template placeholders {{1}}, {{2}}, ... in order
          placeholders.forEach((placeholder, index) => {
            if (rowValues[index] !== undefined && rowValues[index] !== "") {
              mappedValues[placeholder] = rowValues[index]
            } else if (variableValues[placeholder]) {
              mappedValues[placeholder] = variableValues[placeholder]
            }
          })
        }

        return {
          phoneNumber: row.phoneNumber,
          name: row.name || undefined,
          dynamicValues:
            Object.keys(mappedValues).length > 0
              ? mappedValues
              : variableValues,
        }
      })
    }
    return manualParsed
      .filter((entry) => entry.isValid)
      .map((entry) => ({
        phoneNumber: entry.phoneNumber,
        dynamicValues: variableValues,
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

  const effectiveDeviceId = deviceId || selectedTemplate?.whatsappDeviceId || ""
  const selectedDevice = (devices ?? []).find(
    (device) => device.id === effectiveDeviceId
  )
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
  const canSubmit = Boolean(
    selectedTemplate &&
    templateLanguage &&
    effectiveDeviceId &&
    totalRecipients > 0 &&
    !isSubmitting &&
    (!needsMultiDayAck || acknowledgeMultiDay)
  )

  // ─── Data loading ───────────────────────────────────────────────────

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
    let cancelled = false
    if (!effectiveDeviceId) {
      return
    }
    whatsappClient
      .previewBroadcastSchedule({
        whatsappDeviceId: effectiveDeviceId,
        recipients: activeRecipients.map((r) => ({
          phoneNumber: r.phoneNumber,
        })),
      })
      .then((result) => {
        if (!cancelled) {
          setCapacity(result.capacity)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCapacity(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [effectiveDeviceId, activeRecipients])

  // ─── Handlers ───────────────────────────────────────────────────────

  function handleTemplateChange(value: string) {
    setTemplateId(value)
    const template = templates.find((item) => item.id === value)
    setTemplateLanguage(template?.languages[0]?.lang ?? "")
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedTemplate) {
      toast.error("Pilih template terlebih dahulu.")
      return
    }
    if (!templateLanguage) {
      toast.error("Pilih bahasa template terlebih dahulu.")
      return
    }
    if (!effectiveDeviceId) {
      toast.error("Pilih perangkat WhatsApp terlebih dahulu.")
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
        templateName: selectedTemplate.name,
        templateLanguage,
        whatsappDeviceId: effectiveDeviceId,
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
        {/* Step 1: Template & Perangkat */}
        <Card>
          <CardHeader>
            <CardTitle>1. Template & Perangkat</CardTitle>
            <CardDescription>
              Pilih template pesan yang sudah disetujui dan perangkat WhatsApp
              pengirim.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="template">Template</Label>
                <Select value={templateId} onValueChange={handleTemplateChange}>
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Pilih template" />
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

            <div className="grid gap-2">
              <Label htmlFor="device">Perangkat WhatsApp</Label>
              <Select value={deviceId} onValueChange={setDeviceId}>
                <SelectTrigger id="device">
                  <SelectValue placeholder="Gunakan perangkat bawaan template" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.phoneNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {effectiveDeviceId &&
                (selectedDevice ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge
                      variant={
                        selectedDevice.status === "ACTIVE"
                          ? "success"
                          : "secondary"
                      }
                    >
                      {selectedDevice.status === "ACTIVE"
                        ? "Aktif"
                        : "Nonaktif"}
                    </Badge>
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
            </div>
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

        {/* Step 3: Variabel Pesan */}
        <Card>
          <CardHeader>
            <CardTitle>3. Variabel Pesan</CardTitle>
            <CardDescription>
              Isi nilai untuk variabel yang ada di dalam template.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedTemplate ? (
              <p className="text-sm text-muted-foreground">
                Pilih template terlebih dahulu untuk melihat variabel pesan.
              </p>
            ) : placeholders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Template ini tidak menggunakan variabel — tidak ada yang perlu
                diisi.
              </p>
            ) : (
              <>
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
                {recipientTab === "csv" && (
                  <p className="text-xs text-muted-foreground">
                    Untuk upload CSV, kolom pada file otomatis mengisi variabel
                    ini dari setiap baris.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Step 4: Ringkasan & Jadwal Pengiriman */}
        <Card>
          <CardHeader>
            <CardTitle>4. Ringkasan & Jadwal Pengiriman</CardTitle>
            <CardDescription>
              Periksa ringkasan sebelum membuat broadcast.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total penerima</span>
                <span>{totalRecipients}</span>
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
