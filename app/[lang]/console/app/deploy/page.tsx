"use client"

import { useState } from "react"
import { toast } from "sonner"
import { eden } from "@/lib/eden"

import { Button } from "@/components/ui/button"
import {
  QuickDeployDialog,
  TemplateCatalog,
} from "@/components/deploy/template-catalog"
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
import type { ManagedAppTemplate } from "@/modules/deploy/managed-app-templates"

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
  const [selectedTemplate, setSelectedTemplate] =
    useState<ManagedAppTemplate | null>(null)
  const [templateDeploying, setTemplateDeploying] = useState(false)

  const submitTemplate = async (params: {
    subdomain: string
    cpu?: number
    memory?: number
    resourcePlanId?: string
    billingMode?: "PAYG" | "PACKAGE"
  }) => {
    if (!selectedTemplate) return

    setTemplateDeploying(true)
    try {
      const { data: payload } = await eden.api.deploy.submit.post({
        sourceType: "MANAGED_TEMPLATE",
        templateId: selectedTemplate.id,
        subdomain: params.subdomain,
        billingMode: params.billingMode ?? "PAYG",
        resourcePlanId: params.resourcePlanId ?? "payg",
        cpu: params.cpu,
        memory: params.memory,
      })
      if (!payload || !("ok" in payload) || !payload.ok) {
        const msg =
          payload && "message" in payload
            ? String(payload.message)
            : "Deploy failed"
        throw new Error(msg)
      }

      const stackId =
        payload && "data" in payload && payload.data
          ? (payload.data as { stackId?: string }).stackId
          : undefined

      setSelectedTemplate(null)
      toast.success(
        `${selectedTemplate.name} deployment started${
          stackId ? ` (${stackId})` : ""
        }.`
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Deploy failed")
    } finally {
      setTemplateDeploying(false)
    }
  }

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
      <section className="rounded-xl border border-border bg-card p-6">
        <TemplateCatalog
          onSelect={setSelectedTemplate}
          isDeploying={templateDeploying}
        />
      </section>
      {selectedTemplate !== null && (
        <QuickDeployDialog
          template={selectedTemplate}
          open
          onClose={() => setSelectedTemplate(null)}
          onConfirm={submitTemplate}
        />
      )}
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
