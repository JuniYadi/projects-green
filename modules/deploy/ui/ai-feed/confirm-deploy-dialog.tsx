"use client"

import type { ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
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
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm deployment</DialogTitle>
          <DialogDescription>
            This will create/update the app stack and start a build.
          </DialogDescription>
        </DialogHeader>
        {plan && (
          <dl className="grid gap-4">
            <Field label="Repository">{plan.source.url}</Field>
            <Field label="Runtime">
              {plan.detection.runtime} {plan.detection.version}
            </Field>
            <Field label="Resources">
              {plan.resources.package} · {plan.resources.cpu}m CPU ·{" "}
              {plan.resources.memory}MB
            </Field>
            <Field label="Estimated cost">
              {plan.billing.estimate == null
                ? null
                : `${plan.billing.currency ?? ""} ${plan.billing.estimate}/${plan.billing.interval ?? "hour"}`}
            </Field>
            <Field label="Domain">
              {plan.domain.hostname ?? plan.domain.mode}
            </Field>
          </dl>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={Boolean(isConfirming) || !plan} onClick={onConfirm}>
            {isConfirming ? "Deploying…" : "Confirm & deploy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
