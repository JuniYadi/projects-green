"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  runInvoicePdfDownloadPlaceholder,
  type InvoicePdfDownloadMockOutcome,
} from "@/modules/invoices/invoice-download-placeholder"
import type { InvoiceDownloadData } from "@/modules/invoices/invoices.types"

type InvoiceDownloadPdfActionProps = {
  invoiceId: string
  downloadData: InvoiceDownloadData
  mockDelayMs?: number
}

type DownloadActionStatus =
  | "idle"
  | "initiating"
  | "success"
  | "failure"
  | "disabled"

type DownloadActionState = {
  status: DownloadActionStatus
  message: string
}

type DownloadActionStatusMeta = {
  label: string
  toneClassName: string
}

const DOWNLOAD_ACTION_OUTCOMES: Array<{
  value: InvoicePdfDownloadMockOutcome
  label: string
}> = [
  { value: "success", label: "Success" },
  { value: "failure", label: "Failure" },
  { value: "disabled", label: "Disabled" },
]

const DOWNLOAD_ACTION_STATUS_META: Record<
  DownloadActionStatus,
  DownloadActionStatusMeta
> = {
  idle: {
    label: "Idle",
    toneClassName: "border-border bg-background text-foreground",
  },
  initiating: {
    label: "Initiating",
    toneClassName: "border-yellow-500/20 bg-yellow-500/10 text-yellow-600",
  },
  success: {
    label: "Success",
    toneClassName: "border-green-500/20 bg-green-500/10 text-green-600",
  },
  failure: {
    label: "Failure",
    toneClassName: "border-destructive/20 bg-destructive/10 text-destructive",
  },
  disabled: {
    label: "Disabled",
    toneClassName: "border-zinc-500/20 bg-zinc-500/10 text-zinc-600",
  },
}

const INITIAL_ACTION_STATE: DownloadActionState = {
  status: "idle",
  message: "Ready to trigger mocked PDF download flow.",
}

export function InvoiceDownloadPdfAction({
  invoiceId,
  downloadData,
  mockDelayMs,
}: InvoiceDownloadPdfActionProps) {
  const [mockOutcome, setMockOutcome] =
    useState<InvoicePdfDownloadMockOutcome>("success")
  const [actionState, setActionState] =
    useState<DownloadActionState>(INITIAL_ACTION_STATE)
  const [lastEndpoint, setLastEndpoint] = useState<string | null>(null)

  const statusMeta = DOWNLOAD_ACTION_STATUS_META[actionState.status]

  const isInitiating = actionState.status === "initiating"
  const isDisabled = isInitiating || actionState.status === "disabled"

  const resetActionState = () => {
    setActionState(INITIAL_ACTION_STATE)
    setLastEndpoint(null)
  }

  const handleDownload = async () => {
    setActionState({
      status: "initiating",
      message: "Initiating mocked download request...",
    })

    try {
      const result = await runInvoicePdfDownloadPlaceholder({
        invoiceId,
        invoiceNumber: downloadData.invoice.invoiceNumber,
        outcome: mockOutcome,
        delayMs: mockDelayMs,
      })

      setLastEndpoint(result.endpoint)

      if (result.status === "failure") {
        setActionState({
          status: "failure",
          message: `[${result.code}] ${result.message}`,
        })

        return
      }

      setActionState({
        status: result.status,
        message: result.message,
      })
    } catch (error) {
      setLastEndpoint(null)

      setActionState({
        status: "failure",
        message: `Unexpected error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      })
    }
  }

  return (
    <section id="invoice-download-pdf" className="grid gap-3 text-sm">
      <div className="space-y-1">
        <p className="font-medium">{downloadData.invoice.invoiceNumber}</p>
        <p className="text-xs text-muted-foreground">
          Format: {downloadData.defaultFormat.toUpperCase()} (mocked)
        </p>
      </div>

      <div className="grid gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Mock outcome
        </p>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Mock outcome"
        >
          {DOWNLOAD_ACTION_OUTCOMES.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="xs"
              variant={mockOutcome === option.value ? "default" : "outline"}
              onClick={() => {
                setMockOutcome(option.value)
                if (
                  actionState.status === "disabled" &&
                  option.value !== "disabled"
                ) {
                  resetActionState()
                }
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleDownload}
          disabled={isDisabled}
        >
          {isInitiating ? "Preparing PDF..." : "Download PDF (Mock)"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={resetActionState}
        >
          Reset state
        </Button>
      </div>

      <div className="rounded-md border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-medium",
              statusMeta.toneClassName
            )}
          >
            {statusMeta.label}
          </span>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {actionState.message}
          </p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Placeholder endpoint:{" "}
          <span className="font-mono text-[11px]">
            {lastEndpoint ?? "/api/invoices/:invoiceId/pdf"}
          </span>
        </p>
      </div>
    </section>
  )
}
