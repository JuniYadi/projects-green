"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Plus, Trash, PaperPlaneTilt, Eye } from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

import { eden } from "@/lib/eden"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { type ColumnDef } from "@tanstack/react-table"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getMessages } from "@/lib/i18n/messages"
import {
  whatsappClient,
  type Broadcast,
  type BroadcastStatus,
} from "@/modules/whatsapp/whatsapp-client"
import { useWhatsAppOnboarding } from "@/modules/whatsapp/onboarding/use-whatsapp-onboarding"
import { LockedFeatureTeaser } from "@/modules/whatsapp/onboarding/locked-feature-teaser"
import { FlightHudWidget } from "@/modules/whatsapp/onboarding/flight-hud-widget"
const isDraftBroadcast = (broadcast?: Broadcast | null) =>
  Boolean(broadcast && broadcast.status === "QUEUED" && !broadcast.startedAt)

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
  const messages = getMessages(locale)
  const t = messages.console.whatsapp.broadcasts
  const tLocked = messages.console.whatsapp.onboarding.lockedFeatures.broadcasts
  const basePath = localizePathname({
    pathname: "/console/whatsapp/broadcasts",
    locale,
  })
  const [broadcasts, setBroadcasts] = React.useState<Broadcast[]>([])
  const [loading, setLoading] = React.useState(true)
  const onboarding = useWhatsAppOnboarding({ locale })
  const [sendCandidate, setSendCandidate] = React.useState<Broadcast | null>(
    null
  )
  const [preflight, setPreflight] = React.useState<Record<
    string,
    unknown
  > | null>(null)
  const [preflightLoading, setPreflightLoading] = React.useState(false)
  const [preflightError, setPreflightError] = React.useState<string | null>(
    null
  )
  const loadBroadcasts = React.useCallback(async () => {
    setLoading(true)
    try {
      setBroadcasts(await whatsappClient.listBroadcasts())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.list.loadError)
    } finally {
      setLoading(false)
    }
  }, [t.list.loadError])

  React.useEffect(() => {
    ;(async () => {
      await loadBroadcasts()
    })()
  }, [loadBroadcasts])

  const runPreflight = React.useCallback(async (broadcast: Broadcast) => {
    setSendCandidate(broadcast)
    setPreflight(null)
    setPreflightError(null)
    setPreflightLoading(true)
    try {
      const res = await eden.api.console.ai["agent-p"].execute.post({
        toolName: "whatsapp.broadcast.preflight",
        input: { broadcastId: broadcast.id },
      })
      const data = res.data as
        | { success?: boolean; data?: Record<string, unknown>; error?: string }
        | undefined
      if (res.error || !data?.success || !data?.data) {
        throw new Error(String(data?.error || res.error || "Preflight failed"))
      }
      setPreflight(data.data)
    } catch (error) {
      setPreflightError(
        error instanceof Error ? error.message : "Preflight failed"
      )
    } finally {
      setPreflightLoading(false)
    }
  }, [])

  const handleSendClick = React.useCallback(
    (broadcast: Broadcast) => void runPreflight(broadcast),
    [runPreflight]
  )

  const confirmSend = React.useCallback(async () => {
    if (!sendCandidate) return
    const candidate = sendCandidate
    setSendCandidate(null)
    try {
      const message = await whatsappClient.sendBroadcast(candidate.id)
      toast.success(message)
      await loadBroadcasts()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.list.sendError)
    }
  }, [loadBroadcasts, sendCandidate, t.list.sendError])

  const handleDelete = React.useCallback(
    async (broadcast: Broadcast) => {
      if (
        !window.confirm(
          t.list.deleteConfirmation.replace("{name}", broadcast.templateName)
        )
      ) {
        return
      }

      try {
        await whatsappClient.deleteBroadcast(broadcast.id)
        toast.success(t.list.deleted)
        await loadBroadcasts()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t.list.deleteError)
      }
    },
    [loadBroadcasts, t.list]
  )

  const columns = React.useMemo<ColumnDef<Broadcast>[]>(() => {
    return [
      {
        id: "templateName",
        accessorFn: (row) => row.templateName,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.columnTemplate} />
        ),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.templateName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.templateLanguage}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.columnStatus} />
        ),
        cell: ({ row }) => {
          const isDraft = isDraftBroadcast(row.original)
          if (isDraft) {
            return (
              <Badge
                variant="secondary"
                className="border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300"
              >
                {t.status.draftReady || "Draf / Siap Kirim"}
              </Badge>
            )
          }
          return (
            <Badge variant={statusVariant(row.original.status)}>
              {row.original.status.replaceAll("_", " ")}
            </Badge>
          )
        },
      },
      {
        id: "progress",
        accessorFn: (row) => row.sent,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.columnProgress} />
        ),
        cell: ({ row }) => (
          <span>
            {t.list.progress
              .replace("{sent}", String(row.original.sent))
              .replace("{failed}", String(row.original.failed))
              .replace("{total}", String(row.original.total))}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.columnCreatedAt} />
        ),
        cell: ({ row }) => <span>{formatDate(row.original.createdAt)}</span>,
      },
      {
        id: "actions",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.list.actions} />
        ),
        cell: ({ row }) => {
          const isDraft = isDraftBroadcast(row.original)
          return (
            <div className="flex justify-end space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`${basePath}/${row.original.id}`)}
              >
                <Eye className="mr-1 size-4" />
                {t.list.view}
              </Button>
              <Button
                size="sm"
                variant={isDraft ? "default" : "outline"}
                disabled={row.original.status !== "QUEUED"}
                onClick={() => handleSendClick(row.original)}
              >
                <PaperPlaneTilt className="mr-1 size-4" />
                {t.list.send}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void handleDelete(row.original)}
              >
                <Trash className="mr-1 size-4" />
                {t.list.delete}
              </Button>
            </div>
          )
        },
        enableHiding: false,
      },
    ]
  }, [basePath, handleDelete, handleSendClick, router, t])

  if (onboarding.isFeatureLocked("broadcasts")) {
    return (
      <>
        <LockedFeatureTeaser
          featureTitle={tLocked.title}
          featureDescription={tLocked.description}
          unlockLevel={2}
          prerequisiteDescription={tLocked.prerequisite}
          activeMissionHref="/console/whatsapp/messages"
          activeMissionLabel={tLocked.activeLabel}
          locale={locale}
        />
        <FlightHudWidget onboarding={onboarding} locale={locale} />
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.heading}</h1>
          <p className="text-muted-foreground">{t.description}</p>
        </div>
        <Button onClick={() => router.push(`${basePath}/new`)}>
          <Plus weight="bold" className="mr-2 size-4" />
          {t.createBroadcast}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.list.campaigns}</CardTitle>
          <CardDescription>{t.list.campaignsDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              {t.list.loading}
            </div>
          ) : (
            <DataTable
              tableId="console-whatsapp-broadcasts"
              columns={columns}
              data={broadcasts}
              searchableColumns={["templateName"]}
              searchPlaceholder={t.searchPlaceholder}
              defaultColumnVisibility={{ createdAt: false }}
              emptyMessage={t.emptyTitle}
            />
          )}
        </CardContent>
      </Card>
      <Dialog
        open={sendCandidate !== null}
        onOpenChange={(open) => !open && setSendCandidate(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Broadcast preflight</DialogTitle>
            <DialogDescription>
              Review recipients, estimated cost versus balance, and template
              variables.
            </DialogDescription>
          </DialogHeader>
          {preflightLoading && (
            <p className="text-sm text-muted-foreground">Checking broadcast…</p>
          )}
          {preflightError && (
            <p className="text-sm text-destructive">{preflightError}</p>
          )}
          {preflight && (
            <div className="space-y-2 text-sm">
              <p>Recipients: {String(preflight.recipientCount ?? 0)}</p>
              <p>Estimated cost vs balance: verified before dispatch.</p>
              <p>
                Template variables:{" "}
                {preflight.valid === true ? "Complete" : "Incomplete"}
              </p>
              {Array.isArray(preflight.issues) && (
                <ul className="list-disc pl-5">
                  {preflight.issues.map((issue) => (
                    <li key={String(issue)}>{String(issue)}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendCandidate(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void confirmSend()}
              disabled={
                preflightLoading || !preflight || preflight.valid !== true
              }
            >
              Send broadcast
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
