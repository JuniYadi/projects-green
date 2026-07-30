"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { ArrowLeft, X } from "@/components/ui/phosphor-icons"
import { Button } from "@/components/ui/button"
import {
  fetchFrameworkDetection,
  DetectionError,
} from "@/modules/deploy/deploy-detection.service"
import { recommendPlan } from "@/modules/deploy/deploy-recommendation"
import {
  DEPLOY_STEP_QUERY_KEY,
  DEPLOY_TEMPLATES,
  MONITOR_POLL_INTERVAL_MS,
  parseStepQueryValue,
} from "@/modules/deploy/deploy.constants"
import {
  clampStepToUnlocked,
  getMaxUnlockedStep,
  getNextStep,
  getPreviousStep,
} from "@/modules/deploy/deploy.logic"
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
import { DeployChatSidebar } from "@/modules/deploy/ui/deploy-chat-sidebar"
import { DeployTimelineV2 } from "@/modules/deploy/ui/deploy-timeline-v2"
import { StepBuildV2 } from "@/modules/deploy/ui/step-build-v2"
import { StepEnvironmentV2 } from "@/modules/deploy/ui/step-environment-v2"
import { StepMonitorV2 } from "@/modules/deploy/ui/step-monitor-v2"
import { StepSourceV2 } from "@/modules/deploy/ui/step-source-v2"
import {
  buildDeploySubmitPayload,
  buildRepositoriesUrl,
  generateAppName,
  getDeploySubmitError,
  getRequestErrorMessage,
  mapGithubRepository,
  toGeneratedSubdomain,
  toOwnerOptions,
  type DeploySubmitResponse,
  type GithubRepositoriesResponse,
} from "@/modules/deploy/deploy-wizard.logic"

type GithubConnectionStatus = "idle" | "connected" | "error"

type DeployWizardV2Props = {
  title?: string
  description?: string
}

function DeployWizardV2Inner({ title, description }: DeployWizardV2Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const state = useDeployWizardState()
  const dispatch = useDeployWizardDispatch()

  const [chatCollapsed, setChatCollapsed] = useState(false)
  const [ownerSearch, setOwnerSearch] = useState("")
  const [repositorySearch, setRepositorySearch] = useState("")
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
  const detectionAbortRef = useRef<AbortController | null>(null)

  const githubConnectionStatus: GithubConnectionStatus = (() => {
    const status = searchParams.get("github")

    if (status === "connected") {
      return "connected"
    }

    if (status === "error") {
      return "error"
    }

    return "idle"
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
        const response = await fetch(
          buildRepositoriesUrl({ query: ownerSearch, limit: 100 }),
          {
            signal: controller.signal,
          }
        )

        if (response.status === 409) {
          const payload = (await response
            .json()
            .catch(() => null)) as GithubRepositoriesResponse | null
          if (payload?.error === "GITHUB_RECONNECT_REQUIRED") {
            setOwnerOptions([])
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

        if (Array.isArray(payload.owners) && payload.owners.length > 0) {
          const owners = payload.owners.map(
            (owner: {
              id: string
              name: string
              avatarUrl: string | null
            }) => ({
              id: owner.id,
              name: owner.name,
              avatarUrl: owner.avatarUrl ?? "",
            })
          )
          setOwnerOptions(owners)
          if (owners.length === 1) {
            setRepositorySearch("")
            setRepositoryOptions(mapped)
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
        } else {
          setOwnerOptions(toOwnerOptions(mapped))
        }
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

        setOwnerOptions([])
        setOwnerOptionsError(getRequestErrorMessage(cause))
      } finally {
        setOwnerOptionsLoading(false)
      }
    }

    void run()

    return () => {
      controller.abort()
    }
  }, [ownerSearch, dispatch])

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

  const sourceValid = validateSourceStep(state.source)
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

  const maxUnlockedStep = getMaxUnlockedStep(state)
  const manualOverrideRequired = isManualOverrideRequired(state.detectionResult)

  const navigateStep = (step: DeployStep) => {
    const clampedStep = clampStepToUnlocked(step, state)
    dispatch({ type: "set-step", payload: clampedStep })
  }

  useEffect(() => {
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
    if (state.step !== "monitor" || !state.monitor.isActive) {
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

  const handleRepositorySelect = async (repositoryId: string) => {
    const repo = repositoryById[repositoryId]
    const defaultBranchFromApi = repo?.defaultBranch ?? ""
    const branchName =
      defaultBranchFromApi || getDefaultBranchName(repositoryId)

    detectionAbortRef.current?.abort()
    const controller = new AbortController()
    detectionAbortRef.current = controller

    dispatch({
      type: "set-source",
      payload: {
        sourceType: "github",
        repositoryId,
        branchName,
        templateId: undefined,
      },
    })

    setIsDetecting(true)
    setDetectionError(null)
    dispatch({ type: "set-detection", payload: null })
    dispatch({ type: "set-build", payload: null })

    if (repo) {
      try {
        const detectionResult = await fetchFrameworkDetection(
          {
            installationId: repo.installationId,
            owner: repo.ownerId,
            repo: repo.name,
            ref: branchName || undefined,
            subdir: undefined,
          },
          controller.signal
        )

        if (controller.signal.aborted) return

        dispatch({ type: "set-detection", payload: detectionResult })
        dispatch({
          type: "set-build",
          payload: {
            language: detectionResult.language ?? "",
            framework: detectionResult.framework ?? "",
            frameworkVersion: detectionResult.frameworkVersion ?? "",
            buildCommand: detectionResult.buildCommand ?? "",
            useDockerfile: detectionResult.dockerfileDetected,
            primaryEngine: detectionResult.primaryEngine ?? "",
            primaryEngineVersion: detectionResult.primaryEngineVersion ?? "",
            secondaryEngine: detectionResult.secondaryEngine ?? "",
            secondaryEngineVersion:
              detectionResult.secondaryEngineVersion ?? "",
            defaultPort: detectionResult.defaultPort ?? 0,
          },
        })

        const recommendation = recommendPlan(detectionResult)
        dispatch({
          type: "set-environment",
          payload: {
            resourcePlanId: recommendation.resourcePlanId,
            cpu: recommendation.cpu ?? state.environment.cpu,
            memory: recommendation.memory ?? state.environment.memory,
          },
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return

        const message =
          err instanceof DetectionError
            ? err.message
            : "Failed to detect framework. You can configure build settings manually."

        setDetectionError(message)
      } finally {
        if (!controller.signal.aborted) {
          setIsDetecting(false)
        }
      }
    } else {
      setIsDetecting(false)
    }

    detectionAbortRef.current = null
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

  const handleBuildNext = () => {
    const nextStep = getNextStep("build", state)
    if (!nextStep) {
      return
    }

    navigateStep(nextStep)
  }

  const handleSourceNext = () => {
    const nextStep = getNextStep("source", state)
    if (!nextStep) {
      return
    }

    navigateStep(nextStep)
  }

  const handleDeployWithDefaults = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch("/api/deploy/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildDeploySubmitPayload({
            state,
            selectedRepository,
            deployWithTemplateDefaults: true,
          })
        ),
      })

      const payload = (await response.json()) as DeploySubmitResponse
      const errorMessage = getDeploySubmitError(response.ok, payload)

      if (errorMessage || !payload.data) {
        setSubmitError(errorMessage)
        return
      }

      dispatch({ type: "set-step", payload: "monitor" })
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

      dispatch({ type: "set-step", payload: "monitor" })
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

  const renderStep = () => {
    if (state.step === "source") {
      const visibleRepositories = state.source.ownerId ? repositoryOptions : []

      return (
        <StepSourceV2
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
          canProceed={sourceValid}
          isDetecting={isDetecting}
          detectionError={detectionError}
          onSourceTypeChange={(sourceType) => {
            dispatch({ type: "set-source", payload: { sourceType } })
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
          }}
          onAppNameChange={(appName) => {
            dispatch({ type: "set-source", payload: { appName } })
          }}
          onTemplateResourcePlanChange={(resourcePlanId) => {
            const template = DEPLOY_TEMPLATES.find(
              (t) => t.id === state.source.templateId
            )
            const updates: Partial<DeployEnvironmentState> = { resourcePlanId }
            if (template) {
              if (resourcePlanId === "payg") {
                updates.cpu = template.defaultCpu
                updates.memory = template.defaultMemory
              } else {
                updates.cpu = 100
                updates.memory = 256
              }
            }
            dispatch({ type: "set-environment", payload: updates })
          }}
          onDeployWithDefaults={handleDeployWithDefaults}
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

    if (state.step === "build") {
      return (
        <StepBuildV2
          owner={selectedOwner}
          repository={selectedRepository}
          branch={selectedBranch}
          rootDirectory={state.source.rootDirectory}
          detectionResult={state.detectionResult}
          isDetecting={isDetecting}
          language={state.build.language}
          framework={state.build.framework}
          frameworkVersion={state.build.frameworkVersion ?? ""}
          buildCommand={state.build.buildCommand}
          useDockerfile={state.build.useDockerfile}
          primaryEngine={state.build.primaryEngine ?? ""}
          primaryEngineVersion={state.build.primaryEngineVersion ?? ""}
          secondaryEngine={state.build.secondaryEngine ?? ""}
          secondaryEngineVersion={state.build.secondaryEngineVersion ?? ""}
          defaultPort={state.build.defaultPort ?? 0}
          manualOverrideRequired={manualOverrideRequired}
          canProceed={buildValid}
          onBack={() => {
            const previous = getPreviousStep("build", state)
            if (!previous) {
              return
            }

            navigateStep(previous)
          }}
          onNext={handleBuildNext}
          onBuildFieldChange={(field, value) => {
            dispatch({ type: "set-build", payload: { [field]: value } })
          }}
        />
      )
    }

    if (state.step === "environment") {
      return (
        <StepEnvironmentV2
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
              ? recommendPlan(state.detectionResult).resourcePlanId
              : null
          }
          hasMissingCustomDomain={hasMissingCustomDomain}
          hasInvalidCustomDomain={hasInvalidCustomDomain}
          validationMessages={environmentValidationMessages}
          canDeploy={environmentValid}
          isSubmitting={isSubmitting}
          submitError={submitError}
          sourceType={state.source.sourceType}
          buildState={state.build}
          onEditBuildSettings={() =>
            dispatch({ type: "set-step", payload: "build" })
          }
          onBack={() => {
            const previous = getPreviousStep("environment", state)
            if (!previous) {
              return
            }

            navigateStep(previous)
          }}
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
            dispatch({
              type: "set-environment",
              payload: {
                envVars,
              },
            })
          }}
          onResourcePlanChange={(resourcePlanId) => {
            const updates: Partial<DeployEnvironmentState> = { resourcePlanId }
            if (resourcePlanId === "payg") {
              updates.cpu = updates.cpu ?? 100
              updates.memory = updates.memory ?? 256
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

    return (
      <StepMonitorV2
        deployId={state.monitor.deployId}
        status={state.monitor.status}
        logScope={state.monitor.logScope}
        attempt={state.monitor.attempt}
        failureReason={state.monitor.failureReason}
        onLogScopeChange={(logScope) => {
          dispatch({ type: "set-monitor-log-scope", payload: logScope })
        }}
        onRetry={() => {
          void handleEnvironmentDeploy()
        }}
        onEditSettings={() => {
          dispatch({ type: "set-step", payload: "environment" })
        }}
      />
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {title ?? "Deploy Application"}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => dispatch({ type: "reset" })}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dispatch({ type: "reset" })}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 gap-4">
        <div className="w-52 shrink-0">
          <DeployTimelineV2
            currentStep={state.step}
            maxUnlockedStep={maxUnlockedStep}
            sourceType={state.source.sourceType}
            onStepChange={navigateStep}
          />
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto">{renderStep()}</div>

        <DeployChatSidebar
          context={{
            step: state.step,
            sourceType: state.source.sourceType,
            githubConnected: githubConnectionStatus === "connected",
            userName: selectedOwner?.name ?? "",
            framework: state.build.framework,
            confidence: state.detectionResult
              ? state.detectionResult.confidence >= 80
                ? "high"
                : state.detectionResult.confidence >= 50
                  ? "medium"
                  : "low"
              : null,
            resourcePlan: state.environment.resourcePlanId,
          }}
          isCollapsed={chatCollapsed}
          onToggleCollapse={() => setChatCollapsed((prev) => !prev)}
        />
      </div>
    </div>
  )
}

export function DeployWizardV2({ title, description }: DeployWizardV2Props) {
  return <DeployWizardV2Inner title={title} description={description} />
}
