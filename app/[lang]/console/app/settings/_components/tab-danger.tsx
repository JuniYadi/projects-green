"use client"

import { useState } from "react"
import { toast } from "sonner"
import { eden } from "@/lib/eden"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"

type TabDangerProps = {
  stack: StackSummaryDTO
}

function formatRenewalDate(renewalAt?: string | null): string {
  if (!renewalAt) return "end of current billing period"
  const date = new Date(renewalAt)
  if (isNaN(date.getTime())) return "end of current billing period"
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function TabDanger({ stack }: TabDangerProps) {
  const [confirmText, setConfirmText] = useState("")
  const [open, setOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isCancelled, setIsCancelled] = useState(
    Boolean(stack.cancellationScheduled)
  )

  const formattedRenewalDate = formatRenewalDate(stack.renewalAt)

  const handleCancel = async () => {
    if (confirmText.length > 0 && confirmText !== stack.name) return
    setIsCancelling(true)
    try {
      const res = await eden.api.deploy.apps[stack.slug].cancel.post()

      if (!res.data || !res.data.ok) {
        const errValue = res.error?.value
        const errorMessage =
          errValue && typeof errValue === "object" && "message" in errValue
            ? String(errValue.message)
            : (res.data?.message ?? "Failed to cancel subscription")
        throw new Error(errorMessage)
      }
      setIsCancelled(true)
      toast.success(
        "Service cancellation scheduled. Workloads remain active until " +
          `${formattedRenewalDate}.`
      )
      setOpen(false)
    } catch {
      toast.error("Failed to cancel subscription. Please try again.")
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base text-destructive">
          Service Cancellation
        </CardTitle>
        <CardDescription>
          Cancel service renewal for this application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCancelled ? (
          <div
            className={
              "rounded-lg border border-amber-500/30 bg-amber-500/10 p-4"
            }
          >
            <h4
              className={
                "text-sm font-semibold text-amber-600 dark:text-amber-400"
              }
            >
              Cancellation Scheduled
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Cancellation scheduled for {formattedRenewalDate}. Active until
              renewal date.
            </p>
          </div>
        ) : (
          <div
            className={
              "rounded-lg border border-destructive/20 bg-destructive/5 p-4"
            }
          >
            <h4 className="text-sm font-semibold text-destructive">
              Service Cancellation
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Cancel service renewal for this application.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Your service will remain active with full resources and traffic
              routing until the end of your current billing period (
              <strong className="text-foreground">
                {formattedRenewalDate}
              </strong>
              ). After that date, the subscription will not renew, and workloads
              will be cleanly decommissioned.
            </p>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm" className="mt-4">
                  Cancel Subscription
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    Cancel Subscription for {stack.name}
                  </DialogTitle>
                  <DialogDescription>
                    This will schedule cancellation of your application
                    subscription at the end of the billing period (
                    {formattedRenewalDate}). You will not be billed for
                    subsequent periods.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Type{" "}
                    <code
                      className={
                        "rounded bg-muted px-1.5 py-0.5 text-xs font-semibold"
                      }
                    >
                      {stack.name}
                    </code>{" "}
                    to confirm:
                  </p>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={stack.name}
                  />
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isCancelling || confirmText !== stack.name}
                    onClick={handleCancel}
                  >
                    {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
