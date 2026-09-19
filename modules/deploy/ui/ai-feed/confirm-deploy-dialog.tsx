"use client"

import type { ReactNode } from "react"
import { useParams } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { DeploymentPlanDTO } from "./ai-deploy.types"

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  plan: DeploymentPlanDTO | null
  isConfirming?: boolean
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children || "Not detected"}</dd>
    </div>
  )
}
export function ConfirmDeployDialog({
  open,
  onClose,
  onConfirm,
  plan,
  isConfirming,
}: Props) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale).pConfirmDeployDialog

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{messages.title}</DialogTitle>
          <DialogDescription>
            {messages.description}
          </DialogDescription>
        </DialogHeader>
        {plan && (
          <dl className="grid gap-4">
            <Field label={messages.repository}>{plan.source.url}</Field>
            <Field label={messages.runtime}>
              {plan.detection.runtime} {plan.detection.version}
            </Field>
            <Field label={messages.resources}>
              {plan.resources.package} · {messages.cpuUnit.replace("{cpu}", String(plan.resources.cpu))} ·{" "}
              {plan.resources.memory}MB
            </Field>
            <Field label={messages.estimatedCost}>
              {plan.billing.estimate == null
                ? null
                : `${plan.billing.currency ?? ""} ${plan.billing.estimate}/${plan.billing.interval ?? "hour"}`}
            </Field>
            <Field label={messages.domain}>
              {plan.domain.hostname ?? plan.domain.mode}
            </Field>
          </dl>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {messages.cancel}
          </Button>
          <Button disabled={Boolean(isConfirming) || !plan} onClick={onConfirm}>
            {isConfirming ? messages.deploying : messages.confirmDeploy}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
