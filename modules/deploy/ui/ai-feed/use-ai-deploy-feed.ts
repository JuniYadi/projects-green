"use client"

import { useCallback, useReducer, useRef } from "react"
import {
  applyManualSettings as applySettings,
  confirmDeploy,
  getDeploymentStatus,
  getGithubInstallUrl,
  inspectSource,
  selectResource as selectRes,
  setEnvValues as setValues,
} from "./ai-deploy.api"
import type {
  AiDeploymentSessionDTO,
  FeedItem,
  ManualBuildSettings,
  ResourceSelection,
} from "./ai-deploy.types"

type AiDeployFeedState = {
  items: FeedItem[]
  sessionId: string | null
  currentSession: AiDeploymentSessionDTO | null
  isInspecting: boolean
  githubPopupPending: boolean
  lastUrl: string | null
  newDeploymentPending: boolean
}

type Action =
  | { type: "push"; item: FeedItem }
  | { type: "session"; session: AiDeploymentSessionDTO | null }
  | { type: "inspecting"; value: boolean }
  | { type: "github"; value: boolean }
  | { type: "url"; value: string }
  | { type: "reset" }

const initialState: AiDeployFeedState = {
  items: [],
  sessionId: null,
  currentSession: null,
  isInspecting: false,
  githubPopupPending: false,
  lastUrl: null,
  newDeploymentPending: false,
}

function reducer(state: AiDeployFeedState, action: Action): AiDeployFeedState {
  if (action.type === "push")
    return { ...state, items: [...state.items, action.item] }
  if (action.type === "session") {
    return {
      ...state,
      currentSession: action.session,
      sessionId: action.session?.id ?? state.sessionId,
    }
  }
  if (action.type === "inspecting")
    return { ...state, isInspecting: action.value }
  if (action.type === "github")
    return { ...state, githubPopupPending: action.value }
  if (action.type === "url") return { ...state, lastUrl: action.value }
  return initialState
}

const item = (
  kind: FeedItem["kind"],
  data: Partial<FeedItem> = {}
): FeedItem => ({
  id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  kind,
  timestamp: Date.now(),
  ...data,
})

export function useAiDeployFeed() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const popupRef = useRef<Window | null>(null)
  const popupTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const submit = useCallback(
    async (url: string) => {
      dispatch({ type: "url", value: url })
      if (!/^https?:\/\/(?:www\.)?github\.com\//i.test(url)) {
        dispatch({
          type: "push",
          item: item("not_supported", {
            errorMessage: "Only GitHub repositories are supported.",
          }),
        })
        return
      }
      dispatch({ type: "inspecting", value: true })
      dispatch({ type: "push", item: item("inspecting") })
      try {
        const result = await inspectSource(url, {
          sessionId: state.sessionId ?? undefined,
        })
        if (result.session)
          dispatch({ type: "session", session: result.session })
        if (result.source)
          dispatch({
            type: "push",
            item: item("source_found", { source: result.source }),
          })
        if (result.access?.state === "connection_required") {
          dispatch({
            type: "push",
            item: item("access_required", { access: result.access }),
          })
          dispatch({ type: "github", value: false })
        } else if (result.access?.state === "denied") {
          dispatch({
            type: "push",
            item: item("access_denied", { access: result.access }),
          })
        } else if (result.access) {
          dispatch({
            type: "push",
            item: item("access_verified", { access: result.access }),
          })
        }
        dispatch({ type: "push", item: item("detecting") })
        if (result.status === "plan_ready") {
          dispatch({
            type: "push",
            item: item("detection_success", {
              detection: result.detection ?? undefined,
              plan: result.plan ?? undefined,
            }),
          })
          dispatch({
            type: "push",
            item: item("plan_ready", { plan: result.plan ?? undefined }),
          })
        } else if (result.status === "manual_override_required") {
          dispatch({
            type: "push",
            item: item("detection_low_conf", {
              manualOverride: result.manualOverride ?? undefined,
            }),
          })
        } else if (result.status === "not_supported") {
          dispatch({
            type: "push",
            item: item("not_supported", {
              errorMessage: result.manualOverride?.message,
            }),
          })
        } else if (result.status === "blocked") {
          dispatch({
            type: "push",
            item: item("detection_failed", {
              errorMessage: result.manualOverride?.message,
              manualOverride: result.manualOverride ?? undefined,
            }),
          })
        }
      } catch (error) {
        dispatch({
          type: "push",
          item: item("detection_failed", {
            errorMessage:
              error instanceof Error ? error.message : "Inspection failed.",
          }),
        })
      } finally {
        dispatch({ type: "inspecting", value: false })
      }
    },
    [state.sessionId]
  )

  const connectGithub = useCallback(() => {
    const url = getGithubInstallUrl()
    const popup =
      typeof window !== "undefined"
        ? window.open(
            url,
            "github-install",
            "width=620,height=760,resizable=yes,scrollbars=yes"
          )
        : null
    if (!popup) {
      dispatch({
        type: "push",
        item: item("access_denied", {
          errorMessage: "Browser blocked the GitHub window.",
        }),
      })
      return
    }
    popupRef.current = popup
    dispatch({ type: "github", value: true })
    popupTimer.current = setInterval(() => {
      if (popup.closed) {
        if (popupTimer.current) clearInterval(popupTimer.current)
        popupTimer.current = null
        dispatch({ type: "github", value: false })
        dispatch({ type: "push", item: item("access_required") })
      }
    }, 500)
  }, [])

  const cancelGithubConnect = useCallback(() => {
    if (popupTimer.current) clearInterval(popupTimer.current)
    popupTimer.current = null
    popupRef.current?.close()
    popupRef.current = null
    dispatch({ type: "github", value: false })
  }, [])

  const updateSession = useCallback(
    (session: AiDeploymentSessionDTO) => dispatch({ type: "session", session }),
    []
  )
  const applyManual = useCallback(
    async (settings: ManualBuildSettings) => {
      if (!state.sessionId) return
      updateSession(await applySettings(state.sessionId, settings))
    },
    [state.sessionId, updateSession]
  )
  const setEnv = useCallback(
    async (values: { key: string; value: string }[]) => {
      if (!state.sessionId) return
      updateSession(await setValues(state.sessionId, values))
    },
    [state.sessionId, updateSession]
  )
  const selectResource = useCallback(
    async (selection: ResourceSelection) => {
      if (!state.sessionId) return
      updateSession(await selectRes(state.sessionId, selection))
    },
    [state.sessionId, updateSession]
  )

  const confirm = useCallback(
    async (idempotencyKey: string) => {
      const session = state.currentSession
      if (!session?.id || !session.plan || !session.currentPlanHash) return
      dispatch({
        type: "push",
        item: item("deploying", {
          deployId: session.deploymentId ?? undefined,
        }),
      })
      const confirmed = await confirmDeploy(
        session.id,
        session.plan.version,
        session.currentPlanHash,
        idempotencyKey
      )
      updateSession(confirmed)
      if (!confirmed.deploymentId) return
      const started = Date.now()
      const poll = async () => {
        const status = await getDeploymentStatus(confirmed.deploymentId!)
        dispatch({
          type: "push",
          item: item("build_step", {
            deployStatus: status.status,
            deployId: confirmed.deploymentId!,
          }),
        })
        dispatch({
          type: "push",
          item: item("deploy_step", {
            deployStatus: status.status,
            deployId: confirmed.deploymentId!,
          }),
        })
        if (status.status === "DEPLOYED") {
          if (statusTimer.current) clearInterval(statusTimer.current)
          dispatch({
            type: "push",
            item: item("live", {
              deployId: confirmed.deploymentId!,
              liveUrl: confirmed.plan?.domain.hostname ?? undefined,
            }),
          })
        } else if (
          status.status === "FAILED" ||
          Date.now() - started >= 300000
        ) {
          if (statusTimer.current) clearInterval(statusTimer.current)
          dispatch({
            type: "push",
            item: item("failed", {
              deployId: confirmed.deploymentId!,
              errorMessage: status.failureReason ?? "Deployment failed.",
            }),
          })
        }
      }
      await poll()
      statusTimer.current = setInterval(poll, 3000)
    },
    [state.currentSession, updateSession]
  )

  const retry = useCallback(
    () => (state.lastUrl ? submit(state.lastUrl) : Promise.resolve()),
    [state.lastUrl, submit]
  )
  const reset = useCallback(() => {
    if (statusTimer.current) clearInterval(statusTimer.current)
    if (popupTimer.current) clearInterval(popupTimer.current)
    dispatch({ type: "reset" })
  }, [])

  return {
    items: state.items,
    session: state.currentSession,
    isInspecting: state.isInspecting,
    githubPopupPending: state.githubPopupPending,
    submit,
    retry,
    connectGithub,
    cancelGithubConnect,
    applyManualSettings: applyManual,
    setEnvValues: setEnv,
    selectResource,
    confirm,
    reset,
    canReset: Boolean(state.currentSession),
  }
}
