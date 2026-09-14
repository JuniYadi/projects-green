"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { localizePathname } from "@/lib/i18n/pathname"
import {
  CheckCircle,
  Copy,
  DeviceMobile,
  DownloadSimple,
  Info,
  MagnifyingGlass,
  PaperPlaneTilt,
  Speedometer,
  Timer,
} from "@phosphor-icons/react"
import { WhatsAppTemplatePreview } from "@/modules/whatsapp/templates/ui/template-preview"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getMessages } from "@/lib/i18n/messages"
import {
  whatsappClient,
  type Broadcast,
  type BroadcastRecipient,
  type BroadcastRecipientStatus,
  type Template,
} from "@/modules/whatsapp/whatsapp-client"

type RecipientFilter = "ALL" | BroadcastRecipientStatus

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "—"

const recipientBadgeVariant = (status: BroadcastRecipientStatus) =>
  status === "SENT"
    ? "default"
    : status === "FAILED"
      ? "destructive"
      : "secondary"

const formatRecipientStatus = (
  status: BroadcastRecipientStatus,
  messages: ReturnType<typeof getMessages>["console"]["whatsapp"]["broadcasts"]
) => {
  switch (status) {
    case "SENT":
      return messages.detail.sent
    case "QUEUED":
      return messages.detail.queued
    case "FAILED":
      return messages.detail.failed
    default:
      return status
  }
}

const isDraftBroadcast = (broadcast?: Broadcast | null) =>
  Boolean(broadcast && broadcast.status === "QUEUED" && !broadcast.startedAt)

const formatBroadcastStatus = (
  broadcast: Broadcast,
  messages: ReturnType<typeof getMessages>["console"]["whatsapp"]["broadcasts"]
) => {
  if (isDraftBroadcast(broadcast)) {
    return messages.detail.draftReady
  }

  switch (broadcast.status) {
    case "QUEUED":
      return messages.status.queued
    case "PROCESSING":
      return messages.status.processing
    case "COMPLETED":
      return messages.status.completed
    case "COMPLETED_WITH_ERRORS":
      return messages.status.completedWithErrors
    default: {
      const rawStatus: string = broadcast.status
      return rawStatus.replaceAll("_", " ")
    }
  }
}

const escapeCsvCell = (value: string) =>
  /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value

const downloadFailedRecipientsCsv = (
  recipients: BroadcastRecipient[],
  broadcastId: string
) => {
  const header = ["phoneNumber", "name", "lastError", "updatedAt"]
  const rows = recipients.map((recipient) =>
    [
      recipient.phoneNumber,
      recipient.name ?? "",
      recipient.lastError ?? "",
      recipient.updatedAt,
    ]
      .map(escapeCsvCell)
      .join(",")
  )
  const csv = [header.join(","), ...rows].join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `failed-broadcast-${broadcastId}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

const formatDuration = (startedAt?: string | null, endedAt?: string | null) => {
  if (!startedAt) return null
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  const diffSec = Math.max(0, Math.round((end - start) / 1000))
  if (diffSec < 60) return `~${diffSec}s`
  const min = Math.floor(diffSec / 60)
  const sec = diffSec % 60
  return `${min}m ${sec}s`
}

export default function WhatsAppBroadcastDetailPage() {
  const router = useRouter()
  const params = useParams<{ lang?: string; id: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const t = getMessages(locale).console.whatsapp.broadcasts
  const recipientFilters: Array<{ value: RecipientFilter; label: string }> = [
    { value: "ALL", label: t.detail.all },
    { value: "QUEUED", label: t.detail.queued },
    { value: "SENT", label: t.detail.sent },
    { value: "FAILED", label: t.detail.failed },
  ]
  const [broadcast, setBroadcast] = React.useState<Broadcast | null>(null)
  const [template, setTemplate] = React.useState<Template | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [sending, setSending] = React.useState(false)
  const [filter, setFilter] = React.useState<RecipientFilter>("ALL")
  const [search, setSearch] = React.useState("")

  React.useEffect(() => {
    let active = true
    whatsappClient
      .getBroadcast(params.id)
      .then((data) => {
        if (active) {
          setBroadcast(data)
          setLoading(false)
          if (data.templateId) {
            whatsappClient
              .getTemplate(data.templateId)
              .then((tpl) => {
                if (active) setTemplate(tpl)
              })
              .catch(() => {
                // non-blocking
              })
          }
        }
      })
      .catch((error) => {
        if (active) {
          toast.error(
            error instanceof Error ? error.message : t.detail.loadError
          )
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [params.id, t.detail.loadError])

  async function handleSend() {
    if (!broadcast) return
    setSending(true)
    try {
      const message = await whatsappClient.sendBroadcast(broadcast.id)
      toast.success(message || t.list.send)
      setBroadcast((prev) => (prev ? { ...prev, status: "PROCESSING" } : null))
      const fresh = await whatsappClient.getBroadcast(params.id)
      setBroadcast(fresh)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.list.sendError)
    } finally {
      setSending(false)
    }
  }

  const recipients = React.useMemo<BroadcastRecipient[]>(() => {
    const query = search.trim().toLowerCase()
    return (broadcast?.recipients ?? []).filter((recipient) => {
      const matchesStatus = filter === "ALL" || recipient.status === filter
      const matchesSearch =
        query.length === 0 ||
        recipient.phoneNumber.toLowerCase().includes(query) ||
        (recipient.name ?? "").toLowerCase().includes(query)

      return matchesStatus && matchesSearch
    })
  }, [broadcast?.recipients, filter, search])

  const failedRecipients = React.useMemo<BroadcastRecipient[]>(
    () =>
      (broadcast?.recipients ?? []).filter(
        (recipient) => recipient.status === "FAILED"
      ),
    [broadcast?.recipients]
  )

  const progress = broadcast?.total
    ? Math.round(((broadcast.sent + broadcast.failed) / broadcast.total) * 100)
    : 0

  const isDraft = isDraftBroadcast(broadcast)

  const templateLanguageData = React.useMemo(() => {
    if (!template || !broadcast) return null
    return (
      template.languages.find((l) => l.lang === broadcast.templateLanguage) ??
      template.languages[0]
    )
  }, [template, broadcast])

  const executionDuration = formatDuration(
    broadcast?.startedAt,
    broadcast?.endedAt
  )

  const templatePreviewValues = React.useMemo<
    Record<number, string> | undefined
  >(() => {
    const params = broadcast?.templateParams
    if (!params) return undefined
    const result: Record<number, string> = {}
    for (const [key, val] of Object.entries(params)) {
      const match = key.match(/\d+/)
      if (match && val !== null && val !== undefined) {
        result[Number(match[0])] = String(val)
      }
    }
    return Object.keys(result).length > 0 ? result : undefined
  }, [broadcast])

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id)
    toast.success(t.detail.messageIdCopied)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {broadcast?.templateName ?? t.detail.fallbackTitle}
          </h1>
          <p className="text-muted-foreground">{t.detail.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isDraft && (
            <Button onClick={() => void handleSend()} disabled={sending}>
              <PaperPlaneTilt weight="bold" className="mr-2 size-4" />
              {sending ? t.detail.sendingBroadcast : t.detail.sendBroadcast}
            </Button>
          )}
          <Button
            variant="outline"
            disabled={!broadcast || broadcast.failed === 0}
            onClick={() => {
              if (!broadcast) return
              downloadFailedRecipientsCsv(failedRecipients, broadcast.id)
            }}
          >
            <DownloadSimple weight="bold" className="size-4" />
            {t.detail.downloadFailed}
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            {t.detail.back}
          </Button>
        </div>
      </div>
      {loading ? (
        <Card>
          <CardContent className="py-8">{t.detail.loading}</CardContent>
        </Card>
      ) : !broadcast ? (
        <Card>
          <CardContent className="py-8">{t.detail.notFound}</CardContent>
        </Card>
      ) : (
        <>
          {isDraft && (
            <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <Info className="size-5 text-amber-600 dark:text-amber-400" />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <AlertTitle className="font-semibold text-amber-950 dark:text-amber-100">
                    {t.detail.draftBannerTitle}
                  </AlertTitle>
                  <AlertDescription className="text-amber-800 dark:text-amber-300">
                    {t.detail.draftBannerDescription}
                  </AlertDescription>
                </div>
                <Button
                  size="sm"
                  className="shrink-0 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400"
                  disabled={sending}
                  onClick={() => void handleSend()}
                >
                  <PaperPlaneTilt weight="bold" className="mr-1.5 size-4" />
                  {sending ? t.detail.sendingBroadcast : t.detail.sendBroadcast}
                </Button>
              </div>
            </Alert>
          )}
          {/* 3-Zone Executive & Audit Layout */}

          {/* Metric Overview Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Sender Device Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t.detail.senderDevice}
                </CardTitle>
                <DeviceMobile className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {broadcast.whatsappDevice ? (
                  <div className="space-y-1">
                    <div className="text-xl font-bold">
                      {broadcast.whatsappDevice.phoneNumber}
                    </div>
                    {broadcast.whatsappDevice.verifiedName ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle
                          weight="fill"
                          className="size-3.5 text-emerald-600 dark:text-emerald-400"
                        />
                        <span>{broadcast.whatsappDevice.verifiedName}</span>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-base text-muted-foreground">
                    {t.detail.noDevice}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Execution Window Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t.detail.executionWindow}
                </CardTitle>
                <Timer className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {executionDuration ?? t.detail.notStarted}
                </div>
                <div className="text-xs text-muted-foreground">
                  {broadcast.startedAt
                    ? formatDate(broadcast.startedAt)
                    : formatDate(broadcast.createdAt)}
                </div>
              </CardContent>
            </Card>

            {/* Speed and Throttling Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t.detail.speedAndThrottle}
                </CardTitle>
                <Speedometer className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {broadcast.throttleMaxMessages && broadcast.throttlePerMinutes
                    ? t.detail.throttleRate
                        .replace("{max}", String(broadcast.throttleMaxMessages))
                        .replace(
                          "{period}",
                          String(broadcast.throttlePerMinutes)
                        )
                    : t.detail.noThrottle}
                </div>
                <div className="text-xs text-muted-foreground">
                  {broadcast.sent} / {broadcast.total}{" "}
                  {t.detail.sent.toLowerCase()}
                </div>
              </CardContent>
            </Card>

            {/* Total Recipients & Progress */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t.detail.totalRecipients}
                </CardTitle>
                <span className="text-sm font-bold text-primary">
                  {progress}%
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{broadcast.total}</div>
                <div className="text-xs text-muted-foreground">
                  {broadcast.sent} {t.detail.sent.toLowerCase()} •{" "}
                  {broadcast.failed} {t.detail.failed.toLowerCase()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle Zone: WhatsApp Message Preview & Campaign Configuration */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Live WhatsApp Bubble Preview */}
            <div className="lg:col-span-7">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{t.detail.previewTitle}</CardTitle>
                  <CardDescription>
                    {t.detail.previewDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col justify-center">
                  {templateLanguageData ? (
                    <WhatsAppTemplatePreview
                      language={{
                        ...templateLanguageData,
                        metaStatus:
                          templateLanguageData.metaStatus ?? undefined,
                        parameters:
                          templateLanguageData.parameters ?? undefined,
                      }}
                      values={templatePreviewValues}
                      mode="full"
                    />
                  ) : (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      <p>{t.detail.noPreview}</p>
                      <p className="mt-1 font-mono text-xs">
                        {broadcast.templateName} ({broadcast.templateLanguage})
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Campaign Parameters & Configuration */}
            <div className="lg:col-span-5">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{t.detail.campaignConfiguration}</CardTitle>
                  <CardDescription>{t.detail.templateDetails}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">
                      {t.detail.templateCategory}
                    </span>
                    <Badge variant="outline">
                      {typeof broadcast.templateParams?.category === "string"
                        ? broadcast.templateParams.category
                        : (template?.category ?? "MARKETING")}
                    </Badge>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">
                      {t.detail.templateLanguage}
                    </span>
                    <span className="font-mono font-medium">
                      {broadcast.templateLanguage}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Template ID</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {broadcast.templateId ?? "—"}
                    </span>
                  </div>
                  {broadcast.startedAt && (
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">
                        {t.detail.executionWindow}
                      </span>
                      <span className="text-xs">
                        {formatDate(broadcast.startedAt)}
                      </span>
                    </div>
                  )}
                  {broadcast.endedAt && (
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">
                        {t.detail.sentAt}
                      </span>
                      <span className="text-xs">
                        {formatDate(broadcast.endedAt)}
                      </span>
                    </div>
                  )}
                  <div className="space-y-1.5 pt-1">
                    <span className="font-medium text-muted-foreground">
                      {t.detail.dynamicVariables}
                    </span>
                    {broadcast.templateParams &&
                    Object.keys(broadcast.templateParams).length > 0 ? (
                      <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">
                        {JSON.stringify(broadcast.templateParams, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        {t.detail.noVariables}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CardTitle>{t.detail.campaignProgress}</CardTitle>
                <Badge
                  variant={isDraft ? "secondary" : "default"}
                  className={
                    isDraft
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      : undefined
                  }
                >
                  {formatBroadcastStatus(broadcast, t)}
                </Badge>
              </div>
              <CardDescription>
                {broadcast.templateLanguage} •{" "}
                {t.detail.createdAt.replace(
                  "{date}",
                  formatDate(broadcast.createdAt)
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">
                    {t.detail.totalRecipients}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {broadcast.total}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {t.detail.sent}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-emerald-600 dark:text-emerald-400"
                    >
                      {t.detail.sent}
                    </Badge>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                    {broadcast.sent}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {t.detail.queued}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-amber-600 dark:text-amber-400"
                    >
                      {t.detail.queued}
                    </Badge>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-amber-600 dark:text-amber-400">
                    {broadcast.queued}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {t.detail.failed}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-red-600 dark:text-red-400"
                    >
                      {t.detail.failed}
                    </Badge>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-red-600 dark:text-red-400">
                    {broadcast.failed}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t.detail.deliveryProgress}
                  </span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t.detail.progressTiming
                    .replace("{progress}", String(progress))
                    .replace("{startedAt}", formatDate(broadcast.startedAt))
                    .replace("{endedAt}", formatDate(broadcast.endedAt))}
                </p>
              </div>
            </CardContent>
          </Card>

          <TooltipProvider>
            <Card>
              <CardHeader>
                <CardTitle>{t.detail.recipientList}</CardTitle>
                <CardDescription>
                  {t.detail.recipientListDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full sm:max-w-xs">
                    <MagnifyingGlass className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t.detail.searchPlaceholder}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Tabs
                    value={filter}
                    onValueChange={(value) =>
                      setFilter(value as RecipientFilter)
                    }
                  >
                    <TabsList aria-label={t.detail.recipientFilterLabel}>
                      {recipientFilters.map(({ value, label }) => (
                        <TabsTrigger key={value} value={value} className="px-3">
                          {label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.detail.phoneNumber}</TableHead>
                      <TableHead>{t.detail.name}</TableHead>
                      <TableHead>{t.detail.status}</TableHead>
                      <TableHead>{t.detail.sentAt}</TableHead>
                      <TableHead>{t.detail.error}</TableHead>
                      <TableHead className="text-right">
                        {t.list.actions}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          {t.detail.noRecipients}
                        </TableCell>
                      </TableRow>
                    ) : (
                      recipients.map((recipient) => (
                        <TableRow key={recipient.id}>
                          <TableCell>
                            <Link
                              href={`${localizePathname({
                                pathname: "/console/whatsapp/messages",
                                locale,
                              })}?phone=${encodeURIComponent(
                                recipient.phoneNumber.replace(/^\+/, "")
                              )}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {recipient.phoneNumber}
                            </Link>
                          </TableCell>
                          <TableCell>{recipient.name ?? "—"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant={recipientBadgeVariant(
                                  recipient.status
                                )}
                              >
                                {formatRecipientStatus(recipient.status, t)}
                              </Badge>
                              {recipient.attempts > 1 && (
                                <span className="text-[11px] text-muted-foreground">
                                  ({recipient.attempts}x)
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                            {formatDate(
                              recipient.updatedAt ?? recipient.createdAt
                            )}
                          </TableCell>
                          <TableCell className="max-w-64">
                            {recipient.lastError ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="block cursor-default truncate text-xs text-destructive">
                                    {recipient.lastError}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-80 break-words">
                                  <p>{recipient.lastError}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                asChild
                              >
                                <Link
                                  href={`${localizePathname({
                                    pathname: "/console/whatsapp/messages",
                                    locale,
                                  })}?phone=${encodeURIComponent(
                                    recipient.phoneNumber.replace(/^\+/, "")
                                  )}`}
                                >
                                  {t.detail.openChat}
                                </Link>
                              </Button>
                              {recipient.waMessageId && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="size-7 p-0"
                                      onClick={() =>
                                        copyId(recipient.waMessageId!)
                                      }
                                    >
                                      <Copy className="size-3.5 text-muted-foreground" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-mono text-[10px]">
                                      {t.detail.copyMessageId}
                                    </p>
                                    <p className="font-mono text-[9px] text-muted-foreground">
                                      {recipient.waMessageId}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TooltipProvider>
        </>
      )}
    </div>
  )
}
