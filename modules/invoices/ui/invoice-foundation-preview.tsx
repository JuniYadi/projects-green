"use client"

import { useState } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  formatInvoiceCurrency,
  INVOICE_SCREEN_SCENARIO_OPTIONS,
} from "@/modules/invoices/invoices.helpers"
import type { InvoiceScreenScenario } from "@/modules/invoices/invoices.types"
import { InvoiceScreenStatePanel } from "@/modules/invoices/ui/invoice-screen-state-panel"
import { InvoiceStatusPill } from "@/modules/invoices/ui/invoice-status-pill"
import { useInvoiceMockFlowState } from "@/modules/invoices/ui/use-invoice-mock-flow-state"

export function InvoiceFoundationPreview() {
  const [scenario, setScenario] = useState<InvoiceScreenScenario>("success")
  const view = useInvoiceMockFlowState("view", scenario)
  const download = useInvoiceMockFlowState("download", scenario)
  const payment = useInvoiceMockFlowState("payment", scenario)
  const cancelRequest = useInvoiceMockFlowState("cancel_request", scenario)

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Shared screen-state preview for upcoming invoice surfaces.
        </p>
        <div className="w-full sm:w-[220px]">
          <Select
            value={scenario}
            onValueChange={(value) => setScenario(value as InvoiceScreenScenario)}
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

      <div className="grid gap-4 xl:grid-cols-2">
        <InvoiceScreenStatePanel
          flow="view"
          state={view.state}
          integrationTodos={view.integrationTodos}
          renderSuccess={(data) => (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{data.invoiceNumber}</span>
                <InvoiceStatusPill status={data.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {data.customerName} ({data.customerEmail})
              </p>
              <p className="text-xs text-muted-foreground">
                {data.lineItems.length} line items
              </p>
            </div>
          )}
        />

        <InvoiceScreenStatePanel
          flow="download"
          state={download.state}
          integrationTodos={download.integrationTodos}
          renderSuccess={(data) => (
            <div className="space-y-2 text-sm">
              <p className="font-medium">{data.invoice.invoiceNumber}</p>
              <p className="text-xs text-muted-foreground">
                Available formats: {data.availableFormats.join(", ")}
              </p>
            </div>
          )}
        />

        <InvoiceScreenStatePanel
          flow="payment"
          state={payment.state}
          integrationTodos={payment.integrationTodos}
          renderSuccess={(data) => (
            <div className="space-y-2 text-sm">
              <p className="font-medium">{data.invoice.invoiceNumber}</p>
              <p className="text-xs text-muted-foreground">
                Balance due: {formatInvoiceCurrency(data.balanceDueAmount)}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.paymentMethods.length} mock payment methods
              </p>
            </div>
          )}
        />

        <InvoiceScreenStatePanel
          flow="cancel_request"
          state={cancelRequest.state}
          integrationTodos={cancelRequest.integrationTodos}
          renderSuccess={(data) => (
            <div className="space-y-2 text-sm">
              <p className="font-medium">{data.invoice.invoiceNumber}</p>
              <p className="text-xs text-muted-foreground">
                Request reasons: {data.requestReasons.length}
              </p>
              <p className="text-xs text-muted-foreground">
                Cancel eligibility: {data.canRequestCancel ? "Allowed" : "Blocked"}
              </p>
            </div>
          )}
        />
      </div>
    </section>
  )
}
