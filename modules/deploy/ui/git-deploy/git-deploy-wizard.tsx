"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { DeployChatStream } from "../chat/deploy-chat-stream"
import type { InlineBlueprintData } from "../chat/inline-blueprint-card"
import { DeployMorphContainer } from "../deploy-morph-container"
import { ExecutiveLaunchCard } from "../launch-card/executive-launch-card"
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
  const [screen, setScreen] = useState<"chat" | "launch" | "rollout">("chat")
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
  const [blueprint, setBlueprint] = useState<InlineBlueprintData | null>(null)
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [inspectionData, setInspectionData] = useState<Record<
    string,
    unknown
  > | null>(null)
  const [sizingConfig, setSizingConfig] = useState<GitSizingConfig | null>(null)
  const [deploymentId, setDeploymentId] = useState<string>("dep-initial")
  const [isLaunching, setIsLaunching] = useState(false)

  const handleReadyToLaunch = (data: {
    blueprint: InlineBlueprintData
    sessionId?: string
    inspectionData?: Record<string, unknown> | null
    sourceUrl?: string
  }) => {
    const detectedBranch =
      ((data.inspectionData?.source as Record<string, unknown> | undefined)
        ?.ref as string | undefined) || "main"
    const src: GitSourceConfig = {
      url: data.sourceUrl || "https://github.com/organization/repository",
      branch: detectedBranch,
      rootDir: "./",
      isPrivate: false,
    }
    setSource(src)
    setBlueprint(data.blueprint)
    setSessionId(data.sessionId)
    setInspectionData(data.inspectionData ?? null)
    setScreen("launch")
  }

  const handleBackToChat = () => {
    setScreen("chat")
  }

  const handleLaunch = async () => {
    if (!source || !blueprint) return

    setIsLaunching(true)
    const tier = blueprint.computeTier || "Medium"
    const subdomain = blueprint.subdomain || "app"
    const sizing: GitSizingConfig = {
      tier,
      cpu: 1000,
      memory: 2048,
      hourlyRate: blueprint.hourlyRate ?? 0.04,
      subdomain,
      monthlyPrice: 30,
      currency,
    }
    setSizingConfig(sizing)

    try {
      const session = inspectionData?.session as { id?: string } | undefined
      const activeSessionId = sessionId || session?.id
      if (activeSessionId) {
        const res = await fetch(
          `/api/deploy/ai-sessions/${activeSessionId}/confirm`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subdomain,
              resources: {
                package: tier.toLowerCase(),
              },
            }),
          }
        )
        const data = await res.json()
        if (!res.ok || !data.ok) {
          toast.error(
            data.message || data.error || "Deployment failed to start."
          )
          setIsLaunching(false)
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
    } finally {
      setIsLaunching(false)
    }
  }

  const handleReset = () => {
    setSource(null)
    setBlueprint(null)
    setInspectionData(null)
    setSizingConfig(null)
    setScreen("chat")
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6 pt-0">
      <DeployMorphContainer screen={screen}>
        <div className={screen !== "chat" ? "hidden" : undefined}>
          <DeployChatStream
            initialUserName={userName}
            lang={lang}
            onReadyToLaunch={handleReadyToLaunch}
            initialSessionId={sessionId}
          />
        </div>

        {screen === "launch" && source && blueprint && (
          <ExecutiveLaunchCard
            source={source}
            blueprint={blueprint}
            inspectionData={inspectionData}
            sessionId={sessionId}
            currency={currency}
            lang={lang}
            userName={userName}
            onLaunch={handleLaunch}
            onBackToChat={handleBackToChat}
            isLaunching={isLaunching}
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
      </DeployMorphContainer>
    </div>
  )
}
