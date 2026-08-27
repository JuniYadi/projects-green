import React from "react"
import { Hr, Section, Text } from "@react-email/components"
import type { InvoiceEmailLineItem } from "./types"

interface InvoiceSummaryProps {
  invoiceNumber: string
  status: string
  issuedAt: string
  dueAt: string
  periodStart?: string
  periodEnd?: string
  paidAt?: string
  paymentMethod?: string
  recipientEmail?: string
  organizationName?: string
}

const getStatusBadgeStyle = (status: string) => {
  const normalized = status.trim().toLowerCase()
  if (normalized === "paid") {
    return styles.statusBadgePaid
  }
  if (normalized === "overdue") {
    return styles.statusBadgeOverdue
  }
  if (normalized === "cancelled" || normalized === "canceled") {
    return styles.statusBadgeCancelled
  }
  return styles.statusBadge
}

export const InvoiceSummarySection = ({
  invoiceNumber,
  status,
  issuedAt,
  dueAt,
  periodStart,
  periodEnd,
  paidAt,
  paymentMethod,
  recipientEmail,
  organizationName,
}: InvoiceSummaryProps) => {
  const statusStyle = getStatusBadgeStyle(status)

  return (
    <Section style={styles.card}>
      <Text style={styles.cardHeader}>INVOICE DETAILS</Text>

      <Text style={styles.metaRow}>
        <span style={styles.metaLabel}>Invoice Number:</span>{" "}
        <span style={styles.metaValue}>{invoiceNumber}</span>
      </Text>

      {organizationName && (
        <Text style={styles.metaRow}>
          <span style={styles.metaLabel}>Billed To:</span>{" "}
          <span style={styles.metaValue}>
            {organizationName}
            {recipientEmail ? ` (${recipientEmail})` : ""}
          </span>
        </Text>
      )}

      {!organizationName && recipientEmail && (
        <Text style={styles.metaRow}>
          <span style={styles.metaLabel}>Billed To:</span>{" "}
          <span style={styles.metaValue}>{recipientEmail}</span>
        </Text>
      )}

      <Text style={styles.metaRow}>
        <span style={styles.metaLabel}>Issue Date:</span>{" "}
        <span style={styles.metaValue}>{issuedAt}</span>
      </Text>

      <Text style={styles.metaRow}>
        <span style={styles.metaLabel}>Due Date:</span>{" "}
        <span style={styles.metaValue}>{dueAt}</span>
      </Text>

      {periodStart &&
        periodEnd &&
        periodStart !== "N/A" &&
        periodEnd !== "N/A" && (
          <Text style={styles.metaRow}>
            <span style={styles.metaLabel}>Billing Period:</span>{" "}
            <span style={styles.metaValue}>
              {periodStart} – {periodEnd}
            </span>
          </Text>
        )}

      {paidAt && paidAt !== "N/A" && (
        <Text style={styles.metaRow}>
          <span style={styles.metaLabel}>Paid On:</span>{" "}
          <span style={styles.metaValue}>{paidAt}</span>
        </Text>
      )}

      {paymentMethod && (
        <Text style={styles.metaRow}>
          <span style={styles.metaLabel}>Payment Method:</span>{" "}
          <span style={styles.metaValue}>{paymentMethod}</span>
        </Text>
      )}

      <Text style={styles.metaRow}>
        <span style={styles.metaLabel}>Status:</span>{" "}
        <span style={statusStyle}>{status}</span>
      </Text>
    </Section>
  )
}

interface InvoiceItemsListProps {
  lineItems?: InvoiceEmailLineItem[]
}

export const InvoiceItemsList = ({ lineItems }: InvoiceItemsListProps) => {
  if (!lineItems || lineItems.length === 0) {
    return null
  }

  return (
    <Section style={styles.card}>
      <Text style={styles.cardHeader}>ITEMS & SERVICES</Text>

      {lineItems.map((item, index) => (
        <React.Fragment key={item.id || index}>
          {index > 0 && <Hr style={styles.itemDivider} />}
          <div style={styles.itemRow}>
            <table
              width="100%"
              cellPadding="0"
              cellSpacing="0"
              border={0}
              style={styles.table}
            >
              <tbody>
                <tr>
                  <td style={styles.itemLeftCol}>
                    <Text style={styles.itemTitle}>{item.description}</Text>
                    <Text style={styles.itemSubtitle}>
                      Qty {item.quantity} × {item.unitPrice}
                    </Text>
                  </td>
                  <td align="right" style={styles.itemRightCol}>
                    <Text style={styles.itemPrice}>{item.amount}</Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </React.Fragment>
      ))}
    </Section>
  )
}

interface InvoiceCostBreakdownProps {
  amount: string
  subtotalAmount?: string
  taxAmount?: string
  discountAmount?: string
  totalLabel?: string
}

export const InvoiceCostBreakdown = ({
  amount,
  subtotalAmount,
  taxAmount,
  discountAmount,
  totalLabel = "Total Amount",
}: InvoiceCostBreakdownProps) => {
  const hasSubtotal = Boolean(subtotalAmount && subtotalAmount !== "N/A")
  const hasTax = Boolean(
    taxAmount && taxAmount !== "N/A" && /[1-9]/.test(taxAmount)
  )
  const hasDiscount = Boolean(
    discountAmount && discountAmount !== "N/A" && /[1-9]/.test(discountAmount)
  )

  return (
    <Section style={styles.card}>
      <Text style={styles.cardHeader}>PAYMENT BREAKDOWN</Text>

      <table
        width="100%"
        cellPadding="0"
        cellSpacing="0"
        border={0}
        style={styles.table}
      >
        <tbody>
          {hasSubtotal && (
            <tr>
              <td style={styles.breakdownLeftCol}>
                <Text style={styles.breakdownRow}>
                  <span style={styles.metaLabel}>Subtotal:</span>
                </Text>
              </td>
              <td align="right" style={styles.breakdownRightCol}>
                <Text style={styles.breakdownRow}>
                  <span style={styles.breakdownValue}>{subtotalAmount}</span>
                </Text>
              </td>
            </tr>
          )}

          {hasDiscount && (
            <tr>
              <td style={styles.breakdownLeftCol}>
                <Text style={styles.breakdownRow}>
                  <span style={styles.metaLabel}>Discount / Voucher:</span>
                </Text>
              </td>
              <td align="right" style={styles.breakdownRightCol}>
                <Text style={styles.breakdownRow}>
                  <span style={styles.discountValue}>-{discountAmount}</span>
                </Text>
              </td>
            </tr>
          )}

          {hasTax && (
            <tr>
              <td style={styles.breakdownLeftCol}>
                <Text style={styles.breakdownRow}>
                  <span style={styles.metaLabel}>Tax:</span>
                </Text>
              </td>
              <td align="right" style={styles.breakdownRightCol}>
                <Text style={styles.breakdownRow}>
                  <span style={styles.breakdownValue}>{taxAmount}</span>
                </Text>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {(hasSubtotal || hasTax || hasDiscount) && (
        <Hr style={styles.itemDivider} />
      )}

      <table
        width="100%"
        cellPadding="0"
        cellSpacing="0"
        border={0}
        style={styles.table}
      >
        <tbody>
          <tr>
            <td style={styles.breakdownLeftCol}>
              <Text style={styles.totalRow}>
                <span style={styles.totalLabel}>{totalLabel}:</span>
              </Text>
            </td>
            <td align="right" style={styles.breakdownRightCol}>
              <Text style={styles.totalRow}>
                <span style={styles.totalValue}>{amount}</span>
              </Text>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  )
}

export const styles = {
  body: {
    backgroundColor: "#f6f9fc",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    margin: "0",
    padding: "0",
  },
  container: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    margin: "32px auto",
    padding: "32px 24px",
    maxWidth: "560px",
  },
  heading: {
    color: "#1a1a1a",
    fontSize: "22px",
    fontWeight: "700" as const,
    margin: "0 0 16px 0",
    letterSpacing: "-0.3px",
  },
  intro: {
    color: "#4a5568",
    fontSize: "15px",
    lineHeight: "22px",
    margin: "0 0 20px 0",
  },
  card: {
    backgroundColor: "#f8fafc",
    borderRadius: "6px",
    border: "1px solid #e2e8f0",
    padding: "16px",
    margin: "0 0 16px 0",
  },
  cardHeader: {
    color: "#718096",
    fontSize: "11px",
    fontWeight: "700" as const,
    letterSpacing: "0.5px",
    textTransform: "uppercase" as const,
    margin: "0 0 12px 0",
  },
  metaRow: {
    color: "#2d3748",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "6px 0",
  },
  metaLabel: {
    color: "#718096",
    fontWeight: "500" as const,
  },
  metaValue: {
    color: "#1a202c",
    fontWeight: "600" as const,
  },
  statusBadge: {
    display: "inline-block",
    backgroundColor: "#e2e8f0",
    color: "#2d3748",
    fontSize: "12px",
    fontWeight: "700" as const,
    padding: "2px 8px",
    borderRadius: "4px",
    letterSpacing: "0.4px",
  },
  statusBadgePaid: {
    display: "inline-block",
    backgroundColor: "#dcfce7",
    color: "#15803d",
    fontSize: "12px",
    fontWeight: "700" as const,
    padding: "2px 8px",
    borderRadius: "4px",
    letterSpacing: "0.4px",
  },
  statusBadgeOverdue: {
    display: "inline-block",
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    fontSize: "12px",
    fontWeight: "700" as const,
    padding: "2px 8px",
    borderRadius: "4px",
    letterSpacing: "0.4px",
  },
  statusBadgeCancelled: {
    display: "inline-block",
    backgroundColor: "#f1f5f9",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "700" as const,
    padding: "2px 8px",
    borderRadius: "4px",
    letterSpacing: "0.4px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
  },
  itemLeftCol: {
    verticalAlign: "top" as const,
    textAlign: "left" as const,
  },
  itemRightCol: {
    verticalAlign: "bottom" as const,
    textAlign: "right" as const,
    whiteSpace: "nowrap" as const,
  },
  itemPrice: {
    color: "#1a202c",
    fontSize: "14px",
    fontWeight: "600" as const,
    margin: "0",
  },
  breakdownLeftCol: {
    verticalAlign: "middle" as const,
    textAlign: "left" as const,
  },
  breakdownRightCol: {
    verticalAlign: "middle" as const,
    textAlign: "right" as const,
    whiteSpace: "nowrap" as const,
  },
  itemRow: {
    margin: "6px 0",
  },
  itemTitle: {
    color: "#1a202c",
    fontSize: "14px",
    fontWeight: "600" as const,
    margin: "0 0 2px 0",
  },
  itemSubtitle: {
    color: "#718096",
    fontSize: "13px",
    margin: "0",
  },
  itemTotalFloat: {
    color: "#1a202c",
    fontWeight: "600" as const,
    textAlign: "right" as const,
  },
  itemDivider: {
    borderColor: "#e2e8f0",
    borderWidth: "1px",
    margin: "12px 0",
  },
  breakdownRow: {
    color: "#4a5568",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "6px 0",
  },
  breakdownValue: {
    color: "#1a202c",
    fontWeight: "500" as const,
    textAlign: "right" as const,
  },
  discountValue: {
    color: "#16a34a",
    fontWeight: "600" as const,
    textAlign: "right" as const,
  },
  totalRow: {
    color: "#1a202c",
    fontSize: "16px",
    fontWeight: "700" as const,
    margin: "8px 0 0 0",
  },
  totalLabel: {
    color: "#1a202c",
  },
  totalValue: {
    color: "#0f172a",
    fontSize: "18px",
    textAlign: "right" as const,
  },
  actions: {
    textAlign: "center" as const,
    margin: "24px 0 16px 0",
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: "6px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "600" as const,
    padding: "12px 24px",
    textDecoration: "none",
    display: "inline-block",
  },
  noticeBox: {
    backgroundColor: "#fef3c7",
    border: "1px solid #fde68a",
    borderRadius: "6px",
    padding: "12px 16px",
    margin: "16px 0",
  },
  noticeText: {
    color: "#92400e",
    fontSize: "13px",
    lineHeight: "18px",
    margin: "0",
  },
  divider: {
    borderColor: "#e2e8f0",
    borderWidth: "1px",
    margin: "24px 0",
  },
  footer: {
    color: "#94a3b8",
    fontSize: "13px",
    lineHeight: "18px",
    margin: "0",
    textAlign: "center" as const,
  },
}
