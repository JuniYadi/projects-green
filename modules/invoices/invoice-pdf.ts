import { formatInvoiceCurrency, formatInvoiceDate } from "@/modules/invoices/invoices.helpers"
import type { InvoiceDetail } from "@/modules/invoices/invoices.types"

const escapePdfText = (value: string) => {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)")
}

const toPdfLines = (
  invoice: InvoiceDetail,
  organization?: {
    name: string
    billingFullName?: string | null
    billingAddress?: string | null
    billingCity?: string | null
    billingState?: string | null
    billingCountry?: string | null
    billingPostCode?: string | null
  } | null
) => {
  const lines = [
    `Invoice ${invoice.invoiceNumber}`,
    `Invoice ID: ${invoice.id}`,
    `Status: ${invoice.status}`,
    `Issued: ${formatInvoiceDate(invoice.issuedAt)}`,
    `Due: ${formatInvoiceDate(invoice.dueAt)}`,
    `Billing period: ${formatInvoiceDate(invoice.periodStart)} - ${formatInvoiceDate(
      invoice.periodEnd
    )}`,
    "",
    "Di Tagih Kepada (Billed To):",
    `  ${organization?.billingFullName || organization?.name || "—"}`,
    `  ${organization?.billingAddress || "—"}`,
    `  ${[organization?.billingCity, organization?.billingState].filter(Boolean).join(", ") || "—"}`,
    `  ${[organization?.billingCountry, organization?.billingPostCode].filter(Boolean).join(" ") || "—"}`,
    "",
    "Di Bayar Kepada (Paid To):",
    "  PFNApp Technologies Inc.",
    "  Sudirman Central Business District (SCBD)",
    "  Jakarta, DKI Jakarta, Indonesia 12190",
    "",
    "Line items",
  ]

  for (const lineItem of invoice.lineItems.slice(0, 24)) {
    lines.push(
      `${lineItem.description} | Qty ${lineItem.quantity} | Unit ${formatInvoiceCurrency(
        lineItem.unitPrice,
        lineItem.currency
      )} | Amount ${formatInvoiceCurrency(lineItem.amount, lineItem.currency)}`
    )
  }

  lines.push("")
  lines.push(`Subtotal: ${formatInvoiceCurrency(invoice.subtotalAmount, invoice.currency)}`)
  lines.push(`Tax: ${formatInvoiceCurrency(invoice.taxAmount, invoice.currency)}`)
  lines.push(
    `Discount: ${formatInvoiceCurrency(invoice.discountAmount, invoice.currency)}`
  )
  lines.push(`Total: ${formatInvoiceCurrency(invoice.totalAmount, invoice.currency)}`)

  return lines
}

export const buildInvoicePdfBytes = (
  invoice: InvoiceDetail,
  organization?: {
    name: string
    billingFullName?: string | null
    billingAddress?: string | null
    billingCity?: string | null
    billingState?: string | null
    billingCountry?: string | null
    billingPostCode?: string | null
  } | null
): Uint8Array => {
  const encoder = new TextEncoder()
  const lines = toPdfLines(invoice, organization)
  const streamBody = [
    "BT",
    "/F1 11 Tf",
    "50 760 Td",
    ...lines.map((line, index) => {
      if (index === 0) {
        return `(${escapePdfText(line)}) Tj`
      }

      return `0 -16 Td (${escapePdfText(line)}) Tj`
    }),
    "ET",
  ].join("\n")
  const streamLength = encoder.encode(streamBody).byteLength

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamBody}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ]

  const outputParts = ["%PDF-1.4\n"]
  let outputByteLength = encoder.encode(outputParts[0] ?? "").byteLength
  const offsets = [0]

  for (const object of objects) {
    offsets.push(outputByteLength)
    outputParts.push(object)
    outputByteLength += encoder.encode(object).byteLength
  }

  const xrefOffset = outputByteLength
  outputParts.push(`xref\n0 ${objects.length + 1}\n`)
  outputParts.push("0000000000 65535 f \n")

  for (const offset of offsets.slice(1)) {
    outputParts.push(`${String(offset).padStart(10, "0")} 00000 n \n`)
  }

  outputParts.push("trailer\n")
  outputParts.push(`<< /Size ${objects.length + 1} /Root 1 0 R >>\n`)
  outputParts.push("startxref\n")
  outputParts.push(`${xrefOffset}\n`)
  outputParts.push("%%EOF")

  return encoder.encode(outputParts.join(""))
}
