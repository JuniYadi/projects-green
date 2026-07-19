"use client"

import { useState } from "react"
import { eden } from "@/lib/eden"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

type InvoiceStatus =
  | "DRAFT"
  | "OPEN"
  | "OVERDUE"
  | "PAID"
  | "VOID"
  | "UNCOLLECTIBLE"

type ConfirmPaymentButtonProps = {
  invoiceId: string
  invoiceStatus: InvoiceStatus
}

export function ConfirmPaymentButton({
  invoiceId,
  invoiceStatus,
}: ConfirmPaymentButtonProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  const canConfirm = invoiceStatus === "OPEN" || invoiceStatus === "OVERDUE"

  if (!canConfirm) {
    return null
  }

  async function handleConfirmPayment() {
    setIsPending(true)

    try {
      const { data } = await eden.api.billing.admin.invoices[invoiceId].patch({
        status: "PAID",
      } as never)

      if (!data) {
        throw new Error("No response from server")
      }

      if (!data.ok) {
        const errorMessage =
          "message" in data && typeof data.message === "string"
            ? data.message
            : "Failed to confirm payment"
        throw new Error(errorMessage)
      }

      toast.success("Payment confirmed successfully")
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to confirm payment"
      toast.error(message)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="default"
      onClick={handleConfirmPayment}
      disabled={isPending}
    >
      {isPending ? "Confirming..." : "Confirm Payment"}
    </Button>
  )
}
