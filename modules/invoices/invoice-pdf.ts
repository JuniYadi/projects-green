import {
  formatInvoiceCurrency,
  formatInvoiceDate,
  getInvoiceStatusLabel,
} from "@/modules/invoices/invoices.helpers"
import type { InvoiceDetail } from "@/modules/invoices/invoices.types"

const escapePdfText = (value: string) => {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
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
  const lines: string[] = []

  if (organization) {
    if (organization.name) lines.push(organization.name)
    const fullName = organization.billingFullName || organization.name
    if (fullName) lines.push(fullName)
    if (organization.billingAddress) lines.push(organization.billingAddress)
    const cityState = [organization.billingCity, organization.billingState]
      .filter(Boolean)
      .join(", ")
    const postCountry = [
      organization.billingPostCode,
      organization.billingCountry,
    ]
      .filter(Boolean)
      .join(" ")
    if (cityState || postCountry)
      lines.push(`${cityState} ${postCountry}`.trim())
  }

  lines.push("")
  lines.push("INVOICE")
  lines.push("")
  lines.push(`Invoice Number:   ${invoice.invoiceNumber}`)
  lines.push(`Status:           ${getInvoiceStatusLabel(invoice.status)}`)
  lines.push(`Issued:           ${formatInvoiceDate(invoice.issuedAt)}`)
  lines.push(`Due:             ${formatInvoiceDate(invoice.dueAt)}`)
  lines.push(`Payment Method:  ${invoice.paymentMethod ?? "-"}`)

  lines.push("")
  lines.push("LINE ITEMS")
  lines.push("----------------------------------------")
  lines.push("Description          Qty   Unit Price   Amount")
  lines.push("----------------------------------------")

  for (const lineItem of invoice.lineItems.slice(0, 24)) {
    const desc = (lineItem.description || "").slice(0, 38)
    const qty = String(lineItem.quantity)
    const unit = formatInvoiceCurrency(lineItem.unitPrice, lineItem.currency)
    const amount = formatInvoiceCurrency(lineItem.amount, lineItem.currency)
    lines.push(
      `${desc.padEnd(38)}${qty.padStart(5)}   ${unit.padStart(12)}   ${amount.padStart(12)}`
    )
  }

  lines.push("----------------------------------------")
  lines.push("")
  for (const [label, amount] of [
    ["Subtotal:", invoice.subtotalAmount],
    ["Tax:", invoice.taxAmount],
    ["Discount:", invoice.discountAmount],
    ["Total:", invoice.totalAmount],
  ] as const) {
    lines.push(
      `${label.padEnd(20)}${formatInvoiceCurrency(amount, invoice.currency)}`
    )
  }
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
