"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type K8sEnvironmentId = "dev" | "staging" | "prod"

type K8sEnvironment = {
  id: K8sEnvironmentId
  label: string
  description: string
}

const K8S_ENVIRONMENTS: K8sEnvironment[] = [
  { id: "dev", label: "Development", description: "Internal development" },
  { id: "staging", label: "Staging", description: "Pre-production testing" },
  { id: "prod", label: "Production", description: "Live traffic" },
]

type DeploymentSummary = {
  id: string
  name: string
  namespace: string
  version: string
  replicas: number
  readyReplicas: number
  status: "healthy" | "progressing" | "degraded"
}

type ResourceConfig = {
  cpuRequest: string
  cpuLimit: string
  memoryRequest: string
  memoryLimit: string
  replicas: number
}

type ConfigResource = {
  id: string
  kind: "configmap" | "secret"
  name: string
  keyCount: number
  mountedAs: "env" | "volume"
}

type RolloutRecord = {
  id: string
  version: string
  commitSha: string
  status: "succeeded" | "failed" | "rolled_back"
  message: string
}

type StagedChange = {
  id: string
  type: string
  summary: string
  status: "draft" | "committed" | "applied"
}

const MOCK_DEPLOYMENTS: Record<K8sEnvironmentId, DeploymentSummary[]> = {
  dev: [
    {
      id: "deploy-dev-api",
      name: "api-server",
      namespace: "app-dev",
      version: "v1.4.0",
      replicas: 2,
      readyReplicas: 2,
      status: "healthy",
    },
    {
      id: "deploy-dev-worker",
      name: "worker",
      namespace: "app-dev",
      version: "v1.4.0",
      replicas: 1,
      readyReplicas: 1,
      status: "healthy",
    },
  ],
  staging: [
    {
      id: "deploy-staging-api",
      name: "api-server",
      namespace: "app-staging",
      version: "v1.3.2",
      replicas: 2,
      readyReplicas: 2,
      status: "healthy",
    },
  ],
  prod: [
    {
      id: "deploy-prod-api",
      name: "api-server",
      namespace: "app-prod",
      version: "v1.3.1",
      replicas: 3,
      readyReplicas: 3,
      status: "healthy",
    },
    {
      id: "deploy-prod-worker",
      name: "worker",
      namespace: "app-prod",
      version: "v1.3.1",
      replicas: 2,
      readyReplicas: 2,
      status: "healthy",
    },
  ],
}

const MOCK_CONFIG_RESOURCES: Record<K8sEnvironmentId, ConfigResource[]> = {
  dev: [
    {
      id: "cm-dev-app",
      kind: "configmap",
      name: "app-config",
      keyCount: 8,
      mountedAs: "env",
    },
    {
      id: "secret-dev-db",
      kind: "secret",
      name: "db-credentials",
      keyCount: 3,
      mountedAs: "env",
    },
  ],
  staging: [
    {
      id: "cm-staging-app",
      kind: "configmap",
      name: "app-config",
      keyCount: 10,
      mountedAs: "env",
    },
    {
      id: "secret-staging-db",
      kind: "secret",
      name: "db-credentials",
      keyCount: 3,
      mountedAs: "env",
    },
  ],
  prod: [
    {
      id: "cm-prod-app",
      kind: "configmap",
      name: "app-config",
      keyCount: 12,
      mountedAs: "env",
    },
    {
      id: "secret-prod-db",
      kind: "secret",
      name: "db-credentials",
      keyCount: 4,
      mountedAs: "env",
    },
    {
      id: "secret-prod-tls",
      kind: "secret",
      name: "tls-cert",
      keyCount: 2,
      mountedAs: "volume",
    },
  ],
}

const MOCK_ROLLOUT_HISTORY: Record<K8sEnvironmentId, RolloutRecord[]> = {
  dev: [
    {
      id: "roll-dev-1",
      version: "v1.4.0",
      commitSha: "abc1234",
      status: "succeeded",
      message: "Deployed latest feature branch",
    },
    {
      id: "roll-dev-2",
      version: "v1.3.2",
      commitSha: "def5678",
      status: "succeeded",
      message: "Previous stable release",
    },
  ],
  staging: [
    {
      id: "roll-staging-1",
      version: "v1.3.2",
      commitSha: "def5678",
      status: "succeeded",
      message: "Promoted from dev",
    },
  ],
  prod: [
    {
      id: "roll-prod-1",
      version: "v1.3.1",
      commitSha: "ghi9012",
      status: "succeeded",
      message: "Stable release",
    },
    {
      id: "roll-prod-2",
      version: "v1.3.0",
      commitSha: "jkl3456",
      status: "rolled_back",
      message: "Rolled back due to memory leak",
    },
  ],
}

const DEFAULT_RESOURCE_CONFIG: ResourceConfig = {
  cpuRequest: "100m",
  cpuLimit: "500m",
  memoryRequest: "128Mi",
  memoryLimit: "512Mi",
  replicas: 2,
}

const CHANGE_TYPES = [
  "resource-tuning",
  "config-resource",
  "volume-mount",
  "promotion",
  "rollback",
] as const

export default function OperatePage() {
  const [selectedEnvironmentId, setSelectedEnvironmentId] =
    useState<K8sEnvironmentId>("dev")
  const [selectedDeploymentId, setSelectedDeploymentId] = useState(
    MOCK_DEPLOYMENTS.dev[0]?.id ?? ""
  )
  const [resourceConfig, setResourceConfig] = useState<ResourceConfig>({
    ...DEFAULT_RESOURCE_CONFIG,
  })
  const [stagedChanges, setStagedChanges] = useState<StagedChange[]>([])
  const [stageType, setStageType] = useState<string>("resource-tuning")
  const [stageSummary, setStageSummary] = useState("")

  const deployments = MOCK_DEPLOYMENTS[selectedEnvironmentId] ?? []
  const configResources = MOCK_CONFIG_RESOURCES[selectedEnvironmentId] ?? []
  const rolloutHistory = MOCK_ROLLOUT_HISTORY[selectedEnvironmentId] ?? []

  const configMaps = configResources.filter((item) => item.kind === "configmap")
  const secrets = configResources.filter((item) => item.kind === "secret")

  const handleEnvironmentChange = (environmentId: K8sEnvironmentId) => {
    setSelectedEnvironmentId(environmentId)
    const firstDeployment = MOCK_DEPLOYMENTS[environmentId]?.[0]
    setSelectedDeploymentId(firstDeployment?.id ?? "")
    setResourceConfig({ ...DEFAULT_RESOURCE_CONFIG })
    setStagedChanges([])
  }

  const handleStageChange = () => {
    if (stageSummary.trim().length === 0) {
      return
    }

    const newChange: StagedChange = {
      id: `change-${Date.now()}`,
      type: stageType,
      summary: stageSummary,
      status: "draft",
    }

    setStagedChanges((current) => [...current, newChange])
    setStageSummary("")
  }

  const handleCreateCommit = () => {
    setStagedChanges((current) =>
      current.map((change) =>
        change.status === "draft"
          ? { ...change, status: "committed" as const }
          : change
      )
    )
  }

  const handleApplyCommit = () => {
    setStagedChanges((current) =>
      current.map((change) =>
        change.status === "committed"
          ? { ...change, status: "applied" as const }
          : change
      )
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Operate</CardTitle>
          <CardDescription>
            Manage post-deploy runtime changes using a GitOps-style workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {K8S_ENVIRONMENTS.map((environment) => {
              const isSelected = environment.id === selectedEnvironmentId

              return (
                <button
                  key={environment.id}
                  type="button"
                  onClick={() => handleEnvironmentChange(environment.id)}
                  className={`rounded-md border p-3 text-left text-sm ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background"
                  }`}
                >
                  <p className="font-medium">{environment.label}</p>
                  <p className="text-muted-foreground">
                    {environment.description}
                  </p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deployment Inventory</CardTitle>
          <CardDescription>
            Select the deployment target to tune runtime settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {deployments.map((deployment) => {
            const isSelected = deployment.id === selectedDeploymentId

            return (
              <button
                key={deployment.id}
                type="button"
                onClick={() => setSelectedDeploymentId(deployment.id)}
                className={`w-full rounded-md border p-3 text-left text-sm ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background"
                }`}
              >
                <p className="font-medium">
                  {deployment.name} ({deployment.namespace})
                </p>
                <p className="text-muted-foreground">
                  {deployment.version} | ready {deployment.readyReplicas}/
                  {deployment.replicas} | {deployment.status}
                </p>
              </button>
            )
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Config Resources</CardTitle>
            <CardDescription>
              ConfigMap and Secret resources for this environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                ConfigMap
              </p>
              <ul className="space-y-1">
                {configMaps.map((item) => (
                  <li
                    key={item.id}
                    className="rounded border border-border p-2"
                  >
                    {item.name} ({item.keyCount} keys, {item.mountedAs})
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Secret
              </p>
              <ul className="space-y-1">
                {secrets.map((item) => (
                  <li
                    key={item.id}
                    className="rounded border border-border p-2"
                  >
                    {item.name} ({item.keyCount} keys, {item.mountedAs})
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resource Tuning</CardTitle>
            <CardDescription>
              Set CPU/memory requests and limits plus desired replicas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium">CPU request</span>
                <Input
                  value={resourceConfig.cpuRequest}
                  onChange={(event) =>
                    setResourceConfig((current) => ({
                      ...current,
                      cpuRequest: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium">CPU limit</span>
                <Input
                  value={resourceConfig.cpuLimit}
                  onChange={(event) =>
                    setResourceConfig((current) => ({
                      ...current,
                      cpuLimit: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium">Memory request</span>
                <Input
                  value={resourceConfig.memoryRequest}
                  onChange={(event) =>
                    setResourceConfig((current) => ({
                      ...current,
                      memoryRequest: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium">Memory limit</span>
                <Input
                  value={resourceConfig.memoryLimit}
                  onChange={(event) =>
                    setResourceConfig((current) => ({
                      ...current,
                      memoryLimit: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium">Replicas</span>
                <Input
                  value={String(resourceConfig.replicas)}
                  onChange={(event) => {
                    const parsed = Number(event.target.value)
                    if (!Number.isNaN(parsed)) {
                      setResourceConfig((current) => ({
                        ...current,
                        replicas: parsed,
                      }))
                    }
                  }}
                />
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rollout History</CardTitle>
          <CardDescription>
            Review recent versions and rollback to a selected release.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {rolloutHistory.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded border border-border p-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {item.version} ({item.commitSha})
                </p>
                <p className="text-muted-foreground">
                  {item.status} &bull; {item.message}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm">
                Rollback
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>GitOps Change Staging</CardTitle>
          <CardDescription>
            Stage changes, create commit, then apply and reconcile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={stageType}
              onChange={(event) => setStageType(event.target.value)}
            >
              {CHANGE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <Input
              value={stageSummary}
              placeholder="Describe your change"
              onChange={(event) => setStageSummary(event.target.value)}
            />
            <Button type="button" variant="outline" onClick={handleStageChange}>
              Stage
            </Button>
          </div>

          <div className="space-y-2">
            {stagedChanges.length > 0 ? (
              stagedChanges.map((change) => (
                <div
                  key={change.id}
                  className="rounded border border-border p-2 text-sm"
                >
                  <p className="font-medium">
                    {change.type} &bull; {change.status}
                  </p>
                  <p className="text-muted-foreground">{change.summary}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No staged changes yet.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCreateCommit}
            >
              Create Commit
            </Button>
            <Button type="button" variant="outline" onClick={handleApplyCommit}>
              Apply Commit
            </Button>
            <Button type="button" variant="outline">
              Reconcile
            </Button>
            <Button type="button">Promote</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
