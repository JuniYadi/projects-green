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
import { Badge } from "@/components/ui/badge"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { DeploymentPlanDTO } from "./ai-deploy.types"

type Props = {
  open: boolean
  onClose: () => void
  plan: DeploymentPlanDTO | null
  onChangeSettings: () => void
  onChangeEnv: () => void
}
const Display = ({ children }: { children: ReactNode }) => {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  return (
    <dd className="text-sm text-muted-foreground">
      {children ?? messages.pDeployAiFeedPlanDetailsDialog.notDetected}
    </dd>
  )
}
export function PlanDetailsDialog({
  open,
  onClose,
  plan,
  onChangeSettings,
  onChangeEnv,
}: Props) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {messages.pDeployAiFeedPlanDetailsDialog.title}
          </DialogTitle>
          <DialogDescription>
            {messages.pDeployAiFeedPlanDetailsDialog.description}
          </DialogDescription>
        </DialogHeader>
        {!plan ? (
          <p>{messages.pDeployAiFeedPlanDetailsDialog.notDetected}</p>
        ) : (
          <div className="space-y-6">
            <section>
              <h3 className="font-semibold">
                {messages.pDeployAiFeedPlanDetailsDialog.sourceHeading}
              </h3>
              <dl className="grid grid-cols-2 gap-2">
                <dt>URL</dt>
                <Display>{plan.source.url}</Display>
                <dt>{messages.pDeployAiFeedPlanDetailsDialog.refLabel}</dt>
                <Display>{plan.source.ref}</Display>
              </dl>
            </section>
            <section>
              <h3 className="font-semibold">
                {messages.pDeployAiFeedPlanDetailsDialog.buildHeading}
              </h3>
              <dl className="grid grid-cols-2 gap-2">
                <dt>{messages.pDeployAiFeedPlanDetailsDialog.runtimeLabel}</dt>
                <Display>
                  {plan.detection.runtime} {plan.detection.version}
                </Display>
                <dt>
                  {messages.pDeployAiFeedPlanDetailsDialog.frameworkLabel}
                </dt>
                <Display>{plan.detection.framework}</Display>
                <dt>{messages.pDeployAiFeedPlanDetailsDialog.commandsLabel}</dt>
                <Display>{plan.detection.commands.join(" · ")}</Display>
              </dl>
            </section>
            <section>
              <h3 className="font-semibold">
                {messages.pDeployAiFeedPlanDetailsDialog.configurationHeading}
              </h3>
              <dl className="grid grid-cols-2 gap-2">
                <dt>App</dt>
                <Display>{plan.configuration.appName}</Display>
                <dt>
                  {messages.pDeployAiFeedPlanDetailsDialog.environmentLabel}
                </dt>
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
              <h3 className="font-semibold">
                {messages.pDeployAiFeedPlanDetailsDialog.dependenciesHeading}
              </h3>
              <Display>
                {plan.dependencies
                  .map((d) => `${d.key} (${d.status})`)
                  .join(", ") || "None"}
              </Display>
            </section>
            <section>
              <h3 className="font-semibold">
                {messages.pDeployAiFeedPlanDetailsDialog.resourcesHeading}
              </h3>
              <Display>
                {plan.resources.package} · {plan.resources.cpu}
                {messages.pDeployAiFeedPlanDetailsDialog.cpuUnitSuffix}{" "}
                {plan.resources.memory}
                {messages.pDeployAiFeedPlanDetailsDialog.memoryUnitSuffix}{" "}
                {plan.resources.region}
              </Display>
            </section>
            <section>
              <h3 className="font-semibold">
                {messages.pDeployAiFeedPlanDetailsDialog.domainHeading}
              </h3>
              <Display>{plan.domain.hostname ?? plan.domain.mode}</Display>
            </section>
            <section>
              <h3 className="font-semibold">
                {messages.pDeployAiFeedPlanDetailsDialog.executionStepsHeading}
              </h3>
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
            {messages.pDeployAiFeedPlanDetailsDialog.changeSettingsButton}
          </Button>
          <Button variant="outline" onClick={onChangeEnv}>
            {messages.pDeployAiFeedPlanDetailsDialog.changeEnvironmentButton}
          </Button>
          <Button onClick={onClose}>
            {messages.pDeployAiFeedPlanDetailsDialog.closeButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
