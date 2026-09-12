export type TerminalTargetDTO = {
  // Opaque id for the client. The gateway re-validates it against the app's
  // label selector on every connect, so it is never trusted as-is.
  pod: string
  label: string
  ready: boolean
  containers: string[]
  defaultContainer: string
}

export type KubeExecPod = {
  metadata?: {
    name?: string
    creationTimestamp?: string
    deletionTimestamp?: string
    annotations?: Record<string, string>
  }
  spec?: { containers?: Array<{ name?: string }> }
  status?: {
    phase?: string
    conditions?: Array<{ type?: string; status?: string }>
  }
}

const DEFAULT_CONTAINER_ANNOTATION = "kubectl.kubernetes.io/default-container"

export const toTerminalTargetDTO = (
  pod: KubeExecPod,
  index: number
): TerminalTargetDTO => {
  const containers = (pod.spec?.containers ?? [])
    .map((container) => container.name)
    .filter((name): name is string => Boolean(name))
  const annotated = pod.metadata?.annotations?.[DEFAULT_CONTAINER_ANNOTATION]

  return {
    pod: pod.metadata?.name ?? "",
    label: `Replica ${index + 1}`,
    ready:
      pod.status?.conditions?.some(
        (condition) => condition.type === "Ready" && condition.status === "True"
      ) ?? false,
    containers,
    defaultContainer:
      annotated && containers.includes(annotated)
        ? annotated
        : (containers[0] ?? ""),
  }
}
