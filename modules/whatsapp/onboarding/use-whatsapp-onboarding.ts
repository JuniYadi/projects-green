"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { eden } from "@/lib/eden"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { useWhatsAppOnboardingStore } from "./whatsapp-onboarding.store"

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
  locale?: string
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
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(input.locale ?? params?.lang)
  const messages = getMessages(locale)
  const obMessages = messages.console.whatsapp.onboarding.missions

  const [manualGraduated, setManualGraduated] = React.useState<boolean>(
    () => input.bypassGating ?? false
  )

  React.useEffect(() => {
    if (input.bypassGating) return
    try {
      if (localStorage.getItem(GRADUATED_STORAGE_KEY) === "true") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setManualGraduated(true)
      }
    } catch {}
  }, [input.bypassGating])

  const [replayLevel, setReplayLevelState] =
    React.useState<OnboardingLevel | null>(null)

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(REPLAY_LEVEL_STORAGE_KEY)
      if (saved === "0_pending") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setReplayLevelState("0_pending")
      } else if (saved !== null && !isNaN(Number(saved))) {
        setReplayLevelState(Number(saved) as OnboardingLevel)
      }
    } catch {}
  }, [])

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
  const [serverStatus, setServerStatus] = React.useState<{
    hasSubscription?: boolean
    deviceCount?: number
    templateCount?: number
    messageCount?: number
    apiKeyCount?: number
  } | null>(null)

  React.useEffect(() => {
    let isCancelled = false
    async function fetchStatus() {
      try {
        const res = await (eden.api.whatsapp as any).onboarding.status.get()
        if (!isCancelled && res.data?.ok && res.data.data) {
          setServerStatus(res.data.data)
        }
      } catch {}
    }
    fetchStatus()
    return () => {
      isCancelled = true
    }
  }, [])
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

  const setIsGraduatedStore = useWhatsAppOnboardingStore(
    (s) => s.setIsGraduated
  )
  const setProgressPercentStore = useWhatsAppOnboardingStore(
    (s) => s.setProgressPercent
  )

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
  React.useEffect(() => {
    setIsGraduatedStore(isGraduated)
  }, [isGraduated, setIsGraduatedStore])

  React.useEffect(() => {
    setProgressPercentStore(progressPercent)
  }, [progressPercent, setProgressPercentStore])

  const missions = React.useMemo<OnboardingMission[]>(() => {
    return [
      {
        level: 0,
        title: obMessages.subscribe.title,
        subtitle: obMessages.subscribe.subtitle,
        description: obMessages.subscribe.description,
        actionLabel: obMessages.subscribe.actionLabel,
        isActionDialog: true,
        completed: hasSubscription || hasDevice,
      },
      {
        level: "0_pending",
        title: obMessages.transponderDevices.title,
        subtitle: obMessages.transponderDevices.subtitle,
        description: obMessages.transponderDevices.description,
        actionLabel: obMessages.transponderDevices.actionLabel,
        actionHref: localizePathname({
          pathname: "/console/whatsapp/devices",
          locale,
        }),
        completed: hasDevice,
      },
      {
        level: 1,
        title: obMessages.firstMessage.title,
        subtitle: obMessages.firstMessage.subtitle,
        description: obMessages.firstMessage.description,
        actionLabel: obMessages.firstMessage.actionLabel,
        actionHref: localizePathname({
          pathname: "/console/whatsapp/messages",
          locale,
        }),
        completed: hasMessage,
      },
      {
        level: 2,
        title: obMessages.template.title,
        subtitle: obMessages.template.subtitle,
        description: obMessages.template.description,
        actionLabel: obMessages.template.actionLabel,
        actionHref: localizePathname({
          pathname: "/console/whatsapp/templates/new",
          locale,
        }),
        completed: hasTemplate,
      },
      {
        level: 3,
        title: obMessages.apiKey.title,
        subtitle: obMessages.apiKey.subtitle,
        description: obMessages.apiKey.description,
        actionLabel: obMessages.apiKey.actionLabel,
        actionHref: localizePathname({
          pathname: "/console/whatsapp/api-keys",
          locale,
        }),
        completed: hasApiKey || isGraduated,
      },
    ]
  }, [
    obMessages,
    locale,
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
      title: obMessages.completed.title,
      subtitle: obMessages.completed.subtitle,
      description: obMessages.completed.description,
      actionLabel: obMessages.completed.actionLabel,
      actionHref: localizePathname({
        pathname: "/console/whatsapp/messages",
        locale,
      }),
      completed: true,
    }
  }, [
    replayLevel,
    missions,
    obMessages,
    locale,
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
