"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

type InvoiceDownloadPdfActionProps = {
  invoiceId: string
  invoiceNumber: string
}

const DEFAULT_ERROR_MESSAGE = "Unable to download invoice PDF right now."

export function InvoiceDownloadPdfAction({
  invoiceId,
  invoiceNumber,
}: InvoiceDownloadPdfActionProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleDownload = async () => {
    setIsDownloading(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`)

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null

        setErrorMessage(payload?.message ?? DEFAULT_ERROR_MESSAGE)
        setIsDownloading(false)
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${invoiceNumber}.pdf`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE
      )
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void handleDownload()}
        disabled={isDownloading}
      >
        {isDownloading ? "Preparing PDF..." : "Download PDF"}
      </Button>
      {errorMessage ? (
        <p className="text-xs text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  )
}
