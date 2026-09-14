"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AiAgentIntake } from "./ai-agent-intake"
import {
  AiAgentSummaryCard,
  type DeploymentSummaryConfig,
} from "./ai-agent-summary-card"
import { GitRolloutStep } from "./git-rollout-step"
import type { GitSizingConfig, GitSourceConfig } from "./types"

type GitDeployWizardProps = {
  initialUserName?: string
  lang?: string
}

export function GitDeployWizard({
  initialUserName,
  lang = "en",
}: GitDeployWizardProps = {}) {
  const currency = lang === "id" ? "IDR" : "USD"
  const [screen, setScreen] = useState<"intake" | "summary" | "rollout">(
    "intake"
  )
  const [userName, setUserName] = useState<string>(initialUserName || "")

  useEffect(() => {
    if (!userName) {
      let active = true
      void (async () => {
        try {
          const res = await fetch("/api/auth/session")
          const data = await res.json()
          if (active && data?.ok && data?.user) {
            const resolved =
              data.user.firstName ||
              data.user.name?.split(" ")[0] ||
              "Developer"
            setUserName(resolved)
          }
        } catch {
          // ignore transient auth error
        }
      })()
      return () => {
        active = false
      }
    }
  }, [userName])

  // Wizard state
  const [source, setSource] = useState<GitSourceConfig | null>(null)
  const [inspectionData, setInspectionData] = useState<Record<
    string,
    unknown
  > | null>(null)
  const [sizingConfig, setSizingConfig] = useState<GitSizingConfig | null>(null)
  const [deploymentId, setDeploymentId] = useState<string>("dep-initial")

  const handleSourceVerified = (
    src: GitSourceConfig,
    inspected?: Record<string, unknown> | null
  ) => {
    setSource(src)
    setInspectionData(inspected ?? null)
    setScreen("summary")
  }

  const handleDeployFromSummary = async (config: DeploymentSummaryConfig) => {
    if (!source) return

    const sizing: GitSizingConfig = {
      tier: config.tier,
      cpu: config.cpu,
      memory: config.memory,
      hourlyRate: config.hourlyRate,
      subdomain: config.subdomain,
      monthlyPrice: config.monthlyPrice,
      currency,
    }
    setSizingConfig(sizing)

    try {
      const session = inspectionData?.session as { id?: string } | undefined
      const sessionId = session?.id
      if (sessionId) {
        const res = await fetch(
          `/api/deploy/ai-sessions/${sessionId}/confirm`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subdomain: config.subdomain,
              resources: {
                cpu: config.cpu,
                memory: config.memory,
              },
            }),
          }
        )
        const data = await res.json()
        if (!res.ok || !data.ok) {
          toast.error(
            data.message || data.error || "Deployment failed to start."
          )
          return
        }
        const createdStackId =
          data.data?.stackId ||
          data.data?.stack?.id ||
          data.stackId ||
          "dep-" + Date.now()
        setDeploymentId(createdStackId)
      } else {
        setDeploymentId("dep-" + Date.now())
      }
      setScreen("rollout")
      toast.success("Application deployment initiated!")
    } catch {
      toast.error(
        "Network error while initiating deployment. Please try again."
      )
    }
  }

  const handleReset = () => {
    setSource(null)
    setInspectionData(null)
    setSizingConfig(null)
    setScreen("intake")
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6 pt-0">
      {screen === "intake" && (
        <AiAgentIntake
          initialSource={source ?? undefined}
          userName={userName}
          lang={lang}
          onSourceVerified={handleSourceVerified}
        />
      )}

      {screen === "summary" && source && (
        <AiAgentSummaryCard
          source={source}
          inspectionData={inspectionData}
          currency={currency}
          lang={lang}
          onStartOver={handleReset}
          onDeploy={handleDeployFromSummary}
        />
      )}

      {screen === "rollout" && source && sizingConfig && (
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
