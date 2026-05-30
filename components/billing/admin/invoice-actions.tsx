"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type InvoiceStatus = "DRAFT" | "OPEN" | "PAID" | "VOID" | "UNCOLLECTIBLE"

type InvoiceActionsProps = {
  invoiceId: string
  invoiceStatus: InvoiceStatus
  createdAt: string
}

type ActionState = "idle" | "submitting"

export function InvoiceActions({
  invoiceId,
  invoiceStatus,
  createdAt,
}: InvoiceActionsProps) {
  const router = useRouter()
  const [actionState, setActionState] = useState<ActionState>("idle")
  const [showVoidDialog, setShowVoidDialog] = useState(false)

  // Check if within 7 days of creation
  function isWithin7Days(): boolean {
    const createdDate = new Date(createdAt)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - createdDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays <= 7
  }

  // Finalize button: only show when status === "DRAFT"
  const canFinalize = invoiceStatus === "DRAFT"

  // Void button: show when status === "OPEN" or "PAID", but only if within 7 days
  const canVoid =
    (invoiceStatus === "OPEN" || invoiceStatus === "PAID") && isWithin7Days()

  // No actions available
  if (!canFinalize && !canVoid) {
    return null
  }

  async function handleFinalize() {
    setActionState("submitting")

    try {
      const response = await fetch("/api/billing/admin/invoice-finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      })

      const data = await response.json()

      if (!response.ok || data.ok === false) {
        throw new Error(data.message || "Failed to finalize invoice")
      }

      toast.success("Invoice finalized successfully")
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to finalize invoice"
      toast.error(message)
    } finally {
      setActionState("idle")
    }
  }

  async function handleVoid() {
    setActionState("submitting")
    setShowVoidDialog(false)

    try {
      const response = await fetch(`/api/billing/admin/invoices/${invoiceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "void" }),
      })

      const data = await response.json()

      if (!response.ok || data.ok === false) {
        throw new Error(data.message || "Failed to void invoice")
      }

      toast.success("Invoice voided successfully")
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to void invoice"
      toast.error(message)
    } finally {
      setActionState("idle")
    }
  }

  return (
    <div className="flex items-center gap-2">
      {canFinalize && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleFinalize}
          disabled={actionState === "submitting"}
        >
          {actionState === "submitting" ? "Finalizing..." : "Finalize"}
        </Button>
      )}

      {canVoid && (
        <Dialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
          <DialogTrigger asChild>
            <Button size="sm" variant="destructive">
              Void
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Void Invoice</DialogTitle>
              <DialogDescription>
                Are you sure you want to void this invoice? This action cannot be
                undone. The invoice will be marked as void and no longer valid for
                payment.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowVoidDialog(false)}
                disabled={actionState === "submitting"}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleVoid}
                disabled={actionState === "submitting"}
              >
                {actionState === "submitting" ? "Voiding..." : "Void Invoice"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}