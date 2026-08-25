"use client"
import {
  getWhatsAppText,
  WhatsAppText,
} from "@/modules/whatsapp/ui/whatsapp-text"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Copy,
  Check,
  WarningCircle,
  ArrowsClockwise,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { eden } from "@/lib/eden"
import type { WhatsappMessageJourneyDTO } from "@/modules/whatsapp/messages/messages.dto"
import { MessageJourneyTimeline } from "@/modules/whatsapp/messages/ui/message-journey-timeline"
import { MessageChatPreview } from "@/modules/whatsapp/messages/ui/message-chat-preview"

export default function ConsoleWhatsAppMessageJourneyPage() {
  const params = useParams<{ lang: string; waMessageId: string }>()
  const router = useRouter()
  const waMessageId = params?.waMessageId
    ? decodeURIComponent(params.waMessageId)
    : ""

  const [journey, setJourney] =
    React.useState<WhatsappMessageJourneyDTO | null>(null)
  const [pageState, setPageState] = React.useState<
    "loading" | "error" | "loaded"
  >("loading")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [copied, setCopied] = React.useState(false)

  const loadJourney = React.useCallback(async () => {
    if (!waMessageId) return
    setPageState("loading")
    setErrorMessage("")
    try {
      const res = await eden.api.whatsapp.messages.journey[waMessageId].get()
      const data = res.data as unknown as {
        ok: boolean
        data: WhatsappMessageJourneyDTO
        message?: string
      } | null
      const error = res.error as unknown as { message?: string } | null

      if (error || !data || !data.ok) {
        throw new Error(
          error?.message ?? data?.message ?? "Failed to load message journey"
        )
      }

      setJourney(data.data)
      setPageState("loaded")
    } catch (_err) {
      setErrorMessage(
        _err instanceof Error ? _err.message : "Failed to load message journey"
      )
      setPageState("error")
    }
  }, [waMessageId])
  React.useEffect(() => {
    ;(async () => {
      await loadJourney()
    })()
  }, [loadJourney])

  const handleCopyId = async () => {
    if (!waMessageId) return
    try {
      await navigator.clipboard.writeText(waMessageId)
      setCopied(true)
      toast.success("WA Message ID copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy ID")
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      {/* Top Navigation */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="gap-1.5"
        >
          <ArrowLeft className="size-4" />
          <WhatsAppText id="s119" />
        </Button>
      </div>

      {pageState === "loading" && (
        <div className="space-y-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-96 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </div>
      )}

      {pageState === "error" && (
        <Card className="border-destructive/30 bg-destructive/5 py-12 text-center">
          <CardContent className="space-y-3">
            <WarningCircle className="mx-auto size-10 text-destructive" />
            <p className="text-sm font-medium text-destructive">
              {errorMessage}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={loadJourney}
              className="gap-2"
            >
              <ArrowsClockwise className="size-4" />
              <WhatsAppText id="s101" />
            </Button>
          </CardContent>
        </Card>
      )}

      {pageState === "loaded" && journey && (
        <div className="space-y-6">
          {/* Header Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">
                    <WhatsAppText id="s120" />
                  </CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-foreground">
                      {waMessageId}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                      title={getWhatsAppText("s121")}
                    >
                      {copied ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  {journey.billing?.category && (
                    <Badge variant="outline" className="text-xs">
                      {journey.billing.category}
                    </Badge>
                  )}
                  {journey.audit?.origin && (
                    <Badge variant="secondary" className="text-xs">
                      Origin: {journey.audit.origin}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Main 2-Column Split: Journey Timeline (Left) & Chat Preview (Right) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Message Journey Timeline */}
            <div className="lg:col-span-7">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base">
                    <WhatsAppText id="s122" />
                  </CardTitle>
                  <CardDescription>
                    <WhatsAppText id="s123" />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MessageJourneyTimeline journey={journey} />
                </CardContent>
              </Card>
            </div>

            {/* Right: Preview & Details */}
            <div className="space-y-6 lg:col-span-5">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    <WhatsAppText id="s124" />
                  </CardTitle>
                  <CardDescription>
                    <WhatsAppText id="s125" />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MessageChatPreview journey={journey} />
                </CardContent>
              </Card>

              {/* Technical Metadata Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    <WhatsAppText id="s126" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5 text-xs">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Direction:</span>
                    <span className="font-mono font-medium">
                      {journey.message.direction}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-mono font-medium">
                      {journey.message.messageType}
                    </span>
                  </div>
                  {journey.device && (
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">
                        <WhatsAppText id="s127" />
                      </span>
                      <span className="font-mono font-medium">
                        {journey.device.phoneNumber}
                      </span>
                    </div>
                  )}
                  {journey.contact && (
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">
                        <WhatsAppText id="s128" />
                      </span>
                      <span className="font-mono font-medium">
                        {journey.contact.phoneNumber}
                      </span>
                    </div>
                  )}
                  {journey.audit?.actorName && (
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">
                        <WhatsAppText id="s129" />
                      </span>
                      <span className="font-mono font-medium">
                        {journey.audit.actorName}
                      </span>
                    </div>
                  )}
                  {journey.billing?.status && (
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">
                        Billing Status:
                      </span>
                      <span className="font-medium text-emerald-600">
                        {journey.billing.status}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
