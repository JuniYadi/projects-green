"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
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
  resolveMonitorStatus,
} from "@/modules/deploy/deploy.logic"
import {
  buildInitialBuildState,
  FAILURE_REASON,
  getDefaultBranchName,
  getDetectionForRepository,
  getRepositoryBranches,
  shouldDeploymentFailForRepository,
} from "@/modules/deploy/deploy.mock"
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
import { DeployStepper } from "@/modules/deploy/ui/deploy-stepper"
import { StepBuild } from "@/modules/deploy/ui/step-build"
import { StepEnvironment } from "@/modules/deploy/ui/step-environment"
import { StepMonitor } from "@/modules/deploy/ui/step-monitor"
import { StepSource } from "@/modules/deploy/ui/step-source"
import type {
  Branch,
  DeployEnvironmentState,
  DeploySourceType,
  DeployStep,
  DeployTemplateId,
  Owner,
  Repository,
} from "@/modules/deploy/deploy.types"

type GithubConnectionStatus = "idle" | "connected" | "error"

type GithubRepositoryApiItem = {
  repositoryId: number | string
  name: string
  owner: string
  defaultBranch?: string
  private: boolean
}

type GithubRepositoriesResponse = {
  ok: boolean
  items: GithubRepositoryApiItem[]
}

const toOwnerOptions = (repositories: Repository[]) => {
  const byOwnerId = new Map<string, Owner>()

  for (const repository of repositories) {
    if (byOwnerId.has(repository.ownerId)) {
      continue
    }

    byOwnerId.set(repository.ownerId, {
      id: repository.ownerId,
      name: repository.ownerId,
      avatarUrl: "",
    })
  }

  return Array.from(byOwnerId.values()).sort((left, right) => {
    return left.name.localeCompare(right.name)
  })
}

const mapGithubRepository = (item: GithubRepositoryApiItem): Repository => {
  return {
    id: String(item.repositoryId),
    ownerId: item.owner,
    name: item.name,
    isPrivate: item.private,
    defaultBranch: item.defaultBranch || undefined,
  }
}

const getRequestErrorMessage = (cause: unknown) => {
  if (cause instanceof Error && cause.message) {
    return cause.message
  }

  return "Unable to load repositories from GitHub. Please try again."
}

const buildRepositoriesUrl = (params: {
  ownerId?: string
  query?: string
  limit?: number
}) => {
  const searchParams = new URLSearchParams()

  if (params.ownerId) {
    searchParams.set("ownerId", params.ownerId)
  }

  if (params.query) {
    searchParams.set("query", params.query)
  }

  searchParams.set("limit", String(params.limit ?? 100))

  return `/api/integrations/github/repositories?${searchParams.toString()}`
}

const toGeneratedSubdomain = (repositoryName: string | undefined) => {
  const slug = (repositoryName ?? "my-app")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")

  return `${slug || "my-app"}.pfn.app`
}

function DeployWizardInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const state = useDeployWizardState()
  const dispatch = useDeployWizardDispatch()

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
  const [repositoryById, setRepositoryById] = useState<
    Record<string, Repository>
  >({})
  const [isConnectingGithub, setIsConnectingGithub] = useState(false)

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
    ] satisfies Branch[]
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

        setOwnerOptions(toOwnerOptions(mapped))
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
  }, [ownerSearch])

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

    const timeoutId = window.setTimeout(() => {
      const nextTick = state.monitor.tick + 1
      const nextStatus = resolveMonitorStatus(
        nextTick,
        state.monitor.shouldFail
      )

      dispatch({ type: "increment-monitor-tick" })
      dispatch({ type: "set-monitor-status", payload: nextStatus })
    }, MONITOR_POLL_INTERVAL_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    dispatch,
    state.monitor.isActive,
    state.monitor.shouldFail,
    state.monitor.tick,
    state.step,
  ])

  const handleOwnerSelect = (ownerId: string) => {
    setRepositorySearch("")
    setRepositoryOptions([])
    setRepositoryOptionsError(null)
    setRepositoryOptionsLoading(false)

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
    const defaultBranchFromApi =
      repositoryById[repositoryId]?.defaultBranch ?? ""
    const branchName =
      defaultBranchFromApi || getDefaultBranchName(repositoryId)
    const detectionResult = getDetectionForRepository(repositoryId)

    dispatch({
      type: "set-source",
      payload: {
        sourceType: "github",
        repositoryId,
        branchName,
        templateId: undefined,
      },
    })

    dispatch({ type: "set-detection", payload: detectionResult })

    dispatch({
      type: "set-build",
      payload: buildInitialBuildState(repositoryId),
    })
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
      },
    })

    dispatch({
      type: "set-detection",
      payload: {
        language: template.build.language,
        framework: template.build.framework,
        dockerfileDetected: template.build.useDockerfile,
        buildCommand: template.build.buildCommand,
        confidence: 100,
        status: "success",
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
    const nextStep = getNextStep("build")
    if (!nextStep) {
      return
    }

    navigateStep(nextStep)
  }

  const handleSourceNext = () => {
    const nextStep = getNextStep("source")
    if (!nextStep) {
      return
    }

    // If template, we might want to skip build or just pre-fill it.
    // For now we just go to build, but it will be pre-filled.
    navigateStep(nextStep)
  }

  const handleEnvironmentDeploy = () => {
    dispatch({ type: "set-step", payload: "monitor" })

    dispatch({
      type: "start-monitor",
      payload: {
        shouldFail: shouldDeploymentFailForRepository(
          state.source.repositoryId
        ),
        failureReason: shouldDeploymentFailForRepository(
          state.source.repositoryId
        )
          ? FAILURE_REASON
          : null,
      },
    })
  }

  const renderStep = () => {
    if (state.step === "source") {
      const visibleRepositories = state.source.ownerId ? repositoryOptions : []

      return (
        <StepSource
          sourceType={state.source.sourceType}
          templateId={state.source.templateId}
          githubConnectionStatus={githubConnectionStatus}
          isConnectingGithub={isConnectingGithub}
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
          canProceed={sourceValid}
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
        <StepBuild
          owner={selectedOwner}
          repository={selectedRepository}
          branch={selectedBranch}
          rootDirectory={state.source.rootDirectory}
          detectionResult={state.detectionResult}
          language={state.build.language}
          framework={state.build.framework}
          buildCommand={state.build.buildCommand}
          useDockerfile={state.build.useDockerfile}
          manualOverrideRequired={manualOverrideRequired}
          canProceed={buildValid}
          onBack={() => {
            const previous = getPreviousStep("build")
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
        <StepEnvironment
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
          hasMissingCustomDomain={hasMissingCustomDomain}
          hasInvalidCustomDomain={hasInvalidCustomDomain}
          validationMessages={environmentValidationMessages}
          canDeploy={environmentValid}
          onBack={() => {
            const previous = getPreviousStep("environment")
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
      <StepMonitor
        status={state.monitor.status}
        logScope={state.monitor.logScope}
        attempt={state.monitor.attempt}
        failureReason={state.monitor.failureReason}
        onLogScopeChange={(logScope) => {
          dispatch({ type: "set-monitor-log-scope", payload: logScope })
        }}
        onRetry={() => {
          dispatch({ type: "retry-monitor" })
        }}
        onEditSettings={() => {
          dispatch({ type: "set-step", payload: "environment" })
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-6">
          <DeployStepper
            currentStep={state.step}
            maxUnlockedStep={maxUnlockedStep}
            onStepChange={navigateStep}
          />
        </CardContent>
      </Card>

      {renderStep()}
    </div>
  )
}

export function DeployWizard() {
  return <DeployWizardInner />
}
