"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  formatInvoiceCurrency,
  formatInvoiceDate,
  INVOICE_SCREEN_SCENARIO_OPTIONS,
  isInvoiceScreenScenario,
} from "@/modules/invoices/invoices.helpers"
import {
  INVOICE_INTEGRATION_TODOS,
  resolveInvoiceViewScenarioState,
} from "@/modules/invoices/invoices.mock"
import type {
  InvoiceDetail,
  InvoiceScreenScenario,
  InvoiceStatus,
} from "@/modules/invoices/invoices.types"
import { InvoiceScreenStatePanel } from "@/modules/invoices/ui/invoice-screen-state-panel"
import { InvoiceStatusPill } from "@/modules/invoices/ui/invoice-status-pill"

const INVOICE_STATUS_SUMMARY: Record<InvoiceStatus, string> = {
  draft: "Draft invoice. Payment is not open yet.",
  pending: "Payment is due and awaiting settlement.",
  paid: "Invoice has been fully paid.",
  overdue: "Payment is overdue. Follow-up is required.",
  cancel_requested: "Cancellation request is currently under review.",
  canceled: "Invoice has been canceled.",
}

type InvoiceDetailScreenProps = {
  invoiceId: string
  lang: string
  initialScenario: InvoiceScreenScenario
}

const InvoiceIdentitySection = ({ detail }: { detail: InvoiceDetail }) => {
  return (
    <section className="grid gap-2 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Identity</h3>
      <dl className="grid gap-2 text-sm md:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Invoice Number</dt>
          <dd className="font-medium">{detail.invoiceNumber}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Invoice ID</dt>
          <dd className="font-medium">{detail.id}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Customer</dt>
          <dd className="font-medium">{detail.customerName}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Billing Email</dt>
          <dd className="font-medium">{detail.customerEmail}</dd>
        </div>
      </dl>
    </section>
  )
}

const InvoiceStatusSection = ({ detail }: { detail: InvoiceDetail }) => {
  return (
    <section className="grid gap-2 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Due & Payment Status</h3>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <InvoiceStatusPill status={detail.status} />
        <p className="text-muted-foreground">
          {INVOICE_STATUS_SUMMARY[detail.status]}
        </p>
      </div>
      <dl className="grid gap-2 text-sm md:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Issued Date</dt>
          <dd className="font-medium">{formatInvoiceDate(detail.issuedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Due Date</dt>
          <dd className="font-medium">{formatInvoiceDate(detail.dueAt)}</dd>
        </div>
      </dl>
    </section>
  )
}

const InvoiceLineItemsSection = ({ detail }: { detail: InvoiceDetail }) => {
  return (
    <section className="grid gap-2 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Line Items Summary</h3>
        <p className="text-xs text-muted-foreground">
          {detail.lineItems.length} line item
          {detail.lineItems.length > 1 ? "s" : ""}
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit Price</TableHead>
            <TableHead className="text-right">Line Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {detail.lineItems.map((lineItem) => (
            <TableRow key={lineItem.id}>
              <TableCell className="font-medium">
                {lineItem.description}
              </TableCell>
              <TableCell className="text-right">{lineItem.quantity}</TableCell>
              <TableCell className="text-right">
                {formatInvoiceCurrency(lineItem.unitPrice, detail.currency)}
              </TableCell>
              <TableCell className="text-right">
                {formatInvoiceCurrency(lineItem.lineTotal, detail.currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}

const InvoiceTotalsSection = ({ detail }: { detail: InvoiceDetail }) => {
  return (
    <section className="grid gap-2 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Totals</h3>
      <dl className="grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="font-medium">
            {formatInvoiceCurrency(detail.subtotalAmount, detail.currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Tax</dt>
          <dd className="font-medium">
            {formatInvoiceCurrency(detail.taxAmount, detail.currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2 border-t pt-2">
          <dt className="font-semibold">Total</dt>
          <dd className="font-semibold">
            {formatInvoiceCurrency(detail.totalAmount, detail.currency)}
          </dd>
        </div>
      </dl>
    </section>
  )
}

const InvoiceMetadataSection = ({
  detail,
  scenario,
}: {
  detail: InvoiceDetail
  scenario: InvoiceScreenScenario
}) => {
  return (
    <section className="grid gap-2 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Metadata</h3>
      <dl className="grid gap-2 text-sm md:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Mock Source</dt>
          <dd className="font-medium">modules/invoices/invoices.mock.ts</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Scenario</dt>
          <dd className="font-medium">{scenario}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Currency</dt>
          <dd className="font-medium">{detail.currency}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Notes</dt>
          <dd className="font-medium">{detail.notes}</dd>
        </div>
      </dl>
    </section>
  )
}

export function InvoiceDetailScreen({
  invoiceId,
  lang,
  initialScenario,
}: InvoiceDetailScreenProps) {
  const locale = resolveLocaleOrDefault(lang)
  const [scenario, setScenario] =
    useState<InvoiceScreenScenario>(initialScenario)

  const state = useMemo(() => {
    return resolveInvoiceViewScenarioState({
      invoiceId,
      scenario,
    })
  }, [invoiceId, scenario])

  const invoiceBasePath = localizePathname({
    pathname: `/console/invoices/${invoiceId}`,
    locale,
  })

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Action Placeholders</h2>
          <p className="text-xs text-muted-foreground">
            Screen-first action entry points for upcoming invoice workflows.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`${invoiceBasePath}?flow=download`}>
              Download Invoice
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`${invoiceBasePath}?flow=payment`}>Pay Invoice</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`${invoiceBasePath}?flow=cancel_request`}>
              Request Cancel
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Use scenario controls to validate loading, empty, and failure
          placeholders.
        </p>
        <div className="w-full sm:w-[220px]">
          <Select
            value={scenario}
            onValueChange={(value) => {
              if (isInvoiceScreenScenario(value)) {
                setScenario(value)
              }
            }}
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder="Scenario" />
            </SelectTrigger>
            <SelectContent>
              {INVOICE_SCREEN_SCENARIO_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <InvoiceScreenStatePanel
        flow="view"
        state={state}
        integrationTodos={INVOICE_INTEGRATION_TODOS.view}
        renderSuccess={(detail) => (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{detail.invoiceNumber}</p>
              <InvoiceStatusPill status={detail.status} />
            </div>
            <InvoiceIdentitySection detail={detail} />
            <InvoiceStatusSection detail={detail} />
            <InvoiceLineItemsSection detail={detail} />
            <InvoiceTotalsSection detail={detail} />
            <InvoiceMetadataSection detail={detail} scenario={scenario} />
          </div>
        )}
      />
    </section>
  )
}
