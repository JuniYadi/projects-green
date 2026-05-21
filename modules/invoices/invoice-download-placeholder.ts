export type InvoicePdfDownloadMockOutcome = "success" | "failure" | "disabled"

export type InvoicePdfDownloadPlaceholderResult =
  | {
      status: "success"
      endpoint: string
      message: string
    }
  | {
      status: "failure"
      endpoint: string
      code: string
      message: string
    }
  | {
      status: "disabled"
      endpoint: string
      message: string
    }

type RunInvoicePdfDownloadPlaceholderParams = {
  invoiceId: string
  invoiceNumber: string
  outcome: InvoicePdfDownloadMockOutcome
  delayMs?: number
}

const DEFAULT_DELAY_MS = 900

const INVOICE_PDF_PLACEHOLDER_ENDPOINT_TEMPLATE = "/api/invoices/:invoiceId/pdf"

const wait = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs)
  })

export const resolveInvoicePdfPlaceholderEndpoint = (invoiceId: string) => {
  return INVOICE_PDF_PLACEHOLDER_ENDPOINT_TEMPLATE.replace(
    ":invoiceId",
    invoiceId
  )
}

export const runInvoicePdfDownloadPlaceholder = async ({
  invoiceId,
  invoiceNumber,
  outcome,
  delayMs = DEFAULT_DELAY_MS,
}: RunInvoicePdfDownloadPlaceholderParams): Promise<InvoicePdfDownloadPlaceholderResult> => {
  const endpoint = resolveInvoicePdfPlaceholderEndpoint(invoiceId)

  await wait(delayMs)

  if (outcome === "failure") {
    return {
      status: "failure",
      endpoint,
      code: "INVOICE_PDF_PLACEHOLDER_FAILED",
      message: `Mock request for ${invoiceNumber} failed before file delivery.`,
    }
  }

  if (outcome === "disabled") {
    return {
      status: "disabled",
      endpoint,
      message: `Mock download for ${invoiceNumber} is disabled by scenario.`,
    }
  }

  // TODO(invoice-integration): replace with real call to signed PDF download API.
  return {
    status: "success",
    endpoint,
    message: `Mock PDF request for ${invoiceNumber} completed.`,
  }
}
