"use client"

import { enMessages } from "@/lib/i18n/messages/en"
import type { DeployWizardMessages } from "@/lib/i18n/messages/types"
import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Check, X } from "@/components/ui/phosphor-icons"
import { Button } from "@/components/ui/button"
import {
  fetchFrameworkDetection,
  fetchPublicFrameworkDetection,
  DetectionError,
} from "@/modules/deploy/deploy-detection.service"
import { recommendPlanForLegacyDetection } from "@/modules/deploy/deploy-recommendation"
import {
  DEPLOY_PHASES,
  DEPLOY_STEP_QUERY_KEY,
  DEPLOY_TEMPLATES,
  MONITOR_POLL_INTERVAL_MS,
  getDeployPhase,
  parseStepQueryValue,
} from "@/modules/deploy/deploy.constants"
import { clampStepToUnlocked, getNextStep } from "@/modules/deploy/deploy.logic"
import { cn } from "@/lib/utils"
import {
  getDefaultBranchName,
  getRepositoryBranches,
} from "@/modules/deploy/deploy.mock"
import type {
  DeployEnvironmentState,
  DeployStatus,
  DeployStep,
  DeployTemplateId,
  Owner,
  Repository,
} from "@/modules/deploy/deploy.types"
import type { RecentDeploySourceDTO } from "@/modules/deploy/recent-sources.dto"
import {
  getEnvironmentValidationMessages,
  isValidCustomDomain,
  isManualOverrideRequired,
  validateBuildStep,
  validateSourceStep,
} from "@/modules/deploy/deploy.schema"
import {
  useDeployWizardDispatch,
  useDeployWizardState,
} from "@/modules/deploy/deploy.store"
import { StepConnectV2 } from "@/modules/deploy/ui/step-connect-v2"
import { StepDetectV2 } from "@/modules/deploy/ui/step-detect-v2"
import { StepMonitorV2 } from "@/modules/deploy/ui/step-monitor-v2"
import { StepReviewV2 } from "@/modules/deploy/ui/step-review-v2"
import { StepSourceV2 } from "@/modules/deploy/ui/step-source-v2"
import {
  buildDeploySubmitPayload,
  buildRepositoriesUrl,
  generateAppName,
  getDeploySubmitError,
  getRequestErrorMessage,
  mapGithubRepository,
  toGeneratedSubdomain,
  type DeploySubmitResponse,
  type GithubRepositoriesResponse,
} from "@/modules/deploy/deploy-wizard.logic"

type GithubConnectionStatus = "idle" | "connected" | "error"
type GithubAccountsResponse = {
  ok: boolean
  accounts?: { accountLogin?: string | null }[]
}
type RecentSourcesResponse = {
  ok: boolean
  data?: RecentDeploySourceDTO[]
}

type DeployWizardV2Props = {
  title?: string
  description?: string
  messages?: DeployWizardMessages
  dashboardHref?: string
}

function DeployWizardV2Inner({
  title,
  description,
  messages = enMessages.console.app.deployWizard,
  dashboardHref,
}: DeployWizardV2Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const state = useDeployWizardState()
  const dispatch = useDeployWizardDispatch()
  const [ownerSearch, setOwnerSearch] = useState("")
  const [repositorySearch, setRepositorySearch] = useState("")
  const [recentSources, setRecentSources] = useState<
    RecentSourcesResponse["data"]
  >([])
  const [ownerOptions, setOwnerOptions] = useState<Owner[]>([])
  const [repositoryOptions, setRepositoryOptions] = useState<Repository[]>([])
  const [ownerOptionsLoading, setOwnerOptionsLoading] = useState(true)

  const [repositoryOptionsLoading, setRepositoryOptionsLoading] =
    useState(false)
  const [ownerOptionsError, setOwnerOptionsError] = useState<string | null>(
    null
  )
  const [repositoryOptionsError, setRepositoryOptionsError] = useState<
    string | null
  >(null)
  const [githubReconnectRequired, setGithubReconnectRequired] = useState(false)
  const [repositoryById, setRepositoryById] = useState<
    Record<string, Repository>
  >({})
  const [isConnectingGithub, setIsConnectingGithub] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectionError, setDetectionError] = useState<string | null>(null)
  const [detectionErrorCode, setDetectionErrorCode] = useState<string | null>(
    null
  )
  const [detectionAttempt, setDetectionAttempt] = useState(1)
  const [detectionRetrying, setDetectionRetrying] = useState(false)
  const [detectionRunKey, setDetectionRunKey] = useState(0)
  useEffect(() => {
    const controller = new AbortController()

    const run = async () => {
      try {
        const response = await fetch("/api/deploy/recent-sources?limit=3", {
          signal: controller.signal,
        })
        if (!response.ok) return

        const payload = (await response.json()) as RecentSourcesResponse
        if (!controller.signal.aborted) {
          setRecentSources(Array.isArray(payload.data) ? payload.data : [])
        }
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") return
        if (!controller.signal.aborted) setRecentSources([])
      }
    }

    void run()
    return () => controller.abort()
  }, [])

  const githubConnectionStatus: GithubConnectionStatus = (() => {
    const status = searchParams.get("github")

    if (status === "error") {
      return "error"
    }

    if (githubReconnectRequired) {
      return "idle"
    }

    if (ownerOptionsError) return "error"
    return ownerOptions.length > 0 ? "connected" : "idle"
  })()

  const selectedOwner = useMemo(() => {
    if (!state.source.ownerId) {
      return null
    }

    return (
      ownerOptions.find((owner) => owner.id === state.source.ownerId) ?? {
        id: state.source.ownerId,
        name: state.source.ownerId,
        avatarUrl: "",
      }
    )
  }, [ownerOptions, state.source.ownerId])

  const selectedRepository = useMemo(() => {
    if (!state.source.repositoryId) {
      return null
    }

    return repositoryById[state.source.repositoryId] ?? null
  }, [repositoryById, state.source.repositoryId])

  const branches = useMemo(() => {
    if (!state.source.repositoryId) {
      return []
    }

    const mappedBranches = getRepositoryBranches(state.source.repositoryId)
    if (mappedBranches.length > 0) {
      return mappedBranches
    }

    if (!selectedRepository?.defaultBranch) {
      return []
    }

    return [
      {
        id: `${state.source.repositoryId}-${selectedRepository.defaultBranch}`,
        repoId: state.source.repositoryId,
        name: selectedRepository.defaultBranch,
      },
    ]
  }, [selectedRepository, state.source.repositoryId])

  const selectedBranch = useMemo(() => {
    return (
      branches.find((branch) => branch.name === state.source.branchName) ?? null
    )
  }, [branches, state.source.branchName])

  useEffect(() => {
    const controller = new AbortController()

    const run = async () => {
      setOwnerOptionsLoading(true)
      setOwnerOptionsError(null)

      try {
        const response = await fetch("/api/integrations/github/accounts", {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(
            `Unable to load GitHub accounts. Request failed with ${response.status}.`
          )
        }

        const payload = (await response.json()) as GithubAccountsResponse
        if (!payload.ok || !Array.isArray(payload.accounts)) {
          throw new Error("Unable to load GitHub accounts.")
        }

        const owners = payload.accounts
          .filter(
            (account): account is { accountLogin: string } =>
              typeof account.accountLogin === "string" &&
              account.accountLogin.length > 0
          )
          .map((account) => ({
            id: account.accountLogin,
            name: account.accountLogin,
            avatarUrl: "",
          }))

        setGithubReconnectRequired(false)
        setOwnerOptions(owners)

        const hasSelectedOwner = owners.some(
          (owner) => owner.id === state.source.ownerId
        )
        if (!hasSelectedOwner && state.source.ownerId) {
          dispatch({
            type: "set-source",
            payload: {
              sourceType: "github",
              ownerId: "",
              repositoryId: "",
              branchName: "",
              templateId: undefined,
            },
          })
          dispatch({ type: "set-detection", payload: null })
        } else if (owners.length === 1 && !hasSelectedOwner) {
          setRepositorySearch("")
          setRepositoryOptions([])
          setRepositoryOptionsError(null)
          dispatch({
            type: "set-source",
            payload: {
              sourceType: "github",
              ownerId: owners[0].id,
              repositoryId: "",
              branchName: "",
              templateId: undefined,
            },
          })
          dispatch({ type: "set-detection", payload: null })
        }
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") {
          return
        }

        setOwnerOptions([])
        setOwnerOptionsError(
          cause instanceof Error && cause.message
            ? cause.message
            : "Unable to load GitHub accounts."
        )
      } finally {
        setOwnerOptionsLoading(false)
      }
    }

    void run()

    return () => {
      controller.abort()
    }
  }, [dispatch, state.source.ownerId])

  useEffect(() => {
    if (!state.source.ownerId) {
      return
    }

    const controller = new AbortController()

    const run = async () => {
      setRepositoryOptionsLoading(true)
      setRepositoryOptionsError(null)

      try {
        const response = await fetch(
          buildRepositoriesUrl({
            ownerId: state.source.ownerId,
            query: repositorySearch,
            limit: 100,
          }),
          {
            signal: controller.signal,
          }
        )

        if (response.status === 409) {
          const payload = (await response
            .json()
            .catch(() => null)) as GithubRepositoriesResponse | null
          if (payload?.error === "GITHUB_RECONNECT_REQUIRED") {
            setRepositoryOptions([])
            setGithubReconnectRequired(true)
            return
          }
        }

        if (!response.ok) {
          throw new Error(
            `Unable to load repositories. Request failed with ${response.status}.`
          )
        }

        const payload = (await response.json()) as GithubRepositoriesResponse
        if (!payload.ok || !Array.isArray(payload.items)) {
          throw new Error("Unable to load repositories from GitHub.")
        }
        const mapped = payload.items.map(mapGithubRepository)

        setGithubReconnectRequired(false)
        setRepositoryOptions(mapped)
        setRepositoryById((current) => {
          const next = { ...current }
          for (const repository of mapped) {
            next[repository.id] = repository
          }
          return next
        })
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") {
          return
        }

        setRepositoryOptions([])
        setRepositoryOptionsError(getRequestErrorMessage(cause))
      } finally {
        setRepositoryOptionsLoading(false)
      }
    }

    void run()

    return () => {
      controller.abort()
    }
  }, [repositorySearch, state.source.ownerId])
  const detectionAttemptRef = useRef(0)
  const detectionControllerRef = useRef<AbortController | null>(null)
  const detectionInputKeyRef = useRef<string | null>(null)

  useEffect(() => {
    const sourceType = state.source.sourceType
    if (
      (sourceType === "github" && !state.source.repositoryId) ||
      (sourceType === "public" && !state.source.publicSourceUrl?.trim()) ||
      (sourceType !== "github" && sourceType !== "public")
    ) {
      return
    }
    const detectionInputKey =
      sourceType === "public"
        ? `public:${state.source.publicSourceUrl}:${state.source.publicSourceRef}:${state.source.rootDirectory}`
        : `github:${state.source.repositoryId}:${state.source.branchName}:${state.source.rootDirectory}`
    if (
      state.detectionResult != null &&
      detectionInputKeyRef.current === detectionInputKey
    ) {
      return
    }
    if (
      detectionError != null &&
      detectionInputKeyRef.current === detectionInputKey
    ) {
      return
    }
    detectionInputKeyRef.current = detectionInputKey

    const repo =
      sourceType === "github"
        ? (repositoryById[state.source.repositoryId] ??
          repositoryOptions.find(
            (repository) => repository.id === state.source.repositoryId
          ))
        : null
    if (sourceType === "github" && !repo) return

    detectionControllerRef.current?.abort()
    const controller = new AbortController()
    detectionControllerRef.current = controller

    const shouldRetry = (err: unknown): boolean => {
      if (err instanceof DOMException && err.name === "AbortError") {
        return false
      }
      if (!(err instanceof DetectionError)) return false

      return ["NETWORK_ERROR", "DETECTION_TRANSIENT_PROVIDER_ERROR"].includes(
        err.code
      )
    }

    const waitForRetry = async (attempt: number) => {
      await new Promise<void>((resolve) => {
        const timeoutId = window.setTimeout(resolve, 1000 * attempt)
        const handleAbort = () => {
          window.clearTimeout(timeoutId)
          resolve()
        }
        controller.signal.addEventListener("abort", handleAbort, {
          once: true,
        })
      })
    }

    const run = async () => {
      setIsDetecting(true)
      setDetectionError(null)
      setDetectionErrorCode(null)
      setDetectionRetrying(false)
      dispatch({ type: "set-detection", payload: null })
      dispatch({ type: "set-build", payload: null })

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        if (controller.signal.aborted) return

        setDetectionAttempt(attempt)
        detectionAttemptRef.current = attempt
        setDetectionRetrying(attempt > 1)
        try {
          const result =
            sourceType === "public"
              ? await fetchPublicFrameworkDetection(
                  {
                    repoUrl: state.source.publicSourceUrl?.trim() ?? "",
                    ref: state.source.publicSourceRef || undefined,
                    subdir: state.source.rootDirectory || undefined,
                  },
                  controller.signal
                )
              : await fetchFrameworkDetection(
                  {
                    installationId: repo!.installationId,
                    owner: repo!.ownerId,
                    repo: repo!.name,
                    ref: state.source.branchName || undefined,
                    subdir: state.source.rootDirectory || undefined,
                  },
                  controller.signal
                )
          if (controller.signal.aborted) return

          setDetectionError(null)
          setDetectionErrorCode(null)

          dispatch({ type: "set-detection", payload: result })

          dispatch({
            type: "set-build",
            payload: {
              language: result.language ?? "",
              framework: result.framework ?? "",
              frameworkVersion: result.frameworkVersion ?? "",
              buildCommand: result.buildCommand ?? "",
              useDockerfile: result.dockerfileDetected,
              primaryEngine: result.primaryEngine ?? "",
              primaryEngineVersion: result.primaryEngineVersion ?? "",
              secondaryEngine: result.secondaryEngine ?? "",
              secondaryEngineVersion: result.secondaryEngineVersion ?? "",
              defaultPort: result.defaultPort ?? 0,
            },
          })

          const recommendation = recommendPlanForLegacyDetection(result)
          dispatch({
            type: "set-environment",
            payload: {
              resourcePlanId: recommendation.resourcePlanId,
              cpu: recommendation.cpu ?? state.environment.cpu,
              memory: recommendation.memory ?? state.environment.memory,
            },
          })
          return
        } catch (err) {
          if (controller.signal.aborted) return

          const message =
            err instanceof DetectionError
              ? err.message
              : "Failed to detect framework. You can configure build settings manually."
          const errorCode = err instanceof DetectionError ? err.code : null

          if (!shouldRetry(err) || attempt === 2) {
            setDetectionError(message)
            setDetectionErrorCode(errorCode)
            return
          }

          setDetectionRetrying(true)
          await waitForRetry(attempt)
        }
      }
    }

    void run().finally(() => {
      if (!controller.signal.aborted) {
        setIsDetecting(false)
        setDetectionRetrying(false)
      }
    })

    return () => {
      controller.abort()
      setIsDetecting(false)
      setDetectionRetrying(false)
    }
  }, [
    dispatch,
    state.source.sourceType,
    state.source.repositoryId,
    state.source.branchName,
    state.source.rootDirectory,
    state.source.publicSourceUrl,
    state.source.publicSourceRef,
    state.detectionResult,
    detectionError,
    detectionRunKey,
    repositoryById,
    repositoryOptions,
    state.environment.cpu,
    state.environment.memory,
  ])

  const sourceValid =
    state.source.sourceType === "public"
      ? state.source.publicSourceUrl?.trim().startsWith("https://") === true
      : validateSourceStep(state.source)
  const buildValid = validateBuildStep(state.build, state.detectionResult)
  const environmentValidationMessages = getEnvironmentValidationMessages(
    state.environment
  )
  const environmentValid = environmentValidationMessages.length === 0
  const normalizedCustomDomain = state.environment.customDomain.trim()
  const hasMissingCustomDomain =
    !state.environment.useGeneratedSubdomain &&
    normalizedCustomDomain.length === 0
  const hasInvalidCustomDomain =
    !state.environment.useGeneratedSubdomain &&
    normalizedCustomDomain.length > 0 &&
    !isValidCustomDomain(normalizedCustomDomain)

  const manualOverrideRequired = isManualOverrideRequired(state.detectionResult)

  const navigateStep = (step: DeployStep) => {
    const clampedStep = clampStepToUnlocked(step, state)
    dispatch({ type: "set-step", payload: clampedStep })
  }

  useEffect(() => {
    if (!searchParams.has(DEPLOY_STEP_QUERY_KEY)) {
      return
    }
    const queryStep = parseStepQueryValue(
      searchParams.get(DEPLOY_STEP_QUERY_KEY)
    )
    const clampedQueryStep = clampStepToUnlocked(queryStep, state)

    if (clampedQueryStep !== state.step) {
      dispatch({ type: "set-step", payload: clampedQueryStep })
    }
    // Run once for initial URL hydration. Ongoing navigation is driven by state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const queryStep = parseStepQueryValue(
      searchParams.get(DEPLOY_STEP_QUERY_KEY)
    )

    if (queryStep === state.step) {
      return
    }

    const next = new URLSearchParams(searchParams.toString())
    next.set(DEPLOY_STEP_QUERY_KEY, state.step)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [pathname, router, searchParams, state.step])

  useEffect(() => {
    if (state.step !== "deploy" || !state.monitor.isActive) {
      return
    }

    const deployId = state.monitor.deployId
    if (!deployId) {
      return
    }

    let cancelled = false

    const poll = async () => {
      try {
        const response = await fetch(`/api/deploy/status/${deployId}`)
        if (!response.ok) {
          throw new Error(`Status request failed with ${response.status}.`)
        }

        const payload = (await response.json()) as {
          ok: boolean
          data?: { status: DeployStatus; failureReason: string | null }
        }

        if (!payload.ok || !payload.data) {
          throw new Error("Unable to read deployment status.")
        }

        if (cancelled) {
          return
        }

        const nextStatus = payload.data.status
        if (nextStatus !== "idle") {
          dispatch({ type: "set-monitor-status", payload: nextStatus })
        }

        if (nextStatus === "failed" && payload.data.failureReason) {
          dispatch({
            type: "set-monitor",
            payload: { failureReason: payload.data.failureReason },
          })
        }
      } catch {
        // Transient polling errors keep the monitor active; the status panel
        // and logs/timeline components surface their own retryable errors.
      }
    }

    void poll()
    const intervalId = window.setInterval(poll, MONITOR_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [dispatch, state.monitor.isActive, state.monitor.deployId, state.step])

  const handleOwnerSelect = (ownerId: string) => {
    setRepositorySearch("")
    setRepositoryOptions([])
    setRepositoryOptionsError(null)
    setRepositoryOptionsLoading(true)

    dispatch({
      type: "set-source",
      payload: {
        sourceType: "github",
        ownerId,
        repositoryId: "",
        branchName: "",
        templateId: undefined,
      },
    })

    dispatch({ type: "set-detection", payload: null })
  }

  const handleRepositorySelect = (repositoryId: string) => {
    const repo = repositoryById[repositoryId]
    const defaultBranchFromApi = repo?.defaultBranch ?? ""
    const branchName =
      defaultBranchFromApi || getDefaultBranchName(repositoryId)

    setDetectionError(null)
    dispatch({
      type: "set-source",
      payload: {
        sourceType: "github",
        repositoryId,
        branchName,
        templateId: undefined,
      },
    })
    dispatch({ type: "set-detection", payload: null })
    dispatch({ type: "set-build", payload: null })
  }

  const handleTemplateSelect = (templateId: DeployTemplateId) => {
    const template = DEPLOY_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return

    dispatch({
      type: "set-source",
      payload: {
        sourceType: "template",
        templateId,
        ownerId: "",
        repositoryId: "",
        branchName: "",
        appName: generateAppName(template.name),
      },
    })

    dispatch({
      type: "set-detection",
      payload: {
        language: template.build.language,
        framework: template.build.framework,
        frameworkVersion: template.build.frameworkVersion || null,
        dockerfileDetected: template.build.useDockerfile,
        buildCommand: template.build.buildCommand,
        confidence: 100,
        status: "success",
        primaryEngine: template.build.primaryEngine || null,
        primaryEngineVersion: template.build.primaryEngineVersion || null,
        secondaryEngine: template.build.secondaryEngine || null,
        secondaryEngineVersion: template.build.secondaryEngineVersion || null,
        defaultPort: template.build.defaultPort || null,
      },
    })

    dispatch({
      type: "set-build",
      payload: template.build,
    })

    dispatch({
      type: "set-environment",
      payload: {
        resourcePlanId: "payg",
        cpu: template.defaultCpu,
        memory: template.defaultMemory,
      },
    })
  }

  const handleConnectGithub = () => {
    setIsConnectingGithub(true)

    const next = new URLSearchParams(searchParams.toString())
    next.delete("github")
    next.set(DEPLOY_STEP_QUERY_KEY, "source")
    const returnTo = next.toString()
      ? `${pathname}?${next.toString()}`
      : pathname

    const installStartQuery = new URLSearchParams({ returnTo })
    window.location.assign(
      `/api/integrations/github/install/start?${installStartQuery.toString()}`
    )
  }

  const handleSourceNext = () => {
    const nextStep = getNextStep("source")
    if (nextStep) navigateStep(nextStep)
  }

  const handleConnectNext = () => {
    const nextStep = getNextStep("connect")
    if (nextStep) navigateStep(nextStep)
  }

  const handleDetectNext = () => {
    const nextStep = getNextStep("detect")
    if (nextStep) navigateStep(nextStep)
  }

  const handleEnvironmentDeploy = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch("/api/deploy/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildDeploySubmitPayload({ state, selectedRepository })
        ),
      })

      const payload = (await response.json()) as DeploySubmitResponse
      const errorMessage = getDeploySubmitError(response.ok, payload)

      if (errorMessage || !payload.data) {
        setSubmitError(errorMessage)
        return
      }

      dispatch({ type: "set-step", payload: "deploy" })
      dispatch({
        type: "start-monitor",
        payload: { shouldFail: false, failureReason: null },
      })
      dispatch({
        type: "set-monitor",
        payload: {
          deployId: payload.data.deploymentId,
          status: "queued",
          isActive: true,
        },
      })
    } catch {
      setSubmitError(
        "Network error while starting the deployment. Please try again."
      )
    } finally {
      setIsSubmitting(false)
    }
  }
  const resetDetectionState = () => {
    setDetectionError(null)
    setDetectionErrorCode(null)
    dispatch({ type: "set-detection", payload: null })
    dispatch({ type: "set-build", payload: null })
  }

  const renderStep = () => {
    const buildFieldChange = (
      field: string,
      value: string | number | boolean
    ) => {
      dispatch({ type: "set-build", payload: { [field]: value } })
    }

    if (state.step === "source") {
      const visibleRepositories = state.source.ownerId ? repositoryOptions : []

      return (
        <StepSourceV2
          messages={messages}
          sourceType={state.source.sourceType}
          templateId={state.source.templateId}
          githubConnectionStatus={githubConnectionStatus}
          isConnectingGithub={isConnectingGithub}
          githubReconnectRequired={githubReconnectRequired}
          ownerOptionsLoading={ownerOptionsLoading}
          ownerOptionsError={ownerOptionsError}
          repositoryOptionsLoading={
            state.source.ownerId ? repositoryOptionsLoading : false
          }
          repositoryOptionsError={
            state.source.ownerId ? repositoryOptionsError : null
          }
          ownerSearch={ownerSearch}
          repositorySearch={repositorySearch}
          owners={ownerOptions}
          repositories={visibleRepositories}
          branches={branches}
          selectedOwnerId={state.source.ownerId}
          selectedRepositoryId={state.source.repositoryId}
          selectedBranchName={state.source.branchName}
          rootDirectory={state.source.rootDirectory}
          appName={state.source.appName}
          templateResourcePlanId={state.environment.resourcePlanId}
          publicSourceUrl={state.source.publicSourceUrl}
          publicSourceRef={state.source.publicSourceRef}
          recentSources={recentSources}
          onPublicSourceUrlChange={(url) => {
            dispatch({ type: "set-source", payload: { publicSourceUrl: url } })
            resetDetectionState()
          }}
          onPublicSourceRefChange={(ref) => {
            dispatch({ type: "set-source", payload: { publicSourceRef: ref } })
            resetDetectionState()
          }}
          canProceed={sourceValid}
          isDetecting={isDetecting}
          detectionError={detectionError}
          onSourceTypeChange={(sourceType) => {
            dispatch({
              type: "set-source",
              payload: {
                sourceType,
                publicSourceUrl:
                  sourceType === "public" ? state.source.publicSourceUrl : "",
                publicSourceRef:
                  sourceType === "public" ? state.source.publicSourceRef : "",
              },
            })
            resetDetectionState()
          }}
          onTemplateSelect={handleTemplateSelect}
          onOwnerSearchChange={setOwnerSearch}
          onRepositorySearchChange={setRepositorySearch}
          onOwnerSelect={handleOwnerSelect}
          onRepositorySelect={handleRepositorySelect}
          onBranchSelect={(branchName) => {
            dispatch({ type: "set-source", payload: { branchName } })
          }}
          onRootDirectoryChange={(rootDirectory) => {
            dispatch({ type: "set-source", payload: { rootDirectory } })
            if (state.source.sourceType === "public") {
              resetDetectionState()
            }
          }}
          onAppNameChange={(appName) => {
            dispatch({ type: "set-source", payload: { appName } })
          }}
          onTemplateResourcePlanChange={(resourcePlanId) => {
            const template = DEPLOY_TEMPLATES.find(
              (item) => item.id === state.source.templateId
            )
            const updates: Partial<DeployEnvironmentState> = { resourcePlanId }
            if (template) {
              updates.cpu =
                resourcePlanId === "payg" ? template.defaultCpu : 100
              updates.memory =
                resourcePlanId === "payg" ? template.defaultMemory : 256
            }
            dispatch({ type: "set-environment", payload: updates })
          }}
          onConnectGithub={handleConnectGithub}
          onCancel={() => {
            dispatch({ type: "reset" })
            setOwnerSearch("")
            setRepositorySearch("")
          }}
          onNext={handleSourceNext}
        />
      )
    }

    if (state.step === "connect") {
      return (
        <StepConnectV2
          messages={messages}
          sourceType={state.source.sourceType}
          owner={selectedOwner}
          repository={selectedRepository}
          branch={selectedBranch}
          canProceed={sourceValid}
          onBack={() => navigateStep("source")}
          onNext={handleConnectNext}
        />
      )
    }

    if (state.step === "detect") {
      return (
        <StepDetectV2
          messages={messages}
          detectionResult={state.detectionResult}
          isDetecting={isDetecting}
          detectionRetrying={detectionRetrying}
          detectionAttempt={detectionAttempt}
          detectionError={detectionError}
          detectionErrorCode={detectionErrorCode}
          buildState={state.build}
          manualOverrideRequired={manualOverrideRequired}
          canProceed={buildValid}
          onBack={() => navigateStep("connect")}
          onNext={handleDetectNext}
          onBuildFieldChange={buildFieldChange}
          onRetry={() => {
            detectionAttemptRef.current = 0
            setDetectionAttempt(1)
            setDetectionError(null)
            setDetectionErrorCode(null)
            dispatch({ type: "set-detection", payload: null })
            dispatch({ type: "set-build", payload: null })
            setDetectionRunKey((current) => current + 1)
          }}
        />
      )
    }

    if (state.step === "review") {
      return (
        <StepReviewV2
          messages={messages}
          appName={state.source.appName}
          branchName={state.source.branchName}
          detectionResult={state.detectionResult}
          generatedSubdomain={toGeneratedSubdomain(
            selectedRepository?.name || state.source.templateId
          )}
          useGeneratedSubdomain={state.environment.useGeneratedSubdomain}
          customDomain={state.environment.customDomain}
          environmentId="staging"
          envVars={state.environment.envVars}
          resourcePlanId={state.environment.resourcePlanId}
          cpu={state.environment.cpu}
          memory={state.environment.memory}
          recommendedPlanId={
            state.detectionResult
              ? recommendPlanForLegacyDetection(state.detectionResult)
                  .resourcePlanId
              : null
          }
          hasMissingCustomDomain={hasMissingCustomDomain}
          hasInvalidCustomDomain={hasInvalidCustomDomain}
          validationMessages={environmentValidationMessages}
          canDeploy={environmentValid}
          isSubmitting={isSubmitting}
          submitError={submitError}
          rootDirectory={state.source.rootDirectory}
          onRootDirectoryChange={(rootDirectory) => {
            dispatch({ type: "set-source", payload: { rootDirectory } })
          }}
          sourceType={state.source.sourceType}
          buildState={state.build}
          onEditBuildSettings={() => navigateStep("detect")}
          onBack={() => navigateStep("detect")}
          onDeploy={handleEnvironmentDeploy}
          onDomainToggleChange={(useGeneratedSubdomain) => {
            dispatch({
              type: "set-environment",
              payload: { useGeneratedSubdomain },
            })
          }}
          onCustomDomainChange={(customDomain) => {
            dispatch({ type: "set-environment", payload: { customDomain } })
          }}
          onEnvVarsChange={(envVars) => {
            dispatch({ type: "set-environment", payload: { envVars } })
          }}
          onResourcePlanChange={(resourcePlanId) => {
            const updates: Partial<DeployEnvironmentState> = { resourcePlanId }
            if (resourcePlanId === "payg") {
              updates.cpu = 100
              updates.memory = 256
            }
            dispatch({ type: "set-environment", payload: updates })
          }}
          onCpuChange={(cpu) => {
            dispatch({ type: "set-environment", payload: { cpu } })
          }}
          onMemoryChange={(memory) => {
            dispatch({ type: "set-environment", payload: { memory } })
          }}
        />
      )
    }

    const liveDomain = state.environment.useGeneratedSubdomain
      ? toGeneratedSubdomain(
          selectedRepository?.name || state.source.templateId
        )
      : normalizedCustomDomain || undefined

    return (
      <StepMonitorV2
        messages={messages}
        appName={state.source.appName}
        deployId={state.monitor.deployId}
        status={state.monitor.status}
        logScope={state.monitor.logScope}
        attempt={state.monitor.attempt}
        failureReason={state.monitor.failureReason}
        liveDomain={liveDomain}
        dashboardHref={dashboardHref}
        onLogScopeChange={(logScope) => {
          dispatch({ type: "set-monitor-log-scope", payload: logScope })
        }}
        onRetry={() => {
          void handleEnvironmentDeploy()
        }}
        onEditSettings={() => navigateStep("review")}
      />
    )
  }

  const activePhase = getDeployPhase(state.step)
  const activePhaseIndex = DEPLOY_PHASES.findIndex(
    (phase) => phase.id === activePhase
  )

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            {messages.phases[activePhase].label}
          </p>
          <h1 className="text-2xl font-semibold">
            {title ?? messages.heading}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description ?? messages.description}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={messages.reset}
          onClick={() => dispatch({ type: "reset" })}
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <nav
          className="overflow-x-auto border-b border-border p-4"
          aria-label="Deploy wizard phases"
        >
          <ol className="flex min-w-[520px] items-center">
            {DEPLOY_PHASES.map((phase, index) => {
              const isActive = activePhase === phase.id
              const isCompleted = index < activePhaseIndex

              return (
                <li key={phase.id} className="flex min-w-0 flex-1 items-center">
                  {index > 0 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-4 h-px flex-1",
                        isCompleted ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                  <div
                    aria-current={isActive ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left",
                      isActive && "bg-primary/10"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                        isActive || isCompleted
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-4 w-4" aria-label="Completed" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">
                        {messages.phases[phase.id].label}
                      </span>
                      <span className="hidden text-[10px] text-muted-foreground sm:block">
                        {messages.phases[phase.id].description}
                      </span>
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        </nav>

        <main className="min-h-[560px] bg-background">{renderStep()}</main>
      </div>
    </div>
  )
}

export function DeployWizardV2({
  title,
  description,
  messages,
  dashboardHref,
}: DeployWizardV2Props) {
  return (
    <DeployWizardV2Inner
      title={title}
      description={description}
      messages={messages}
      dashboardHref={dashboardHref}
    />
  )
}
