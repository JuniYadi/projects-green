"use client"

import { useParams } from "next/navigation"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { AiDetectionDTO, AiManualOverrideDTO } from "./ai-deploy.types"

type Props = {
  open: boolean
  onClose: () => void
  detection: AiDetectionDTO | null
  manualOverride?: AiManualOverrideDTO
  onChangeSettings: () => void
}

const value = (v: string | number | null | undefined, fallback: string) =>
  v ?? fallback

export function DetectionDetailsDialog({
  open,
  onClose,
  detection,
  onChangeSettings,
}: Props) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const notDetected = messages.pDeployAiFeedDetectionDetailsDialog.notDetected

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {messages.pDeployAiFeedDetectionDetailsDialog.title}
          </DialogTitle>
          <DialogDescription>
            {messages.pDeployAiFeedDetectionDetailsDialog.description}
          </DialogDescription>
        </DialogHeader>
        {!detection ? (
          <p className="py-4 text-sm text-muted-foreground">{notDetected}</p>
        ) : (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <dt>{messages.pDeployAiFeedDetectionDetailsDialog.framework}</dt>
              <dd>{value(detection.framework, notDetected)}</dd>
              <dt>
                {messages.pDeployAiFeedDetectionDetailsDialog.frameworkVersion}
              </dt>
              <dd>{value(detection.frameworkVersion, notDetected)}</dd>
              <dt>{messages.pDeployAiFeedDetectionDetailsDialog.runtime}</dt>
              <dd>{value(detection.primaryEngine, notDetected)}</dd>
              <dt>
                {messages.pDeployAiFeedDetectionDetailsDialog.runtimeVersion}
              </dt>
              <dd>{value(detection.primaryEngineVersion, notDetected)}</dd>
              <dt>
                {messages.pDeployAiFeedDetectionDetailsDialog.buildCommand}
              </dt>
              <dd>{value(detection.buildCommand, notDetected)}</dd>
              <dt>
                {messages.pDeployAiFeedDetectionDetailsDialog.startCommand}
              </dt>
              <dd>{value(detection.startCommand, notDetected)}</dd>
              <dt>{messages.pDeployAiFeedDetectionDetailsDialog.port}</dt>
              <dd>{value(detection.defaultPort, notDetected)}</dd>
              <dt>Dockerfile</dt>
              <dd>
                {detection.useDockerfile
                  ? value(detection.dockerfilePath, notDetected)
                  : notDetected}
              </dd>
              <dt>{messages.pDeployAiFeedDetectionDetailsDialog.confidence}</dt>
              <dd>
                {detection.confidence == null
                  ? notDetected
                  : `${Math.round(detection.confidence * 100)}%`}
              </dd>
            </dl>
            <div>
              <h4 className="font-medium">
                {messages.pDeployAiFeedDetectionDetailsDialog.evidence}
              </h4>
              <ul className="mt-2 space-y-1">
                {detection.evidence.map((item, i) => (
                  <li key={`${item.kind}-${i}`}>
                    ✓ {item.kind}: {item.summary}
                    {item.reference ? ` (${item.reference})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onChangeSettings}>
            {messages.pDeployAiFeedDetectionDetailsDialog.changeSettings}
          </Button>
          <DialogClose asChild>
            <Button>
              {messages.pDeployAiFeedDetectionDetailsDialog.close}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
