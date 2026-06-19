"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  PaymentConfirmationDTO,
  PaymentInfoDTO,
  PaymentTimelineEvent,
} from "@/modules/invoices/invoices.types"
import { ConfirmPaymentDialog } from "@/modules/invoices/ui/confirm-payment-dialog"

type PaymentMethodLabel = {
  label: string
  description: string
}

const PAYMENT_METHOD_LABELS: Record<string, PaymentMethodLabel> = {
  VA: { label: "Virtual Account", description: "Virtual Account (VA)" },
  QRIS: { label: "QRIS", description: "QRIS" },
  MANUAL_BANK: {
    label: "Manual Bank Transfer",
    description: "Manual Bank Transfer",
  },
  CASH: { label: "Cash", description: "Cash" },
  CHEQUE: { label: "Cheque", description: "Cheque" },
  OTHER: { label: "Other", description: "Other" },
}

const getPaymentMethodLabel = (method: string | null): PaymentMethodLabel => {
  if (!method) {
    return { label: "—", description: "—" }
  }
  return (
    PAYMENT_METHOD_LABELS[method] ?? {
      label: method,
      description: method,
    }
  )
}

const formatConfirmationStatus = (
  status: PaymentConfirmationDTO["status"]
): { label: string; className: string } => {
  switch (status) {
    case "APPROVED":
      return { label: "Approved", className: "text-green-600" }
    case "REJECTED":
      return { label: "Rejected", className: "text-destructive" }
    default:
      return { label: "Pending", className: "text-amber-600" }
  }
}

const TIMELINE_ICONS: Record<PaymentTimelineEvent["type"], string> = {
  issued: "📄",
  payment_submitted: "📩",
  payment_approved: "✅",
  payment_rejected: "❌",
  paid: "💰",
}

type PaymentMethodGatewayCardProps = {
  payment: PaymentInfoDTO
}

export function PaymentMethodGatewayCard({
  payment,
}: PaymentMethodGatewayCardProps) {
  const methodLabel = getPaymentMethodLabel(payment.method)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Payment Method &amp; Gateway
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Payment Method</p>
            <p className="font-medium">{methodLabel.description}</p>
          </div>

          {payment.gateway ? (
            <div>
              <p className="text-xs text-muted-foreground">Gateway</p>
              <p className="font-medium">
                {payment.gateway.name}{" "}
                <span className="text-xs text-muted-foreground">
                  ({payment.gateway.type})
                </span>
              </p>
            </div>
          ) : null}
        </div>

        {payment.reference ? (
          <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Payment Reference
            </p>
            {payment.reference.vaNumber ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">VA Number</span>
                <span className="font-mono text-sm font-medium">
                  {payment.reference.vaNumber}
                </span>
              </div>
            ) : null}
            {payment.reference.paymentUrl ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Payment URL
                </span>
                <a
                  href={payment.reference.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline"
                >
                  Open Payment Page
                </a>
              </div>
            ) : null}
            {payment.reference.gatewayReference ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Gateway Reference
                </span>
                <span className="font-mono text-sm font-medium">
                  {payment.reference.gatewayReference}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

type PaymentConfirmationListProps = {
  confirmations: PaymentConfirmationDTO[]
  canManage: boolean
  onActionComplete: () => void
}

export function PaymentConfirmationList({
  confirmations,
  canManage,
  onActionComplete,
}: PaymentConfirmationListProps) {
  const [selectedConfirmation, setSelectedConfirmation] =
    useState<PaymentConfirmationDTO | null>(null)

  if (confirmations.length === 0) {
    return null
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Payment Confirmations ({confirmations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bank</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                {canManage ? (
                  <TableHead className="text-right">Action</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {confirmations.map((confirmation) => {
                const statusInfo = formatConfirmationStatus(confirmation.status)
                return (
                  <TableRow key={confirmation.id}>
                    <TableCell className="font-medium">
                      {confirmation.bankName}
                    </TableCell>
                    <TableCell>{confirmation.accountName}</TableCell>
                    <TableCell className="text-right">
                      {confirmation.amount.toLocaleString()}{" "}
                      {confirmation.currency}
                    </TableCell>
                    <TableCell>{confirmation.senderName ?? "—"}</TableCell>
                    <TableCell>
                      {new Date(
                        confirmation.paymentDateTime
                      ).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          statusInfo.className + " text-xs font-medium"
                        }
                      >
                        {statusInfo.label}
                      </span>
                    </TableCell>
                    {canManage && confirmation.status === "PENDING" ? (
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedConfirmation(confirmation)}
                        >
                          Review
                        </Button>
                      </TableCell>
                    ) : canManage ? (
                      <TableCell />
                    ) : null}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedConfirmation ? (
        <ConfirmPaymentDialog
          confirmation={selectedConfirmation}
          open={true}
          onOpenChange={(open) => {
            if (!open) setSelectedConfirmation(null)
          }}
          canManage={canManage}
          onActionComplete={onActionComplete}
        />
      ) : null}
    </>
  )
}

type InvoicePaymentSectionProps = {
  payment: PaymentInfoDTO
  canManageConfirmations: boolean
  onActionComplete: () => void
}

export function InvoicePaymentSection({
  payment,
  canManageConfirmations,
  onActionComplete,
}: InvoicePaymentSectionProps) {
  return (
    <>
      <PaymentMethodGatewayCard payment={payment} />
      <PaymentConfirmationList
        confirmations={payment.confirmations}
        canManage={canManageConfirmations}
        onActionComplete={onActionComplete}
      />
      <PaymentTimeline timeline={payment.timeline} />
    </>
  )
}

type PaymentTimelineProps = {
  timeline: PaymentTimelineEvent[]
}

function PaymentTimeline({ timeline }: PaymentTimelineProps) {
  if (timeline.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Payment Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative ml-3 space-y-0">
          {/* Vertical line */}
          <div className="absolute top-2 left-[11px] h-[calc(100%-16px)] w-0.5 bg-border" />

          {timeline.map((event, index) => {
            return (
              <div
                key={`${event.type}-${index}`}
                className="relative flex gap-4 pb-6 last:pb-0"
              >
                {/* Icon circle */}
                <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-xs">
                  {TIMELINE_ICONS[event.type] ?? "•"}
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col gap-0.5 pt-0.5">
                  <p className="text-sm font-medium">{event.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.at).toLocaleString()}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
