"use client"

import { useMemo, useState } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type K8sEnvironmentId = "dev" | "staging" | "prod"

type K8sEnvironment = {
  id: K8sEnvironmentId
  label: string
}

const K8S_ENVIRONMENTS: K8sEnvironment[] = [
  { id: "dev", label: "Development" },
  { id: "staging", label: "Staging" },
  { id: "prod", label: "Production" },
]

type DeploymentSummary = {
  id: string
  name: string
  version: string
  status: "healthy" | "progressing" | "degraded"
}

type ResourceUsage = {
  cpuUsedMillicores: number
  cpuLimitMillicores: number
  memoryUsedMiB: number
  memoryLimitMiB: number
}

type PodHealth = {
  readyPods: number
  totalPods: number
  restartingPods: number
}

type RolloutEvent = {
  id: string
  version: string
  commitSha: string
  status: "succeeded" | "failed" | "rolled_back"
  message: string
  deployedAt: string
}

type DriftStatus = "synced" | "drifted" | "reconciling"

const MOCK_DEPLOYMENTS: Record<K8sEnvironmentId, DeploymentSummary[]> = {
  dev: [
    {
      id: "deploy-dev-api",
      name: "api-server",
      version: "v1.4.0",
      status: "healthy",
    },
    {
      id: "deploy-dev-worker",
      name: "worker",
      version: "v1.4.0",
      status: "healthy",
    },
  ],
  staging: [
    {
      id: "deploy-staging-api",
      name: "api-server",
      version: "v1.3.2",
      status: "healthy",
    },
  ],
  prod: [
    {
      id: "deploy-prod-api",
      name: "api-server",
      version: "v1.3.1",
      status: "healthy",
    },
    {
      id: "deploy-prod-worker",
      name: "worker",
      version: "v1.3.1",
      status: "progressing",
    },
  ],
}

const MOCK_RESOURCE_USAGE: Record<string, ResourceUsage> = {
  "deploy-dev-api": {
    cpuUsedMillicores: 120,
    cpuLimitMillicores: 500,
    memoryUsedMiB: 210,
    memoryLimitMiB: 512,
  },
  "deploy-dev-worker": {
    cpuUsedMillicores: 45,
    cpuLimitMillicores: 250,
    memoryUsedMiB: 98,
    memoryLimitMiB: 256,
  },
  "deploy-staging-api": {
    cpuUsedMillicores: 95,
    cpuLimitMillicores: 500,
    memoryUsedMiB: 180,
    memoryLimitMiB: 512,
  },
  "deploy-prod-api": {
    cpuUsedMillicores: 340,
    cpuLimitMillicores: 1000,
    memoryUsedMiB: 420,
    memoryLimitMiB: 1024,
  },
  "deploy-prod-worker": {
    cpuUsedMillicores: 180,
    cpuLimitMillicores: 500,
    memoryUsedMiB: 310,
    memoryLimitMiB: 512,
  },
}

const MOCK_POD_HEALTH: Record<string, PodHealth> = {
  "deploy-dev-api": { readyPods: 2, totalPods: 2, restartingPods: 0 },
  "deploy-dev-worker": { readyPods: 1, totalPods: 1, restartingPods: 0 },
  "deploy-staging-api": { readyPods: 2, totalPods: 2, restartingPods: 0 },
  "deploy-prod-api": { readyPods: 3, totalPods: 3, restartingPods: 0 },
  "deploy-prod-worker": { readyPods: 1, totalPods: 2, restartingPods: 1 },
}

const MOCK_DRIFT_STATUS: Record<K8sEnvironmentId, DriftStatus> = {
  dev: "synced",
  staging: "synced",
  prod: "drifted",
}

const MOCK_ROLLOUT_EVENTS: Record<K8sEnvironmentId, RolloutEvent[]> = {
  dev: [
    {
      id: "event-dev-1",
      version: "v1.4.0",
      commitSha: "abc1234",
      status: "succeeded",
      message: "Deployed latest feature branch",
      deployedAt: "2026-05-19T08:30:00Z",
    },
    {
      id: "event-dev-2",
      version: "v1.3.2",
      commitSha: "def5678",
      status: "succeeded",
      message: "Previous stable release",
      deployedAt: "2026-05-18T14:15:00Z",
    },
  ],
  staging: [
    {
      id: "event-staging-1",
      version: "v1.3.2",
      commitSha: "def5678",
      status: "succeeded",
      message: "Promoted from dev",
      deployedAt: "2026-05-18T16:00:00Z",
    },
  ],
  prod: [
    {
      id: "event-prod-1",
      version: "v1.3.1",
      commitSha: "ghi9012",
      status: "succeeded",
      message: "Stable release",
      deployedAt: "2026-05-17T10:00:00Z",
    },
    {
      id: "event-prod-2",
      version: "v1.3.0",
      commitSha: "jkl3456",
      status: "rolled_back",
      message: "Rolled back due to memory leak",
      deployedAt: "2026-05-16T09:30:00Z",
    },
    {
      id: "event-prod-3",
      version: "v1.2.9",
      commitSha: "mno7890",
      status: "failed",
      message: "OOM during startup",
      deployedAt: "2026-05-15T11:00:00Z",
    },
  ],
}

export default function ObservePage() {
  const [selectedEnvironmentId, setSelectedEnvironmentId] =
    useState<K8sEnvironmentId>("dev")
  const [selectedDeploymentId, setSelectedDeploymentId] = useState(
    MOCK_DEPLOYMENTS.dev[0]?.id ?? ""
  )
  const [eventFilter, setEventFilter] = useState<
    "all" | "succeeded" | "failed"
  >("all")

  const deployments = MOCK_DEPLOYMENTS[selectedEnvironmentId] ?? []
  const resourceUsage = MOCK_RESOURCE_USAGE[selectedDeploymentId] ?? null
  const podHealth = MOCK_POD_HEALTH[selectedDeploymentId] ?? null
  const driftStatus = MOCK_DRIFT_STATUS[selectedEnvironmentId] ?? "unknown"
  const rolloutEvents = MOCK_ROLLOUT_EVENTS[selectedEnvironmentId] ?? []

  const filteredEvents = useMemo(() => {
    if (eventFilter === "all") {
      return rolloutEvents
    }

    return rolloutEvents.filter((item) => item.status === eventFilter)
  }, [eventFilter, rolloutEvents])

  const cpuPercent = resourceUsage
    ? Math.round(
        (resourceUsage.cpuUsedMillicores / resourceUsage.cpuLimitMillicores) *
          100
      )
    : 0
  const memoryPercent = resourceUsage
    ? Math.round(
        (resourceUsage.memoryUsedMiB / resourceUsage.memoryLimitMiB) * 100
      )
    : 0

  const handleEnvironmentChange = (environmentId: K8sEnvironmentId) => {
    setSelectedEnvironmentId(environmentId)
    const firstDeployment = MOCK_DEPLOYMENTS[environmentId]?.[0]
    setSelectedDeploymentId(firstDeployment?.id ?? "")
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Observe</CardTitle>
          <CardDescription>
            Monitor runtime health, resources, and rollout events.
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
                  <p className="text-muted-foreground">Drift: {driftStatus}</p>
                </button>
              )
            })}
          </div>

          <div className="grid gap-2">
            {deployments.map((deployment) => {
              const isSelected = deployment.id === selectedDeploymentId

              return (
                <button
                  key={deployment.id}
                  type="button"
                  onClick={() => setSelectedDeploymentId(deployment.id)}
                  className={`rounded-md border p-2 text-left text-sm ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background"
                  }`}
                >
                  {deployment.name} &bull; {deployment.version} &bull;{" "}
                  {deployment.status}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Resource Usage</CardTitle>
            <CardDescription>
              CPU and memory usage versus limits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span>CPU</span>
                <span className="text-muted-foreground">
                  {resourceUsage?.cpuUsedMillicores ?? 0}m /{" "}
                  {resourceUsage?.cpuLimitMillicores ?? 0}m ({cpuPercent}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    cpuPercent > 80
                      ? "bg-destructive"
                      : cpuPercent > 60
                        ? "bg-yellow-500"
                        : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(cpuPercent, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span>Memory</span>
                <span className="text-muted-foreground">
                  {resourceUsage?.memoryUsedMiB ?? 0}Mi /{" "}
                  {resourceUsage?.memoryLimitMiB ?? 0}Mi ({memoryPercent}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    memoryPercent > 80
                      ? "bg-destructive"
                      : memoryPercent > 60
                        ? "bg-yellow-500"
                        : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(memoryPercent, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pod Health</CardTitle>
            <CardDescription>
              Ready pod count and restart signals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Ready</span>
              <span className="font-medium">
                {podHealth?.readyPods ?? 0}/{podHealth?.totalPods ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Restarting pods</span>
              <span
                className={`font-medium ${
                  (podHealth?.restartingPods ?? 0) > 0 ? "text-destructive" : ""
                }`}
              >
                {podHealth?.restartingPods ?? 0}
              </span>
            </div>
            {podHealth && podHealth.readyPods < podHealth.totalPods ? (
              <p className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-400">
                Some pods are not ready. Check logs for issues.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rollout Events</CardTitle>
          <CardDescription>
            Timeline of deploy, promote, and rollback actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Filter:</span>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={eventFilter}
              onChange={(event) =>
                setEventFilter(
                  event.target.value as "all" | "succeeded" | "failed"
                )
              }
            >
              <option value="all">All events</option>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
            </select>
          </label>

          <div className="space-y-2">
            {filteredEvents.length > 0 ? (
              filteredEvents.map((item) => (
                <div
                  key={item.id}
                  className="rounded border border-border p-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      {item.version} ({item.commitSha})
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.status === "succeeded"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : item.status === "failed"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{item.message}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No rollout events matched this filter.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
