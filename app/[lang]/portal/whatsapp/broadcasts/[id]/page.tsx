"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
  DownloadSimple,
  MagnifyingGlass,
  PaperPlaneTilt,
  Info,
} from "@phosphor-icons/react"
import { toast } from "sonner"

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
import {
  whatsappClient,
  type Broadcast,
  type BroadcastRecipient,
  type BroadcastRecipientStatus,
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

const formatRecipientStatus = (status: BroadcastRecipientStatus) => {
  switch (status) {
    case "SENT":
      return "Sent"
    case "QUEUED":
      return "Queued"
    case "FAILED":
      return "Failed"
    default:
      return status
  }
}

const isDraftBroadcast = (broadcast: Broadcast) =>
  broadcast.status === "QUEUED" && broadcast.startedAt === null

const formatBroadcastStatus = (broadcast: Broadcast) => {
  if (isDraftBroadcast(broadcast)) {
    return "Draft / Ready to Send"
  }
  switch (broadcast.status) {
    case "QUEUED":
      return "Queued"
    case "PROCESSING":
      return "Processing"
    case "COMPLETED":
      return "Completed"
    case "COMPLETED_WITH_ERRORS":
      return "Completed with Errors"
    default:
      return broadcast.status.replaceAll("_", " ")
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

export default function PortalWhatsAppBroadcastDetailPage() {
  const router = useRouter()
  const params = useParams<{ lang?: string; id: string }>()
  const recipientFilters: Array<{ value: RecipientFilter; label: string }> = [
    { value: "ALL", label: "All" },
    { value: "QUEUED", label: "Queued" },
    { value: "SENT", label: "Sent" },
    { value: "FAILED", label: "Failed" },
  ]
  const [broadcast, setBroadcast] = React.useState<Broadcast | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [isSending, setIsSending] = React.useState(false)
  const [filter, setFilter] = React.useState<RecipientFilter>("ALL")
  const [search, setSearch] = React.useState("")

  const loadBroadcast = React.useCallback(async () => {
    setLoading(true)
    try {
      setBroadcast(await whatsappClient.getBroadcast(params.id))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load broadcast"
      )
    } finally {
      setLoading(false)
    }
  }, [params.id])

  React.useEffect(() => {
    ;(async () => {
      await loadBroadcast()
    })()
  }, [loadBroadcast])

  const handleSend = React.useCallback(async () => {
    if (!broadcast) return
    setIsSending(true)
    try {
      const message = await whatsappClient.sendBroadcast(broadcast.id)
      toast.success(message)
      await loadBroadcast()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to send broadcast"
      )
    } finally {
      setIsSending(false)
    }
  }, [broadcast, loadBroadcast])

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

  const isDraft = broadcast ? isDraftBroadcast(broadcast) : false

  const progress = broadcast?.total
    ? Math.round(((broadcast.sent + broadcast.failed) / broadcast.total) * 100)
    : 0

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {broadcast?.templateName ?? "Broadcast details"}
          </h1>
          <p className="text-muted-foreground">
            Monitor delivery progress and recipient status.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isDraft && (
            <Button disabled={isSending} onClick={() => void handleSend()}>
              <PaperPlaneTilt weight="bold" className="mr-1 size-4" />
              {isSending ? "Sending..." : "Send Broadcast"}
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
            <DownloadSimple weight="bold" className="mr-1 size-4" />
            Download failed
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Back
          </Button>
        </div>
      </div>

      {isDraft && (
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-4 text-primary">
          <div className="flex items-center gap-3">
            <Info className="size-5 shrink-0" />
            <div>
              <p className="font-medium text-foreground">
                Broadcast Draft Ready to Send
              </p>
              <p className="text-sm text-muted-foreground">
                This campaign has {broadcast?.total ?? 0} queued recipient(s).
                Click &quot;Send Broadcast&quot; when you are ready to initiate
                message delivery.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            disabled={isSending}
            onClick={() => void handleSend()}
          >
            <PaperPlaneTilt className="mr-1 size-4" />
            {isSending ? "Sending..." : "Send Broadcast"}
          </Button>
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-8">
            Loading broadcast details...
          </CardContent>
        </Card>
      ) : !broadcast ? (
        <Card>
          <CardContent className="py-8">Broadcast not found.</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CardTitle>Campaign Progress</CardTitle>
                <Badge variant={isDraft ? "secondary" : "default"}>
                  {formatBroadcastStatus(broadcast)}
                </Badge>
              </div>
              <CardDescription>
                {broadcast.templateLanguage} • Created at{" "}
                {formatDate(broadcast.createdAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">
                    Total Recipients
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {broadcast.total}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">Sent</p>
                    <Badge
                      variant="outline"
                      className="text-emerald-600 dark:text-emerald-400"
                    >
                      Sent
                    </Badge>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                    {broadcast.sent}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">Queued</p>
                    <Badge
                      variant="outline"
                      className="text-amber-600 dark:text-amber-400"
                    >
                      Queued
                    </Badge>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-amber-600 dark:text-amber-400">
                    {broadcast.queued}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">Failed</p>
                    <Badge variant="outline" className="text-destructive">
                      Failed
                    </Badge>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-destructive">
                    {broadcast.failed}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Delivery Progress
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
                  {progress}% complete (Started:{" "}
                  {formatDate(broadcast.startedAt)}, Ended:{" "}
                  {formatDate(broadcast.endedAt)})
                </p>
              </div>
            </CardContent>
          </Card>

          <TooltipProvider>
            <Card>
              <CardHeader>
                <CardTitle>Recipient list</CardTitle>
                <CardDescription>
                  List of recipients, message dispatch status, and errors.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full sm:max-w-xs">
                    <MagnifyingGlass className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search recipient..."
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
                    <TabsList aria-label="Recipient filter">
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
                      <TableHead>Phone number</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Message ID</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>No recipients found.</TableCell>
                      </TableRow>
                    ) : (
                      recipients.map((recipient) => (
                        <TableRow key={recipient.id}>
                          <TableCell>{recipient.phoneNumber}</TableCell>
                          <TableCell>{recipient.name ?? "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={recipientBadgeVariant(recipient.status)}
                            >
                              {formatRecipientStatus(recipient.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>{recipient.attempts}</TableCell>
                          <TableCell className="max-w-48 truncate">
                            {recipient.waMessageId ?? "—"}
                          </TableCell>
                          <TableCell className="max-w-64">
                            {recipient.lastError ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="block cursor-default truncate text-destructive">
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
    </main>
  )
}
