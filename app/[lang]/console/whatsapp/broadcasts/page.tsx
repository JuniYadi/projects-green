"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Plus, Trash, PaperPlaneTilt, Eye } from "@phosphor-icons/react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  whatsappClient,
  type Broadcast,
  type BroadcastStatus,
} from "@/modules/whatsapp/whatsapp-client"

const statusVariant = (status: BroadcastStatus) => {
  if (status === "COMPLETED") return "default"
  if (status === "COMPLETED_WITH_ERRORS") return "secondary"
  if (status === "PROCESSING") return "outline"
  return "secondary"
}

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "—"

export default function WhatsAppBroadcastsPage() {
  const router = useRouter()
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const basePath = localizePathname({
    pathname: "/console/whatsapp/broadcasts",
    locale,
  })
  const [broadcasts, setBroadcasts] = React.useState<Broadcast[]>([])
  const [loading, setLoading] = React.useState(true)

  const loadBroadcasts = React.useCallback(async () => {
    setLoading(true)
    try {
      setBroadcasts(await whatsappClient.listBroadcasts())
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load broadcasts"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    ;(async () => {
      await loadBroadcasts()
    })()
  }, [loadBroadcasts])

  const handleSend = async (broadcast: Broadcast) => {
    try {
      const message = await whatsappClient.sendBroadcast(broadcast.id)
      toast.success(message)
      await loadBroadcasts()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to send broadcast"
      )
    }
  }

  const handleDelete = async (broadcast: Broadcast) => {
    if (!window.confirm(`Delete broadcast ${broadcast.templateName}?`)) {
      return
    }

    try {
      await whatsappClient.deleteBroadcast(broadcast.id)
      toast.success("Broadcast deleted")
      await loadBroadcasts()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete broadcast"
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Broadcasts</h1>
          <p className="text-muted-foreground">
            Create, send, and monitor WhatsApp template broadcasts.
          </p>
        </div>
        <Button onClick={() => router.push(`${basePath}/new`)}>
          <Plus weight="bold" className="mr-2 size-4" />
          New broadcast
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
          <CardDescription>
            Broadcast campaigns with delivery progress and status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5}>Loading broadcasts…</TableCell>
                </TableRow>
              ) : broadcasts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>No broadcasts yet.</TableCell>
                </TableRow>
              ) : (
                broadcasts.map((broadcast) => (
                  <TableRow key={broadcast.id}>
                    <TableCell>
                      <div className="font-medium">
                        {broadcast.templateName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {broadcast.templateLanguage}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(broadcast.status)}>
                        {broadcast.status.replaceAll("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {broadcast.sent} sent / {broadcast.failed} failed /{" "}
                      {broadcast.total} total
                    </TableCell>
                    <TableCell>{formatDate(broadcast.createdAt)}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          router.push(`${basePath}/${broadcast.id}`)
                        }
                      >
                        <Eye className="mr-1 size-4" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={broadcast.status !== "QUEUED"}
                        onClick={() => void handleSend(broadcast)}
                      >
                        <PaperPlaneTilt className="mr-1 size-4" />
                        Send
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void handleDelete(broadcast)}
                      >
                        <Trash className="mr-1 size-4" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
