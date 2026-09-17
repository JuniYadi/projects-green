"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
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
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"

type TabDangerProps = {
  stack: StackSummaryDTO
}

function formatRenewalDate(
  renewalAt: string | null | undefined,
  fallback: string
): string {
  if (!renewalAt) return fallback
  const date = new Date(renewalAt)
  if (isNaN(date.getTime())) return fallback
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function TabDanger({ stack }: TabDangerProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)

  const [confirmText, setConfirmText] = useState("")
  const [open, setOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isCancelled, setIsCancelled] = useState(
    Boolean(stack.cancellationScheduled)
  )

  const formattedRenewalDate = formatRenewalDate(
    stack.renewalAt,
    messages.pConsoleSettingsTabDanger.endOfBillingPeriod
  )

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
            : (res.data?.message ??
              messages.pConsoleSettingsTabDanger.cancelFailed)
        throw new Error(errorMessage)
      }
      setIsCancelled(true)
      toast.success(
        messages.pConsoleSettingsTabDanger.cancelScheduledToast.replace(
          "{date}",
          formattedRenewalDate
        )
      )
      setOpen(false)
    } catch {
      toast.error(messages.pConsoleSettingsTabDanger.cancelFailedRetry)
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base text-destructive">
          {messages.pConsoleSettingsTabDanger.serviceCancellation}
        </CardTitle>
        <CardDescription>
          {messages.pConsoleSettingsTabDanger.serviceCancellationDescription}
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
              {messages.pConsoleSettingsTabDanger.cancellationScheduled}
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              {messages.pConsoleSettingsTabDanger.cancellationScheduledFor.replace(
                "{date}",
                formattedRenewalDate
              )}
            </p>
          </div>
        ) : (
          <div
            className={
              "rounded-lg border border-destructive/20 bg-destructive/5 p-4"
            }
          >
            <h4 className="text-sm font-semibold text-destructive">
              {messages.pConsoleSettingsTabDanger.serviceCancellation}
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              {
                messages.pConsoleSettingsTabDanger
                  .serviceCancellationDescription
              }
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {messages.pConsoleSettingsTabDanger.billingNoticeBefore}
              <strong className="text-foreground">
                {formattedRenewalDate}
              </strong>
              {messages.pConsoleSettingsTabDanger.billingNoticeAfter}
            </p>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm" className="mt-4">
                  {messages.pConsoleSettingsTabDanger.cancelSubscription}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {messages.pConsoleSettingsTabDanger.cancelSubscriptionFor.replace(
                      "{name}",
                      stack.name
                    )}
                  </DialogTitle>
                  <DialogDescription>
                    {messages.pConsoleSettingsTabDanger.cancelSubscriptionIntro.replace(
                      "{date}",
                      formattedRenewalDate
                    )}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {messages.pConsoleSettingsTabDanger.typePrefix}{" "}
                    <code
                      className={
                        "rounded bg-muted px-1.5 py-0.5 text-xs font-semibold"
                      }
                    >
                      {stack.name}
                    </code>{" "}
                    {messages.pConsoleSettingsTabDanger.typeSuffix}
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
                    {messages.pConsoleSettingsTabDanger.cancel}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isCancelling || confirmText !== stack.name}
                    onClick={handleCancel}
                  >
                    {isCancelling
                      ? messages.pConsoleSettingsTabDanger.cancelling
                      : messages.pConsoleSettingsTabDanger.confirmCancellation}
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
