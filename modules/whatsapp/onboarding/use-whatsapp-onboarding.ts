"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { eden } from "@/lib/eden"

export type WhatsAppFeature =
  | "devices"
  | "messages"
  | "contacts"
  | "templates"
  | "broadcasts"
  | "catalogs"
  | "api_keys"
  | "webhook_logs"
  | "audit_logs"
  | "pricing_ledger"
  | "usage"

export type OnboardingLevel = 0 | "0_pending" | 1 | 2 | 3

export type OnboardingMission = {
  level: OnboardingLevel
  title: string
  subtitle: string
  description: string
  actionLabel: string
  actionHref?: string
  isActionDialog?: boolean
  completed: boolean
}

export type WhatsAppOnboardingState = {
  level: OnboardingLevel
  progressPercent: number
  isGraduated: boolean
  hasSubscription: boolean
  hasDevice: boolean
  hasTemplate: boolean
  hasMessage: boolean
  hasApiKey: boolean
  missions: OnboardingMission[]
  activeMission: OnboardingMission
  replayLevel: OnboardingLevel | null
  setReplayLevel: (level: OnboardingLevel | null) => void
  isFeatureLocked: (feature: WhatsAppFeature) => boolean
  getFeatureUnlockLevel: (feature: WhatsAppFeature) => number
  graduateNow: () => void
  resetOnboarding: () => void
}

export type WhatsAppOnboardingInput = {
  hasSubscription?: boolean
  deviceCount?: number
  templateCount?: number
  messageCount?: number
  apiKeyCount?: number
  bypassGating?: boolean
}

const GRADUATED_STORAGE_KEY = "whatsapp_onboarding_graduated"
const REPLAY_LEVEL_STORAGE_KEY = "whatsapp_onboarding_replay_level"
export function getFeatureUnlockLevel(feature: WhatsAppFeature): number {
  switch (feature) {
    case "usage":
    case "pricing_ledger":
      return 0
    case "devices":
    case "messages":
    case "contacts":
      return 1
    case "templates":
    case "broadcasts":
    case "catalogs":
    case "api_keys":
      return 2
    case "webhook_logs":
    case "audit_logs":
      return 3
    default:
      return 0
  }
}

export function computeOnboardingLevel(
  input: WhatsAppOnboardingInput
): OnboardingLevel {
  const hasSubscription = input.hasSubscription ?? false
  const hasDevice = (input.deviceCount ?? 0) > 0
  const hasTemplate = (input.templateCount ?? 0) > 0
  const hasMessage = (input.messageCount ?? 0) > 0
  const hasApiKey = (input.apiKeyCount ?? 0) > 0

  if (!hasDevice) {
    return hasSubscription ? "0_pending" : 0
  }

  if (hasApiKey) {
    return 3
  }

  if (hasTemplate && hasMessage) {
    return 2
  }

  return 1
}

export function useWhatsAppOnboarding(
  input: WhatsAppOnboardingInput = {}
): WhatsAppOnboardingState {
  const [manualGraduated, setManualGraduated] = React.useState<boolean>(() => {
    if (input.bypassGating) return true
    if (typeof window === "undefined") return false
    try {
      return localStorage.getItem(GRADUATED_STORAGE_KEY) === "true"
    } catch {
      return false
    }
  })

  const [replayLevel, setReplayLevelState] =
    React.useState<OnboardingLevel | null>(() => {
      if (typeof window === "undefined") return null
      try {
        const saved = localStorage.getItem(REPLAY_LEVEL_STORAGE_KEY)
        if (saved === "0_pending") return "0_pending"
        if (saved !== null && !isNaN(Number(saved)))
          return Number(saved) as OnboardingLevel
        return null
      } catch {
        return null
      }
    })

  const setReplayLevel = React.useCallback((level: OnboardingLevel | null) => {
    setReplayLevelState(level)
    try {
      if (level === null) {
        localStorage.removeItem(REPLAY_LEVEL_STORAGE_KEY)
      } else {
        localStorage.setItem(REPLAY_LEVEL_STORAGE_KEY, String(level))
      }
    } catch {}
  }, [])
  // Dedicated single endpoint query with React Query + Eden fetch
  const { data: serverStatus } = useQuery({
    queryKey: ["whatsapp", "onboarding", "status"],
    queryFn: async () => {
      try {
        const res = await (eden.api.whatsapp as any).onboarding.status.get()
        if (res.data?.ok && res.data.data) {
          return res.data.data
        }
      } catch (err) {
        console.error("Failed to query onboarding status:", err)
      }
      return null
    },
    staleTime: 10_000,
  })

  const mergedInput: WhatsAppOnboardingInput = React.useMemo(() => {
    return {
      hasSubscription:
        input.hasSubscription ?? serverStatus?.hasSubscription ?? false,
      deviceCount: input.deviceCount ?? serverStatus?.deviceCount ?? 0,
      templateCount: input.templateCount ?? serverStatus?.templateCount ?? 0,
      messageCount: input.messageCount ?? serverStatus?.messageCount ?? 0,
      apiKeyCount: input.apiKeyCount ?? serverStatus?.apiKeyCount ?? 0,
      bypassGating: input.bypassGating,
    }
  }, [input, serverStatus])

  const hasSubscription = mergedInput.hasSubscription ?? false
  const hasDevice = (mergedInput.deviceCount ?? 0) > 0
  const hasTemplate = (mergedInput.templateCount ?? 0) > 0
  const hasMessage = (mergedInput.messageCount ?? 0) > 0
  const hasApiKey = (mergedInput.apiKeyCount ?? 0) > 0

  const derivedLevel = React.useMemo(() => {
    return computeOnboardingLevel(mergedInput)
  }, [mergedInput])

  const isGraduated = manualGraduated || derivedLevel === 3

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      if (isGraduated) {
        sessionStorage.setItem(GRADUATED_STORAGE_KEY, "true")
      } else {
        sessionStorage.removeItem(GRADUATED_STORAGE_KEY)
      }
    } catch {}
  }, [isGraduated])
  const numericLevel =
    derivedLevel === "0_pending"
      ? 0.5
      : typeof derivedLevel === "number"
        ? derivedLevel
        : 0

  const progressPercent = React.useMemo(() => {
    if (isGraduated) return 100
    if (derivedLevel === 0) return 10
    if (derivedLevel === "0_pending") return 30
    if (derivedLevel === 1) return 60
    if (derivedLevel === 2) return 85
    return 100
  }, [derivedLevel, isGraduated])

  const missions = React.useMemo<OnboardingMission[]>(() => {
    return [
      {
        level: 0,
        title: "Subscribe to WhatsApp Plan",
        subtitle: "Ground Control",
        description:
          "Activate your WhatsApp Business tier to unlock transponder registration and device allocation.",
        actionLabel: "Subscribe Plan",
        isActionDialog: true,
        completed: hasSubscription || hasDevice,
      },
      {
        level: "0_pending",
        title: "Transponder Hardware Allocation",
        subtitle: "Tower Clearance",
        description:
          "Admin is verifying credentials and provisioning your Meta WABA device number.",
        actionLabel: "View Devices Status",
        actionHref: "/console/whatsapp/devices",
        completed: hasDevice,
      },
      {
        level: 1,
        title: "Transmit First Message",
        subtitle: "Payload Ignition",
        description:
          "Open the live communicator to send your first WhatsApp message to a test recipient.",
        actionLabel: "Open Messages",
        actionHref: "/console/whatsapp/messages",
        completed: hasMessage,
      },
      {
        level: 2,
        title: "Draft & Approve Message Template",
        subtitle: "Broadcast Readiness",
        description:
          "Create a high-impact marketing or utility template to unlock bulk broadcasts and catalogs.",
        actionLabel: "Create Template",
        actionHref: "/console/whatsapp/templates/new",
        completed: hasTemplate,
      },
      {
        level: 3,
        title: "Generate Production API Key",
        subtitle: "Full Cockpit Automation",
        description:
          "Issue automated credentials and subscribe webhooks for end-to-end integration.",
        actionLabel: "Generate API Key",
        actionHref: "/console/whatsapp/api-keys",
        completed: hasApiKey || isGraduated,
      },
    ]
  }, [
    hasSubscription,
    hasDevice,
    hasMessage,
    hasTemplate,
    hasApiKey,
    isGraduated,
  ])

  const allMissionsCompleted =
    hasSubscription &&
    hasDevice &&
    hasMessage &&
    hasTemplate &&
    (hasApiKey || isGraduated)

  const activeMission = React.useMemo(() => {
    if (replayLevel !== null) {
      const target = missions.find((m) => m.level === replayLevel)
      if (target) return target
    }
    if (!hasSubscription && !hasDevice) return missions[0]
    if (hasSubscription && !hasDevice) return missions[1]
    if (!hasMessage) return missions[2]
    if (!hasTemplate) return missions[3]
    if (!hasApiKey && !isGraduated) return missions[4]
    return {
      level: 3 as OnboardingLevel,
      title: "All Steps Completed!",
      subtitle: "Setup Ready",
      description:
        "You have completed all initial onboarding milestones. You can click any step below to replay its guide anytime.",
      actionLabel: "View Messages",
      actionHref: "/console/whatsapp/messages",
      completed: true,
    }
  }, [
    replayLevel,
    missions,
    hasSubscription,
    hasDevice,
    hasMessage,
    hasTemplate,
    hasApiKey,
    isGraduated,
  ])
  const isFeatureLocked = React.useCallback(
    (feature: WhatsAppFeature): boolean => {
      if (isGraduated) return false
      const required = getFeatureUnlockLevel(feature)
      return numericLevel < required
    },
    [isGraduated, numericLevel]
  )

  const graduateNow = React.useCallback(() => {
    try {
      localStorage.setItem(GRADUATED_STORAGE_KEY, "true")
    } catch {}
    setManualGraduated(true)
  }, [])

  const resetOnboarding = React.useCallback(() => {
    try {
      localStorage.removeItem(GRADUATED_STORAGE_KEY)
    } catch {}
    setManualGraduated(false)
  }, [])

  return {
    level: derivedLevel,
    progressPercent,
    isGraduated,
    hasSubscription,
    hasDevice,
    hasTemplate,
    hasMessage,
    hasApiKey,
    missions,
    activeMission,
    replayLevel,
    setReplayLevel,
    isFeatureLocked,
    getFeatureUnlockLevel,
    graduateNow,
    resetOnboarding,
  }
}
