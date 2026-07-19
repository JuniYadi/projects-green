"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { DeliveryLogTable } from "@/modules/whatsapp/webhooks/ui/delivery-log-table"
import type { WebhookDeliveryLogDTO } from "@/modules/whatsapp/webhooks/webhook-dispatcher.service"

type DeliveryLogsSectionProps = {
  webhookId: string
}

export function DeliveryLogsSection({ webhookId }: DeliveryLogsSectionProps) {
  const [logs, setLogs] = React.useState<WebhookDeliveryLogDTO[]>([])
  const [meta, setMeta] = React.useState({ total: 0, page: 1, totalPages: 0 })
  const [pageState, setPageState] = React.useState<
    "loading" | "loaded" | "error"
  >("loading")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [page, setPage] = React.useState(1)
  const mountedRef = React.useRef(true)

  React.useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPageState("loading")
    setErrorMessage("")
    ;(async () => {
      try {
        const res = await fetch(
          `/api/admin/whatsapp/webhooks/${webhookId}/deliveries?page=${page}&limit=20`
        )
        if (!res.ok) throw new Error(`Failed to load deliveries: ${res.status}`)
        const result = (await res.json()) as {
          ok: boolean
          data: WebhookDeliveryLogDTO[]
          meta: { total: number; page: number; totalPages: number }
        }
        if (!result.ok) throw new Error("Failed to load deliveries")
        if (!cancelled) {
          setLogs(result.data)
          setMeta(result.meta)
          setPageState("loaded")
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : "Unknown error")
          setPageState("error")
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [webhookId, page])

  const handleResend = async (deliveryLogId: string) => {
    try {
      const res = await fetch(
        `/api/admin/whatsapp/webhooks/${webhookId}/deliveries/${deliveryLogId}/resend`,
        {
          method: "POST",
        }
      )
      if (!res.ok) throw new Error("Resend failed")
      // Trigger a re-fetch of deliveries by forcing page re-mount
      setPageState("loading")
      setErrorMessage("")
      const res2 = await fetch(
        `/api/admin/whatsapp/webhooks/${webhookId}/deliveries?page=${page}&limit=20`
      )
      if (res2.ok) {
        const result = (await res2.json()) as {
          ok: boolean
          data: WebhookDeliveryLogDTO[]
          meta: { total: number; page: number; totalPages: number }
        }
        if (result.ok) {
          setLogs(result.data)
          setMeta(result.meta)
          setPageState("loaded")
        }
      }
    } catch {
      // silent
    }
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleRetry = () => {
    setPageState("loading")
    setErrorMessage("")
    // Effect will re-run since pageState changed
  }

  return (
    <div className="space-y-4">
      <DeliveryLogTable
        logs={logs}
        isLoading={pageState === "loading"}
        error={pageState === "error" ? errorMessage : undefined}
        onRetry={handleRetry}
        onResend={handleResend}
        pagination={
          meta.totalPages > 1
            ? {
                page: meta.page,
                totalPages: meta.totalPages,
                onPageChange: handlePageChange,
              }
            : undefined
        }
      />
    </div>
  )
}

type TestPingButtonProps = {
  webhookId: string
}

export function TestPingButton({ webhookId }: TestPingButtonProps) {
  const [sending, setSending] = React.useState(false)
  const [result, setResult] = React.useState<{
    ok: boolean
    message: string
  } | null>(null)

  const handleTest = async () => {
    setSending(true)
    setResult(null)
    try {
      const res = await fetch(
        `/api/admin/whatsapp/webhooks/${webhookId}/test`,
        {
          method: "POST",
        }
      )
      const body = (await res.json()) as { ok: boolean; message?: string }
      setResult({
        ok: body.ok,
        message:
          body.message ?? (body.ok ? "Test webhook sent." : "Test failed."),
      })
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : "Network error",
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleTest}
        disabled={sending}
      >
        {sending ? "Sending…" : "Test Webhook"}
      </Button>
      {result && (
        <span
          className={`text-xs ${result.ok ? "text-green-600" : "text-red-600"}`}
        >
          {result.message}
        </span>
      )}
    </div>
  )
}
