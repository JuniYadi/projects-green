import { prisma } from "@/lib/prisma"
import {
  resolveClusterIntegration,
  type KubeconfigClusterConfig,
} from "./cluster-integration.service"

export type DeployPodDTO = {
  name: string
  phase: string | null
  readyContainers: number
  totalContainers: number
  restartCount: number
  latestWarningEvent: string | null
}

type KubePod = {
  metadata?: { name?: string }
  status?: {
    phase?: string
    containerStatuses?: Array<{
      ready?: boolean
      restartCount?: number
    }>
  }
}

const countReadyContainers = (
  pod: KubePod
): { readyContainers: number; totalContainers: number } => {
  const statuses = pod.status?.containerStatuses ?? []
  return {
    readyContainers: statuses.filter((s) => s.ready === true).length,
    totalContainers: statuses.length,
  }
}

const sumRestartCount = (pod: KubePod): number => {
  const statuses = pod.status?.containerStatuses ?? []
  return statuses.reduce(
    (sum, s) => sum + (typeof s.restartCount === "number" ? s.restartCount : 0),
    0
  )
}

const fetchWarningEvents = async (
  config: KubeconfigClusterConfig,
  namespace: string,
  podName: string
): Promise<string | null> => {
  if (!config.apiServerUrl || !config.serviceAccountToken) return null
  const baseUrl = config.apiServerUrl.replace(/\/$/, "")
  const url = `${baseUrl}/api/v1/namespaces/${encodeURIComponent(
    namespace
  )}/events?fieldSelector=${encodeURIComponent(
    `involvedObject.name=${podName},type=Warning`
  )}`
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.serviceAccountToken}`,
        Accept: "application/json",
      },
    })
    if (!res.ok) return null
    const body = (await res.json()) as {
      items?: Array<{
        type?: string
        message?: string
        lastTimestamp?: string
      }>
    }
    const items = body.items ?? []
    items.sort((a, b) =>
      (b.lastTimestamp ?? "").localeCompare(a.lastTimestamp ?? "")
    )
    const latest = items[0]
    return latest?.message ?? null
  } catch {
    return null
  }
}

export async function getDeploymentPods(
  deploymentId: string
): Promise<DeployPodDTO[]> {
  const deployment = await prisma.applicationDeployment.findUnique({
    where: { id: deploymentId },
    include: { stack: true },
  })
  if (!deployment) {
    throw new Error("Deployment not found")
  }

  let kubeConfig: KubeconfigClusterConfig
  try {
    kubeConfig = await resolveClusterIntegration(
      deployment.stackId,
      "KUBECONFIG"
    )
  } catch {
    return []
  }

  if (!kubeConfig.apiServerUrl || !kubeConfig.serviceAccountToken) {
    return []
  }

  const namespace = kubeConfig.namespacePattern.replace(
    "{slug}",
    deployment.stack.slug
  )
  const labelSelector = kubeConfig.labelSelector.replace(
    "{slug}",
    deployment.stack.slug
  )

  const baseUrl = kubeConfig.apiServerUrl.replace(/\/$/, "")
  const url = `${baseUrl}/api/v1/namespaces/${encodeURIComponent(
    namespace
  )}/pods?labelSelector=${encodeURIComponent(labelSelector)}`

  let body: { items?: KubePod[] }
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${kubeConfig.serviceAccountToken}`,
        Accept: "application/json",
      },
    })
    if (!res.ok) return []
    body = (await res.json()) as { items?: KubePod[] }
  } catch {
    return []
  }

  const pods = body.items ?? []
  const result: DeployPodDTO[] = []
  for (const pod of pods) {
    const counts = countReadyContainers(pod)
    const warningEvent = await fetchWarningEvents(
      kubeConfig,
      namespace,
      pod.metadata?.name ?? ""
    )
    result.push({
      name: pod.metadata?.name ?? "",
      phase: pod.status?.phase ?? null,
      readyContainers: counts.readyContainers,
      totalContainers: counts.totalContainers,
      restartCount: sumRestartCount(pod),
      latestWarningEvent: warningEvent,
    })
  }
  return result
}
