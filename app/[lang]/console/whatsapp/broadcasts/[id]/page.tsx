"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
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
  status === "SENT" ? "default" : status === "FAILED" ? "destructive" : "secondary"

export default function WhatsAppBroadcastDetailPage() {
  const router = useRouter()
  const params = useParams<{ lang?: string; id: string }>()
  resolveLocaleOrDefault(params?.lang)
  const [broadcast, setBroadcast] = React.useState<Broadcast | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<RecipientFilter>("ALL")

  const loadBroadcast = React.useCallback(async () => {
    setLoading(true)
    try {
      setBroadcast(await whatsappClient.getBroadcast(params.id))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load broadcast")
    } finally {
      setLoading(false)
    }
  }, [params.id])

  React.useEffect(() => {
    ;(async () => {
      await loadBroadcast()
    })()
  }, [loadBroadcast])

  const recipients = React.useMemo<BroadcastRecipient[]>(() => {
    const items = broadcast?.recipients ?? []
    if (filter === "ALL") {
      return items
    }

    return items.filter((recipient) => recipient.status === filter)
  }, [broadcast?.recipients, filter])

  const progress = broadcast?.total
    ? Math.round(((broadcast.sent + broadcast.failed) / broadcast.total) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {broadcast?.templateName ?? "Broadcast detail"}
          </h1>
          <p className="text-muted-foreground">
            Delivery status and recipient-level results.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8">Loading broadcast…</CardContent>
        </Card>
      ) : !broadcast ? (
        <Card>
          <CardContent className="py-8">Broadcast not found.</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Campaign progress</CardTitle>
              <CardDescription>
                {broadcast.templateLanguage} • created {formatDate(broadcast.createdAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className="mt-2">{broadcast.status.replaceAll("_", " ")}</Badge>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Sent</p>
                  <p className="text-2xl font-semibold">{broadcast.sent}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-semibold">{broadcast.failed}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-semibold">{broadcast.total}</p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {progress}% complete • started {formatDate(broadcast.startedAt)} • ended {formatDate(broadcast.endedAt)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recipients</CardTitle>
                <CardDescription>
                  Filter recipients by delivery status.
                </CardDescription>
              </div>
              <Select
                value={filter}
                onValueChange={(value) => setFilter(value as RecipientFilter)}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="QUEUED">Queued</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone</TableHead>
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
                          <Badge variant={recipientBadgeVariant(recipient.status)}>
                            {recipient.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{recipient.attempts}</TableCell>
                        <TableCell className="max-w-48 truncate">
                          {recipient.waMessageId ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-64 truncate">
                          {recipient.lastError ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
