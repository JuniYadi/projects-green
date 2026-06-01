"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react"

import {
  DEFAULT_BUILD_STATE,
  DEFAULT_ENVIRONMENT_STATE,
  DEFAULT_MONITOR_STATE,
  DEFAULT_SOURCE_STATE,
  DEPLOY_WIZARD_STORAGE_KEY,
  DEPLOY_WIZARD_STORAGE_VERSION,
} from "@/modules/deploy/deploy.constants"
import type {
  DeployBuildState,
  DeployEnvironmentState,
  DeployLogScope,
  DeployMonitorState,
  DeploySourceState,
  DeployStatus,
  DeployStep,
  DeployWizardState,
  DetectionResult,
  PersistedDeployWizardState,
} from "@/modules/deploy/deploy.types"

const createInitialDeployWizardState = (): DeployWizardState => {
  return {
    step: "source",
    source: { ...DEFAULT_SOURCE_STATE },
    detectionResult: null,
    build: { ...DEFAULT_BUILD_STATE },
    environment: {
      ...DEFAULT_ENVIRONMENT_STATE,
      envVars: [],
      cpu: 100,
      memory: 256,
    },
    monitor: { ...DEFAULT_MONITOR_STATE },
  }
}

type DeployWizardAction =
  | { type: "set-step"; payload: DeployStep }
  | { type: "set-source"; payload: Partial<DeploySourceState> }
  | { type: "set-detection"; payload: DetectionResult | null }
  | { type: "set-build"; payload: Partial<DeployBuildState> }
  | { type: "set-environment"; payload: Partial<DeployEnvironmentState> }
  | { type: "set-monitor"; payload: Partial<DeployMonitorState> }
  | {
      type: "start-monitor"
      payload: {
        shouldFail: boolean
        failureReason: string | null
      }
    }
  | { type: "set-monitor-status"; payload: DeployStatus }
  | { type: "set-monitor-log-scope"; payload: DeployLogScope }
  | { type: "increment-monitor-tick" }
  | { type: "retry-monitor" }
  | { type: "hydrate"; payload: DeployWizardState }
  | { type: "reset" }

const deployWizardReducer = (
  state: DeployWizardState,
  action: DeployWizardAction
): DeployWizardState => {
  switch (action.type) {
    case "set-step": {
      return {
        ...state,
        step: action.payload,
      }
    }
    case "set-source": {
      return {
        ...state,
        source: {
          ...state.source,
          ...action.payload,
        },
      }
    }
    case "set-detection": {
      return {
        ...state,
        detectionResult: action.payload,
      }
    }
    case "set-build": {
      return {
        ...state,
        build: {
          ...state.build,
          ...action.payload,
        },
      }
    }
    case "set-environment": {
      return {
        ...state,
        environment: {
          ...state.environment,
          ...action.payload,
        },
      }
    }
    case "set-monitor": {
      return {
        ...state,
        monitor: {
          ...state.monitor,
          ...action.payload,
        },
      }
    }
    case "start-monitor": {
      return {
        ...state,
        monitor: {
          ...DEFAULT_MONITOR_STATE,
          deployId: `deploy-${Math.random().toString(36).substring(7)}`,
          status: "queued",
          isActive: true,
          attempt: state.monitor.attempt + 1,
          shouldFail: action.payload.shouldFail,
          failureReason: action.payload.failureReason,
        },
      }
    }
    case "set-monitor-status": {
      return {
        ...state,
        monitor: {
          ...state.monitor,
          status: action.payload,
          isActive:
            action.payload === "queued" ||
            action.payload === "building" ||
            action.payload === "deploying",
        },
      }
    }
    case "set-monitor-log-scope": {
      return {
        ...state,
        monitor: {
          ...state.monitor,
          logScope: action.payload,
        },
      }
    }
    case "increment-monitor-tick": {
      return {
        ...state,
        monitor: {
          ...state.monitor,
          tick: state.monitor.tick + 1,
        },
      }
    }
    case "retry-monitor": {
      return {
        ...state,
        monitor: {
          ...DEFAULT_MONITOR_STATE,
          status: "queued",
          isActive: true,
          attempt: state.monitor.attempt + 1,
          shouldFail: false,
          failureReason: null,
        },
      }
    }
    case "hydrate": {
      return action.payload
    }
    case "reset": {
      return createInitialDeployWizardState()
    }
    default:
      return state
  }
}

const sanitizeState = (
  state: DeployWizardState | null | undefined
): DeployWizardState | null => {
  if (!state) {
    return null
  }

  const safeState = createInitialDeployWizardState()

  return {
    ...safeState,
    ...state,
    source: {
      ...safeState.source,
      ...(state.source ?? {}),
    },
    build: {
      ...safeState.build,
      ...(state.build ?? {}),
    },
    environment: {
      ...safeState.environment,
      ...(state.environment ?? {}),
      envVars: Array.isArray(state.environment?.envVars)
        ? state.environment?.envVars
        : [],
    },
    monitor: {
      ...safeState.monitor,
      ...(state.monitor ?? {}),
    },
  }
}

export const serializeDeployWizardState = (
  state: DeployWizardState
): string => {
  const payload: PersistedDeployWizardState = {
    version: DEPLOY_WIZARD_STORAGE_VERSION,
    state,
  }

  return JSON.stringify(payload)
}

export const hydrateDeployWizardState = (
  raw: string | null
): DeployWizardState | null => {
  if (!raw) {
    return null
  }

  try {
    const payload = JSON.parse(raw) as PersistedDeployWizardState

    if (payload.version !== DEPLOY_WIZARD_STORAGE_VERSION) {
      return null
    }

    return sanitizeState(payload.state)
  } catch {
    return null
  }
}

const DeployWizardStateContext = createContext<DeployWizardState | null>(null)
const DeployWizardDispatchContext =
  createContext<Dispatch<DeployWizardAction> | null>(null)

export const DeployWizardProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(
    deployWizardReducer,
    undefined,
    createInitialDeployWizardState
  )

  useEffect(() => {
    const hydrated = hydrateDeployWizardState(
      window.sessionStorage.getItem(DEPLOY_WIZARD_STORAGE_KEY)
    )

    if (hydrated) {
      dispatch({ type: "hydrate", payload: hydrated })
    }
  }, [])

  useEffect(() => {
    window.sessionStorage.setItem(
      DEPLOY_WIZARD_STORAGE_KEY,
      serializeDeployWizardState(state)
    )
  }, [state])

  const dispatchValue = useMemo(() => dispatch, [dispatch])

  return (
    <DeployWizardStateContext.Provider value={state}>
      <DeployWizardDispatchContext.Provider value={dispatchValue}>
        {children}
      </DeployWizardDispatchContext.Provider>
    </DeployWizardStateContext.Provider>
  )
}

export const useDeployWizardState = () => {
  const context = useContext(DeployWizardStateContext)

  if (!context) {
    throw new Error(
      "useDeployWizardState must be used inside DeployWizardProvider"
    )
  }

  return context
}

export const useDeployWizardDispatch = () => {
  const context = useContext(DeployWizardDispatchContext)

  if (!context) {
    throw new Error(
      "useDeployWizardDispatch must be used inside DeployWizardProvider"
    )
  }

  return context
}

export { createInitialDeployWizardState, deployWizardReducer }
