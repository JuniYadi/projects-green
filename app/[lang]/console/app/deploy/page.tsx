"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useAiDeployFeed } from "@/modules/deploy/ui/ai-feed/use-ai-deploy-feed"
import { FeedMessage } from "@/modules/deploy/ui/ai-feed/feed-message"
import { FeedShell } from "@/modules/deploy/ui/ai-feed/feed-shell"
import { SourceComposer } from "@/modules/deploy/ui/ai-feed/source-composer"
import { ManualSettingsDialog } from "@/modules/deploy/ui/ai-feed/manual-settings-dialog"
import { ResourceSizeDialog } from "@/modules/deploy/ui/ai-feed/resource-size-dialog"
import { DetectionDetailsDialog } from "@/modules/deploy/ui/ai-feed/detection-details-dialog"
import { EnvValuesDialog } from "@/modules/deploy/ui/ai-feed/env-values-dialog"
import { PlanDetailsDialog } from "@/modules/deploy/ui/ai-feed/plan-details-dialog"
import { ConfirmDeployDialog } from "@/modules/deploy/ui/ai-feed/confirm-deploy-dialog"

const labels: Record<string, string> = {
  inspecting: "Inspecting your repository…",
  source_found: "Repository found",
  access_verified: "Access verified",
  access_required: "GitHub access is required",
  access_denied: "GitHub access was denied",
  detecting: "Detecting the application stack…",
  detection_success: "Application detected",
  detection_low_conf: "I need a few build settings",
  detection_failed: "Detection failed",
  plan_ready: "Deployment plan is ready",
  deploying: "Deployment started",
  build_step: "Building application",
  deploy_step: "Deploying application",
  live: "Your application is live",
  failed: "Deployment failed",
  not_supported: "This source is not supported",
}

export default function DeployPage() {
  const feed = useAiDeployFeed()
  const [detectionOpen, setDetectionOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [resourceOpen, setResourceOpen] = useState(false)
  const [envOpen, setEnvOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const latest = feed.items[feed.items.length - 1]

  return (
    <>
      <FeedShell
        onNewDeployment={feed.reset}
        hasActiveSession={Boolean(feed.session)}
        composer={
          <SourceComposer onSubmit={feed.submit} disabled={feed.isInspecting} />
        }
      >
        {feed.items.map((entry) => (
          <FeedMessage
            key={entry.id}
            kind={entry.kind}
            statement={labels[entry.kind] ?? entry.kind}
            timestamp={entry.timestamp}
            working={
              entry.kind === "inspecting" ||
              entry.kind === "detecting" ||
              entry.kind === "deploying"
            }
            details={entry.errorMessage}
            actions={
              entry.kind === "access_required" ? (
                <Button size="sm" onClick={feed.connectGithub}>
                  Connect GitHub
                </Button>
              ) : entry.kind === "detection_success" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDetectionOpen(true)}
                >
                  View detection details
                </Button>
              ) : entry.kind === "plan_ready" ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPlanOpen(true)}
                  >
                    View deployment plan
                  </Button>
                  <Button size="sm" onClick={() => setConfirmOpen(true)}>
                    Confirm & deploy
                  </Button>
                </>
              ) : (entry.kind === "detection_low_conf" ||
                  entry.kind === "detection_failed") &&
                entry.manualOverride ? (
                <Button size="sm" onClick={() => setManualOpen(true)}>
                  Set deployment settings
                </Button>
              ) : undefined
            }
          />
        ))}
        {feed.items.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Enter a GitHub repository URL to get started.
          </p>
        )}
      </FeedShell>
      <DetectionDetailsDialog
        open={detectionOpen}
        onClose={() => setDetectionOpen(false)}
        detection={latest?.detection ?? null}
        onChangeSettings={() => {
          setDetectionOpen(false)
          setManualOpen(true)
        }}
      />
      <ManualSettingsDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSave={async (s) => {
          await feed.applyManualSettings(s)
          setManualOpen(false)
        }}
      />
      <ResourceSizeDialog
        open={resourceOpen}
        onClose={() => setResourceOpen(false)}
        onSelect={async (r) => {
          await feed.selectResource(r)
          setResourceOpen(false)
        }}
      />
      <EnvValuesDialog
        open={envOpen}
        onClose={() => setEnvOpen(false)}
        onSave={async (v) => {
          await feed.setEnvValues(v)
          setEnvOpen(false)
        }}
        envRequirements={
          feed.session?.plan?.configuration.envRequirements ?? []
        }
      />
      <PlanDetailsDialog
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        plan={feed.session?.plan ?? latest?.plan ?? null}
        onChangeSettings={() => {
          setPlanOpen(false)
          setManualOpen(true)
        }}
        onChangeEnv={() => {
          setPlanOpen(false)
          setEnvOpen(true)
        }}
      />
      <ConfirmDeployDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        plan={feed.session?.plan ?? latest?.plan ?? null}
        onConfirm={async () => {
          await feed.confirm(crypto.randomUUID())
          setConfirmOpen(false)
        }}
      />
    </>
  )
}
