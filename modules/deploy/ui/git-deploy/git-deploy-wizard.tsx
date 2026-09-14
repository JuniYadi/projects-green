"use client"

import { useState } from "react"
import { toast } from "sonner"
import { GitSourceStep } from "./git-source-step"
import { GitBuildStep } from "./git-build-step"
import { GitSizingStep } from "./git-sizing-step"
import { GitReviewStep } from "./git-review-step"
import { GitRolloutStep } from "./git-rollout-step"
import type {
  GitBuildConfig,
  GitDeployStep,
  GitSizingConfig,
  GitSourceConfig,
} from "./types"

const STEPS: Array<{ id: GitDeployStep; label: string; number: number }> = [
  { id: "source", label: "Source Intake", number: 1 },
  { id: "config", label: "Build Config", number: 2 },
  { id: "sizing", label: "Compute & Domain", number: 3 },
  { id: "review", label: "Review & Deploy", number: 4 },
  { id: "rollout", label: "Rollout", number: 5 },
]

export function GitDeployWizard() {
  const [currentStep, setCurrentStep] = useState<GitDeployStep>("source")

  // Wizard state
  const [source, setSource] = useState<GitSourceConfig | null>(null)
  const [inspectionData, setInspectionData] = useState<Record<
    string,
    unknown
  > | null>(null)
  const [buildConfig, setBuildConfig] = useState<GitBuildConfig | null>(null)
  const [sizingConfig, setSizingConfig] = useState<GitSizingConfig | null>(null)
  const [deploymentId, setDeploymentId] = useState<string>("dep-initial")

  // Generate suggested subdomain from repository name or URL
  const getSuggestedSubdomain = () => {
    if (!source?.url) return "my-app"
    try {
      const parts = source.url.replace(/\.git$/i, "").split("/")
      const repo = parts[parts.length - 1] || "my-app"
      return repo
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/^-+|-+$/g, "")
    } catch {
      return "my-app"
    }
  }

  const handleSourceVerified = (src: GitSourceConfig, inspected?: unknown) => {
    setSource(src)
    setInspectionData(inspected)
    setCurrentStep("config")
  }

  const handleBuildConfigured = (cfg: GitBuildConfig) => {
    setBuildConfig(cfg)
    setCurrentStep("sizing")
  }

  const handleSizingConfigured = (cfg: GitSizingConfig) => {
    setSizingConfig(cfg)
    setCurrentStep("review")
  }

  const handleDeploy = async () => {
    if (!source || !buildConfig || !sizingConfig) return

    try {
      // If we have an inspect session from /deploy/ai-sessions/inspect, we can confirm it
      const sessionId = inspectionData?.session?.id
      if (sessionId) {
        const res = await fetch(
          `/api/deploy/ai-sessions/${sessionId}/confirm`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subdomain: sizingConfig.subdomain,
              cpu: sizingConfig.cpu,
              memory: sizingConfig.memory,
              billingMode: "PAYG",
              resourcePlanId: sizingConfig.tier,
            }),
          }
        )
        const data = await res.json().catch(() => null)
        if (data?.ok && data?.data?.stackId) {
          setDeploymentId(data.data.stackId)
        }
      }

      toast.success("Application deployment initiated.")
      setCurrentStep("rollout")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to initiate deployment."
      )
      // Still proceed to rollout preview if needed
      setCurrentStep("rollout")
    }
  }

  const handleReset = () => {
    setSource(null)
    setInspectionData(null)
    setBuildConfig(null)
    setSizingConfig(null)
    setCurrentStep("source")
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">
          Deploy Git Repository
        </h1>
        <p className="text-sm text-muted-foreground">
          Import your codebase, configure build settings, and deploy to
          production Kubernetes.
        </p>
      </div>

      {/* Progress Stepper */}
      <nav aria-label="Progress" className="border-b border-border pb-4">
        <ol className="flex flex-wrap items-center gap-2 text-xs font-medium md:gap-4">
          {STEPS.map((step) => {
            const isCurrent = currentStep === step.id
            const isCompleted =
              (step.id === "source" && source !== null) ||
              (step.id === "config" && buildConfig !== null) ||
              (step.id === "sizing" && sizingConfig !== null) ||
              (step.id === "review" && currentStep === "rollout")

            return (
              <li key={step.id} className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                        ? "bg-muted text-foreground"
                        : "border border-border text-muted-foreground"
                  }`}
                >
                  {step.number}
                </span>
                <span
                  className={
                    isCurrent
                      ? "font-semibold text-foreground"
                      : isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }
                >
                  {step.label}
                </span>
                {step.number < STEPS.length && (
                  <span className="text-muted-foreground/40">/</span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Step Views */}
      {currentStep === "source" && (
        <GitSourceStep
          initialSource={source ?? undefined}
          onSourceVerified={handleSourceVerified}
        />
      )}

      {currentStep === "config" && source && (
        <GitBuildStep
          source={source}
          initialConfig={buildConfig ?? undefined}
          inspectionData={inspectionData}
          onBack={() => setCurrentStep("source")}
          onNext={handleBuildConfigured}
        />
      )}

      {currentStep === "sizing" && (
        <GitSizingStep
          initialConfig={sizingConfig ?? undefined}
          suggestedSubdomain={getSuggestedSubdomain()}
          onBack={() => setCurrentStep("config")}
          onNext={handleSizingConfigured}
        />
      )}

      {currentStep === "review" && source && buildConfig && sizingConfig && (
        <GitReviewStep
          source={source}
          build={buildConfig}
          sizing={sizingConfig}
          onBack={() => setCurrentStep("sizing")}
          onDeploy={handleDeploy}
        />
      )}

      {currentStep === "rollout" && source && sizingConfig && (
        <GitRolloutStep
          source={source}
          sizing={sizingConfig}
          deploymentId={deploymentId}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
