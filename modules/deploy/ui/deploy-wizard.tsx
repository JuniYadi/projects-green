"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DEPLOY_STEP_QUERY_KEY,
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
  MOCK_OWNERS,
  MOCK_REPOSITORIES,
  queryOwners,
  queryRepositories,
  shouldDeploymentFailForRepository,
} from "@/modules/deploy/deploy.mock"
import {
  isManualOverrideRequired,
  validateBuildStep,
  validateEnvironmentStep,
  validateEnvVarKeysUnique,
  validateSourceStep,
} from "@/modules/deploy/deploy.schema"
import {
  DeployWizardProvider,
  useDeployWizardDispatch,
  useDeployWizardState,
} from "@/modules/deploy/deploy.store"
import { DeployStepper } from "@/modules/deploy/ui/deploy-stepper"
import { StepBuild } from "@/modules/deploy/ui/step-build"
import { StepEnvironment } from "@/modules/deploy/ui/step-environment"
import { StepMonitor } from "@/modules/deploy/ui/step-monitor"
import { StepSource } from "@/modules/deploy/ui/step-source"
import type { DeployStep } from "@/modules/deploy/deploy.types"

const generateEnvVarId = () => {
  return `env-${Math.random().toString(36).slice(2, 10)}`
}

function DeployWizardInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const state = useDeployWizardState()
  const dispatch = useDeployWizardDispatch()

  const [ownerSearch, setOwnerSearch] = useState("")
  const [repositorySearch, setRepositorySearch] = useState("")

  const selectedOwner = useMemo(() => {
    return MOCK_OWNERS.find((owner) => owner.id === state.source.ownerId) ?? null
  }, [state.source.ownerId])

  const selectedRepository = useMemo(() => {
    return (
      MOCK_REPOSITORIES.find((repo) => repo.id === state.source.repositoryId) ??
      null
    )
  }, [state.source.repositoryId])

  const branches = useMemo(() => {
    if (!state.source.repositoryId) {
      return []
    }

    return getRepositoryBranches(state.source.repositoryId)
  }, [state.source.repositoryId])

  const selectedBranch = useMemo(() => {
    return branches.find((branch) => branch.name === state.source.branchName) ?? null
  }, [branches, state.source.branchName])

  const owners = useMemo(() => {
    return queryOwners(ownerSearch).data
  }, [ownerSearch])

  const repositories = useMemo(() => {
    if (!state.source.ownerId) {
      return []
    }

    return queryRepositories(state.source.ownerId, repositorySearch).data
  }, [repositorySearch, state.source.ownerId])

  const sourceValid = validateSourceStep(state.source)
  const buildValid = validateBuildStep(state.build, state.detectionResult)
  const environmentValid = validateEnvironmentStep(state.environment)
  const hasDuplicateEnvKeys = !validateEnvVarKeysUnique(state.environment.envVars)

  const maxUnlockedStep = getMaxUnlockedStep(state)
  const manualOverrideRequired = isManualOverrideRequired(state.detectionResult)

  const navigateStep = (step: DeployStep) => {
    const clampedStep = clampStepToUnlocked(step, state)
    dispatch({ type: "set-step", payload: clampedStep })
  }

  useEffect(() => {
    const queryStep = parseStepQueryValue(searchParams.get(DEPLOY_STEP_QUERY_KEY))
    const clampedQueryStep = clampStepToUnlocked(queryStep, state)

    if (clampedQueryStep !== state.step) {
      dispatch({ type: "set-step", payload: clampedQueryStep })
    }
    // Run once for initial URL hydration. Ongoing navigation is driven by state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const queryStep = parseStepQueryValue(searchParams.get(DEPLOY_STEP_QUERY_KEY))

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
      const nextStatus = resolveMonitorStatus(nextTick, state.monitor.shouldFail)

      dispatch({ type: "increment-monitor-tick" })
      dispatch({ type: "set-monitor-status", payload: nextStatus })
    }, MONITOR_POLL_INTERVAL_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [dispatch, state.monitor.isActive, state.monitor.shouldFail, state.monitor.tick, state.step])

  const handleOwnerSelect = (ownerId: string) => {
    setRepositorySearch("")

    dispatch({
      type: "set-source",
      payload: {
        ownerId,
        repositoryId: "",
        branchName: "",
      },
    })

    dispatch({ type: "set-detection", payload: null })
  }

  const handleRepositorySelect = (repositoryId: string) => {
    const branchName = getDefaultBranchName(repositoryId)
    const detectionResult = getDetectionForRepository(repositoryId)

    dispatch({
      type: "set-source",
      payload: {
        repositoryId,
        branchName,
      },
    })

    dispatch({ type: "set-detection", payload: detectionResult })

    dispatch({
      type: "set-build",
      payload: buildInitialBuildState(repositoryId),
    })
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

    navigateStep(nextStep)
  }

  const handleEnvironmentDeploy = () => {
    dispatch({ type: "set-step", payload: "monitor" })

    dispatch({
      type: "start-monitor",
      payload: {
        shouldFail: shouldDeploymentFailForRepository(state.source.repositoryId),
        failureReason: shouldDeploymentFailForRepository(state.source.repositoryId)
          ? FAILURE_REASON
          : null,
      },
    })
  }

  const renderStep = () => {
    if (state.step === "source") {
      return (
        <StepSource
          ownerSearch={ownerSearch}
          repositorySearch={repositorySearch}
          owners={owners}
          repositories={repositories}
          branches={branches}
          selectedOwnerId={state.source.ownerId}
          selectedRepositoryId={state.source.repositoryId}
          selectedBranchName={state.source.branchName}
          rootDirectory={state.source.rootDirectory}
          canProceed={sourceValid}
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
          useGeneratedSubdomain={state.environment.useGeneratedSubdomain}
          customDomain={state.environment.customDomain}
          envVars={state.environment.envVars}
          resourcePlanId={state.environment.resourcePlanId}
          hasDuplicateEnvKeys={hasDuplicateEnvKeys}
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
          onAddEnvVar={() => {
            dispatch({
              type: "set-environment",
              payload: {
                envVars: [
                  ...state.environment.envVars,
                  {
                    id: generateEnvVarId(),
                    key: "",
                    value: "",
                  },
                ],
              },
            })
          }}
          onUpdateEnvVar={(id, field, value) => {
            dispatch({
              type: "set-environment",
              payload: {
                envVars: state.environment.envVars.map((item) => {
                  if (item.id !== id) {
                    return item
                  }

                  return {
                    ...item,
                    [field]: value,
                  }
                }),
              },
            })
          }}
          onRemoveEnvVar={(id) => {
            dispatch({
              type: "set-environment",
              payload: {
                envVars: state.environment.envVars.filter((item) => item.id !== id),
              },
            })
          }}
          onResourcePlanChange={(resourcePlanId) => {
            dispatch({ type: "set-environment", payload: { resourcePlanId } })
          }}
        />
      )
    }

    return (
      <StepMonitor
        status={state.monitor.status}
        logScope={state.monitor.logScope}
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
        <CardHeader className="gap-2">
          <CardTitle>Deploy Application</CardTitle>
          <p className="text-xs text-muted-foreground">
            Let&apos;s get your code running in the cloud.
          </p>
        </CardHeader>
        <CardContent>
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
  return (
    <DeployWizardProvider>
      <DeployWizardInner />
    </DeployWizardProvider>
  )
}
