"use client"

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
import type { AiDetectionDTO, AiManualOverrideDTO } from "./ai-deploy.types"

type Props = {
  open: boolean
  onClose: () => void
  detection: AiDetectionDTO | null
  manualOverride?: AiManualOverrideDTO
  onChangeSettings: () => void
}

const value = (v: string | number | null | undefined) => v ?? "Not detected"

export function DetectionDetailsDialog({
  open,
  onClose,
  detection,
  onChangeSettings,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Detection details</DialogTitle>
          <DialogDescription>
            Evidence collected from your source.
          </DialogDescription>
        </DialogHeader>
        {!detection ? (
          <p className="py-4 text-sm text-muted-foreground">Not detected</p>
        ) : (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <dt>Framework</dt>
              <dd>{value(detection.framework)}</dd>
              <dt>Framework Version</dt>
              <dd>{value(detection.frameworkVersion)}</dd>
              <dt>Runtime</dt>
              <dd>{value(detection.primaryEngine)}</dd>
              <dt>Runtime Version</dt>
              <dd>{value(detection.primaryEngineVersion)}</dd>
              <dt>Build command</dt>
              <dd>{value(detection.buildCommand)}</dd>
              <dt>Start command</dt>
              <dd>{value(detection.startCommand)}</dd>
              <dt>Port</dt>
              <dd>{value(detection.defaultPort)}</dd>
              <dt>Dockerfile</dt>
              <dd>
                {detection.useDockerfile
                  ? value(detection.dockerfilePath)
                  : "Not detected"}
              </dd>
              <dt>Confidence</dt>
              <dd>
                {detection.confidence == null
                  ? "Not detected"
                  : `${Math.round(detection.confidence * 100)}%`}
              </dd>
            </dl>
            <div>
              <h4 className="font-medium">Evidence</h4>
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
            Change settings
          </Button>
          <DialogClose asChild>
            <Button>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
