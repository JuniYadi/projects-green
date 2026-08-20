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
import { Badge } from "@/components/ui/badge"
import type { DeploymentPlanDTO } from "./ai-deploy.types"

type Props = {
  open: boolean
  onClose: () => void
  plan: DeploymentPlanDTO | null
  onChangeSettings: () => void
  onChangeEnv: () => void
}
const Display = ({ children }: { children: ReactNode }) => (
  <dd className="text-sm text-muted-foreground">
    {children ?? "Not detected"}
  </dd>
)
export function PlanDetailsDialog({
  open,
  onClose,
  plan,
  onChangeSettings,
  onChangeEnv,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Deployment plan</DialogTitle>
          <DialogDescription>
            Review the complete deployment configuration.
          </DialogDescription>
        </DialogHeader>
        {!plan ? (
          <p>Not detected</p>
        ) : (
          <div className="space-y-6">
            <section>
              <h3 className="font-semibold">Source</h3>
              <dl className="grid grid-cols-2 gap-2">
                <dt>URL</dt>
                <Display>{plan.source.url}</Display>
                <dt>Ref</dt>
                <Display>{plan.source.ref}</Display>
              </dl>
            </section>
            <section>
              <h3 className="font-semibold">Build</h3>
              <dl className="grid grid-cols-2 gap-2">
                <dt>Runtime</dt>
                <Display>
                  {plan.detection.runtime} {plan.detection.version}
                </Display>
                <dt>Framework</dt>
                <Display>{plan.detection.framework}</Display>
                <dt>Commands</dt>
                <Display>{plan.detection.commands.join(" · ")}</Display>
              </dl>
            </section>
            <section>
              <h3 className="font-semibold">Configuration</h3>
              <dl className="grid grid-cols-2 gap-2">
                <dt>App</dt>
                <Display>{plan.configuration.appName}</Display>
                <dt>Environment</dt>
                <Display>{plan.configuration.environment}</Display>
              </dl>
              <div className="mt-2 space-y-1">
                {plan.configuration.envRequirements.map((e) => (
                  <div key={e.key} className="flex justify-between text-sm">
                    {e.key}
                    <Badge variant="outline">{e.status}</Badge>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3 className="font-semibold">Dependencies</h3>
              <Display>
                {plan.dependencies
                  .map((d) => `${d.key} (${d.status})`)
                  .join(", ") || "None"}
              </Display>
            </section>
            <section>
              <h3 className="font-semibold">Resources</h3>
              <Display>
                {plan.resources.package} · {plan.resources.cpu}m CPU ·{" "}
                {plan.resources.memory}MB · {plan.resources.region}
              </Display>
            </section>
            <section>
              <h3 className="font-semibold">Domain</h3>
              <Display>{plan.domain.hostname ?? plan.domain.mode}</Display>
            </section>
            <section>
              <h3 className="font-semibold">Execution steps</h3>
              <ol className="list-decimal pl-5 text-sm">
                {plan.execution.steps.map((s) => (
                  <li key={s.key}>
                    {s.label} ({s.status})
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onChangeSettings}>
            Change settings
          </Button>
          <Button variant="outline" onClick={onChangeEnv}>
            Change environment
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
