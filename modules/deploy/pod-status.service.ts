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

type KubeEvent = {
  involvedObject?: { name?: string }
  message?: string
  lastTimestamp?: string
  eventTime?: string
}

type BunFetchInit = RequestInit & {
  tls?: { ca?: string[] }
}

const countReadyContainers = (
  pod: KubePod
): { readyContainers: number; totalContainers: number } => {
  const statuses = pod.status?.containerStatuses ?? []
  return {
    readyContainers: statuses.filter((s) => s.ready).length,
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

export const fetchKubeJson = async <T>(
  url: string,
  config: KubeconfigClusterConfig
): Promise<T | null> => {
  const init: BunFetchInit = {
    headers: {
      Authorization: `Bearer ${config.serviceAccountToken}`,
      Accept: "application/json",
    },
    ...(config.caCertificate ? { tls: { ca: [config.caCertificate] } } : {}),
  }
  const res = await fetch(url, init)
  if (!res.ok) return null
  return (await res.json()) as T
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
  const podsUrl = `${baseUrl}/api/v1/namespaces/${encodeURIComponent(
    namespace
  )}/pods?labelSelector=${encodeURIComponent(labelSelector)}`

  let body: { items?: KubePod[] } = { items: [] }
  try {
    const result = await fetchKubeJson<{ items?: KubePod[] }>(
      podsUrl,
      kubeConfig
    )
    if (!result) return []
    body = result
  } catch {
    return []
  }

  const pods = body.items ?? []
  const result: DeployPodDTO[] = []

  // Fetch all warning events for the namespace once
  const eventsUrl = `${baseUrl}/api/v1/namespaces/${encodeURIComponent(
    namespace
  )}/events?fieldSelector=${encodeURIComponent("type=Warning")}`
  let warningEvents: KubeEvent[] = []
  try {
    const eventBody = await fetchKubeJson<{ items?: KubeEvent[] }>(
      eventsUrl,
      kubeConfig
    )
    warningEvents = eventBody?.items ?? []
  } catch {
    // events API error → pods still returned with null warnings
  }

  // Group warnings by involvedObject.name
  const warningByPod = new Map<string, string | null>()
  const eventTime = (event: KubeEvent) =>
    Date.parse(event.lastTimestamp ?? event.eventTime ?? "") || 0
  for (const event of warningEvents) {
    const podName = event.involvedObject?.name
    if (!podName) continue
    const existing = warningByPod.get(podName)
    if (
      !existing ||
      eventTime(event) > eventTime(JSON.parse(existing) as KubeEvent)
    ) {
      warningByPod.set(podName, event.message ?? null)
    }
  }

  for (const pod of pods) {
    const counts = countReadyContainers(pod)
    const podName = pod.metadata?.name ?? ""
    result.push({
      name: podName,
      phase: pod.status?.phase ?? null,
      readyContainers: counts.readyContainers,
      totalContainers: counts.totalContainers,
      restartCount: sumRestartCount(pod),
      latestWarningEvent: warningByPod.get(podName) ?? null,
    })
  }
  return result
}
