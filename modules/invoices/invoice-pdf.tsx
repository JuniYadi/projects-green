import path from "node:path"
import {
  Document,
  Font,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer"

const regularFontPath = path.resolve(
  process.cwd(),
  "public/fonts/Roboto-Regular.ttf"
)
const boldFontPath = path.resolve(process.cwd(), "public/fonts/Roboto-Bold.ttf")

Font.register({
  family: "Roboto",
  fonts: [
    { src: regularFontPath, fontWeight: 400 },
    { src: boldFontPath, fontWeight: 700 },
  ],
})

Font.register({
  family: "Helvetica",
  fonts: [
    { src: regularFontPath, fontWeight: 400 },
    { src: boldFontPath, fontWeight: 700 },
  ],
})

Font.register({
  family: "Helvetica-Bold",
  src: boldFontPath,
})

import { getEmailBaseUrl } from "@/lib/email-url"
import {
  formatInvoiceCurrency,
  formatInvoiceDate,
  getInvoiceStatusLabel,
  getNextRenewalDate,
} from "@/modules/invoices/invoices.helpers"
import type { InvoiceDetail } from "@/modules/invoices/invoices.types"
import { formatPaymentMethod } from "@/modules/billing/user-labels"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"

type OrganizationInput = {
  name?: string | null
  billingFullName?: string | null
  billingAddress?: string | null
  billingCity?: string | null
  billingState?: string | null
  billingCountry?: string | null
  billingPostCode?: string | null
}

type BankAccountInput = {
  bankName: string
  bankCode: string
  accountName: string
  accountNumber: string
  swiftCode?: string | null
}

const MAX_LINE_ITEMS = 24
const MAX_DESCRIPTION = 40

const STATUS_RIBBON_COLORS: Record<string, { bg: string }> = {
  open: { bg: "#f59e0b" },
  partially_paid: { bg: "#f59e0b" },
  paid: { bg: "#22c55e" },
  canceled: { bg: "#6b7280" },
  uncollectible: { bg: "#ef4444" },
  draft: { bg: "#94a3b8" },
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    color: "#333333",
    fontFamily: "Helvetica",
  },
  headerBar: {
    backgroundColor: "#1e3a5f",
    paddingHorizontal: 40,
    paddingVertical: 18,
  },
  headerBrandName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  headerBrandLine: {
    fontSize: 10,
    color: "#d1d5db",
    marginBottom: 1,
  },
  headerBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
  },
  invoiceNumberText: {
    fontSize: 10,
    color: "#ffffff",
  },
  statusRibbon: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusRibbonText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#ffffff",
  },
  metaSection: {
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 4,
    paddingVertical: 2,
  },
  metaLabel: {
    width: 140,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#333333",
  },
  metaValue: {
    flex: 1,
    fontSize: 10,
    color: "#333333",
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a5f",
    marginBottom: 6,
  },
  billToSection: {
    marginBottom: 10,
  },
  billToName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#333333",
    marginBottom: 2,
  },
  billToDetail: {
    fontSize: 10,
    color: "#333333",
    marginBottom: 1,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#1e3a5f",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#ffffff",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  tableRowAlt: {
    backgroundColor: "#f8f9fa",
  },
  descCell: {
    flex: 1,
  },
  qtyCell: {
    width: 40,
    textAlign: "right",
  },
  unitCell: {
    width: 90,
    textAlign: "right",
  },
  amountCell: {
    width: 90,
    textAlign: "right",
  },
  rule: {
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    marginVertical: 4,
  },
  totalsSection: {
    marginTop: 12,
    alignItems: "flex-end",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 3,
    paddingHorizontal: 12,
  },
  totalsLabel: {
    width: 140,
    textAlign: "right",
    fontSize: 10,
    color: "#333333",
  },
  totalsValue: {
    width: 120,
    textAlign: "right",
    fontSize: 10,
    color: "#333333",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: "#f0f4ff",
    borderTopWidth: 1,
    borderTopColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  totalLabel: {
    width: 140,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: "#333333",
  },
  totalValue: {
    width: 120,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: "#2563eb",
  },
  paymentDetailsSection: {
    marginTop: 12,
  },
  allocationsSection: {
    marginTop: 12,
  },
  allocRow: {
    flexDirection: "row",
    paddingVertical: 3,
  },
  allocDateCell: {
    width: 110,
    fontSize: 8,
    color: "#333333",
  },
  allocSourceCell: {
    flex: 1,
    fontSize: 8,
    color: "#333333",
  },
  allocRefCell: {
    width: 140,
    fontSize: 8,
    color: "#6b7280",
  },
  allocAmountCell: {
    width: 100,
    textAlign: "right",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#333333",
  },
  paymentDetailsSubtitle: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 8,
  },
  bankAccountRow: {
    marginBottom: 4,
  },
  bankAccountText: {
    fontSize: 8,
    color: "#333333",
  },
  bankAccountBold: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#333333",
  },
  footerSection: {
    marginTop: 16,
  },
  footerRule: {
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    marginBottom: 6,
  },
  footerText: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 2,
  },
})

const MetaRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metaRow}>
    <Text style={styles.metaLabel}>{label}</Text>
    <Text style={styles.metaValue}>{value}</Text>
  </View>
)

const LineItemRow = ({
  item,
  alt,
}: {
  item: InvoiceDetail["lineItems"][number]
  alt: boolean
}) => (
  <View style={alt ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}>
    <Text style={styles.descCell}>
      {(item.description || "").slice(0, MAX_DESCRIPTION)}
    </Text>
    <Text style={styles.qtyCell}>{item.quantity}</Text>
    <Text style={styles.unitCell}>
      {formatInvoiceCurrency(item.unitPrice, item.currency)}
    </Text>
    <Text style={styles.amountCell}>
      {formatInvoiceCurrency(item.amount, item.currency)}
    </Text>
  </View>
)

// Invoice PDFs are always issued in English regardless of the viewer's UI
// locale — matches the pre-existing hardcoded-English behavior of this
// document (billing/legal documents are standardized on one language).
const pdfMessages = getMessagesForMaybeLocale("en").console.invoices.pdf

const BillToBlock = ({
  organization,
}: {
  organization?: OrganizationInput | null
}) => {
  if (!organization) return null
  const name = organization.billingFullName ?? organization.name ?? null
  if (!name) return null

  return (
    <View style={styles.billToSection}>
      <Text style={styles.sectionLabel}>{pdfMessages.billTo}</Text>
      <Text style={styles.billToName}>{name}</Text>
      {organization.name && organization.name !== name ? (
        <Text style={styles.billToDetail}>{organization.name}</Text>
      ) : null}
      {organization.billingAddress ? (
        <Text style={styles.billToDetail}>{organization.billingAddress}</Text>
      ) : null}
      {[organization.billingCity, organization.billingState]
        .filter(Boolean)
        .join(", ") ? (
        <Text style={styles.billToDetail}>
          {[organization.billingCity, organization.billingState]
            .filter(Boolean)
            .join(", ")}
        </Text>
      ) : null}
      {[organization.billingPostCode, organization.billingCountry]
        .filter(Boolean)
        .join(" ") ? (
        <Text style={styles.billToDetail}>
          {[organization.billingPostCode, organization.billingCountry]
            .filter(Boolean)
            .join(" ")}
        </Text>
      ) : null}
    </View>
  )
}

const PaymentDetailsBlock = ({
  paymentMethod,
  bankAccounts,
}: {
  paymentMethod: string | null
  bankAccounts?: BankAccountInput[]
}) => {
  if (paymentMethod !== "MANUAL_BANK" || !bankAccounts?.length) return null

  return (
    <View style={styles.paymentDetailsSection}>
      <Text style={styles.sectionLabel}>{pdfMessages.paymentDetails}</Text>
      <Text style={styles.paymentDetailsSubtitle}>
        {pdfMessages.bankTransferDesc}
      </Text>
      {bankAccounts.map((account, index) => (
        <View key={index} style={styles.bankAccountRow}>
          <Text style={styles.bankAccountText}>
            <Text style={styles.bankAccountBold}>{pdfMessages.bank} </Text>
            {account.bankName} ({account.bankCode}){" | "}
            <Text style={styles.bankAccountBold}>{pdfMessages.acct} </Text>
            {account.accountNumber}
            {" | "}
            <Text style={styles.bankAccountBold}>{pdfMessages.name} </Text>
            {account.accountName}
            {account.swiftCode ? (
              <>
                {` | `}
                <Text style={styles.bankAccountBold}>{pdfMessages.swift} </Text>
                {account.swiftCode}
              </>
            ) : null}
          </Text>
        </View>
      ))}
    </View>
  )
}

const PaymentAllocationsBlock = ({
  allocations,
  currency,
}: {
  allocations?: InvoiceDetail["allocations"]
  currency: string
}) => {
  if (!allocations || allocations.length === 0) return null

  return (
    <View style={styles.allocationsSection}>
      <Text style={styles.sectionLabel}>Riwayat Pembayaran</Text>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.allocDateCell, styles.tableHeaderCell]}>
          Tanggal
        </Text>
        <Text style={[styles.allocSourceCell, styles.tableHeaderCell]}>
          Metode / Sumber
        </Text>
        <Text style={[styles.allocRefCell, styles.tableHeaderCell]}>
          Referensi
        </Text>
        <Text style={[styles.allocAmountCell, styles.tableHeaderCell]}>
          Jumlah
        </Text>
      </View>
      <View style={styles.rule} />
      {allocations.map((alloc) => (
        <View key={alloc.id} style={styles.allocRow}>
          <Text style={styles.allocDateCell}>
            {formatInvoiceDate(alloc.completedAt || alloc.createdAt)}
          </Text>
          <Text style={styles.allocSourceCell}>
            {alloc.source.replace("_", " ")}
          </Text>
          <Text style={styles.allocRefCell}>{alloc.referenceId || "—"}</Text>
          <Text style={styles.allocAmountCell}>
            {formatInvoiceCurrency(alloc.amount, currency)}
          </Text>
        </View>
      ))}
    </View>
  )
}

const InvoiceFooter = () => {
  const now = new Date()
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })
  const siteUrl = getEmailBaseUrl()

  return (
    <View style={styles.footerSection}>
      <View style={styles.footerRule} />
      <Text style={styles.footerText}>{pdfMessages.afterTransferNotice}</Text>
      <Text style={styles.footerText}>
        {pdfMessages.site} {siteUrl} {pdfMessages.support}
      </Text>
      <Text style={styles.footerText}>
        {pdfMessages.generatedOn} {dateStr} {pdfMessages.at} {timeStr} UTC
      </Text>
    </View>
  )
}

const InvoicePdfDocument = ({
  invoice,
  organization,
  bankAccounts,
}: {
  invoice: InvoiceDetail
  organization?: OrganizationInput | null
  bankAccounts?: BankAccountInput[]
}) => {
  const currency = invoice.currency
  const ribbonColor = STATUS_RIBBON_COLORS[invoice.status]?.bg || "#94a3b8"

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <Text style={styles.headerBrandName}>PFNApp</Text>
          <Text style={styles.headerBrandLine}>{pdfMessages.companyName}</Text>
          <Text style={styles.headerBrandLine}>
            {pdfMessages.companyAddress}
          </Text>
          <Text style={styles.headerBrandLine}>
            {pdfMessages.companyContact}
          </Text>
          <View style={styles.headerBottomRow}>
            <Text style={styles.invoiceNumberText}>
              {invoice.invoiceNumber}
            </Text>
            <View
              style={[styles.statusRibbon, { backgroundColor: ribbonColor }]}
            >
              <Text style={styles.statusRibbonText}>
                {getInvoiceStatusLabel(invoice.status).toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.metaSection}>
          <MetaRow
            label={pdfMessages.labelIssued}
            value={formatInvoiceDate(invoice.issuedAt)}
          />
          <MetaRow
            label={pdfMessages.labelDue}
            value={formatInvoiceDate(invoice.dueAt)}
          />
          {invoice.periodStart && invoice.periodEnd ? (
            <MetaRow
              label={pdfMessages.labelServicePeriod}
              value={`${formatInvoiceDate(invoice.periodStart)} - ${formatInvoiceDate(invoice.periodEnd)}`}
            />
          ) : null}
          {invoice.periodEnd ? (
            <>
              <MetaRow
                label={pdfMessages.labelServiceEnds}
                value={formatInvoiceDate(invoice.periodEnd)}
              />
              <MetaRow
                label={pdfMessages.labelNextRenewal}
                value={formatInvoiceDate(getNextRenewalDate(invoice.periodEnd))}
              />
            </>
          ) : null}
          <MetaRow
            label={pdfMessages.labelPaymentMethod}
            value={formatPaymentMethod(invoice.paymentMethod)}
          />
        </View>
        <BillToBlock organization={organization} />

        <Text style={styles.sectionLabel}>{pdfMessages.lineItems}</Text>

        <View style={styles.tableHeaderRow}>
          <Text style={[styles.descCell, styles.tableHeaderCell]}>
            {pdfMessages.colDescription}
          </Text>
          <Text style={[styles.qtyCell, styles.tableHeaderCell]}>
            {pdfMessages.colQty}
          </Text>
          <Text style={[styles.unitCell, styles.tableHeaderCell]}>
            {pdfMessages.colUnitPrice}
          </Text>
          <Text style={[styles.amountCell, styles.tableHeaderCell]}>
            {pdfMessages.colAmount}
          </Text>
        </View>
        <View style={styles.rule} />

        {invoice.lineItems.slice(0, MAX_LINE_ITEMS).map((item, index) => (
          <LineItemRow key={item.id} item={item} alt={index % 2 === 1} />
        ))}

        <View style={styles.rule} />

        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{pdfMessages.subtotal}</Text>
            <Text style={styles.totalsValue}>
              {formatInvoiceCurrency(invoice.subtotalAmount, currency)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{pdfMessages.tax}</Text>
            <Text style={styles.totalsValue}>
              {formatInvoiceCurrency(invoice.taxAmount, currency)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{pdfMessages.discount}</Text>
            <Text style={styles.totalsValue}>
              {formatInvoiceCurrency(invoice.discountAmount, currency)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{pdfMessages.total}</Text>
            <Text style={styles.totalValue}>
              {formatInvoiceCurrency(invoice.totalAmount, currency)}
            </Text>
          </View>
          {invoice.totalPaid && invoice.totalPaid > 0 ? (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Sudah Dibayar</Text>
                <Text style={styles.totalsValue}>
                  {formatInvoiceCurrency(invoice.totalPaid, currency)}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Sisa Tagihan</Text>
                <Text style={styles.totalValue}>
                  {formatInvoiceCurrency(invoice.remainingDue ?? 0, currency)}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        <PaymentAllocationsBlock
          allocations={invoice.allocations}
          currency={currency}
        />

        <PaymentDetailsBlock
          paymentMethod={invoice.paymentMethod}
          bankAccounts={bankAccounts}
        />

        <InvoiceFooter />
      </Page>
    </Document>
  )
}

export const buildInvoicePdfBytes = async (
  invoice: InvoiceDetail,
  organization?: OrganizationInput | null,
  bankAccounts?: BankAccountInput[]
): Promise<Buffer> => {
  return renderToBuffer(
    <InvoicePdfDocument
      invoice={invoice}
      organization={organization}
      bankAccounts={bankAccounts}
    />
  )
}
