import { existsSync, readFileSync } from "node:fs"
import { resolveClusterIntegration } from "@/modules/deploy/cluster-integration.service"
import {
  toTerminalTargetDTO,
  type KubeExecPod,
  type TerminalTargetDTO,
} from "@/modules/deploy/terminal-target.dto"

export type KubeExecChannel = 0 | 1 | 2 | 3 | 4

export const KUBE_EXEC_CHANNELS = {
  STDIN: 0,
  STDOUT: 1,
  STDERR: 2,
  ERROR: 3,
  RESIZE: 4,
} as const

export function buildKubeExecUrl(
  apiServerUrl: string,
  namespace: string,
  podName: string,
  containerName?: string,
  command = ["/bin/sh"]
): string {
  const base = apiServerUrl.replace(/^http/, "ws").replace(/\/+$/, "")
  const params = new URLSearchParams()
  params.set("stdin", "true")
  params.set("stdout", "true")
  params.set("stderr", "true")
  params.set("tty", "true")

  if (containerName) {
    params.set("container", containerName)
  }

  for (const cmd of command) {
    params.append("command", cmd)
  }

  return `${base}/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(podName)}/exec?${params.toString()}`
}

export function encodeKubeFrame(
  channel: KubeExecChannel,
  data: string | Uint8Array
): Uint8Array {
  const payload =
    typeof data === "string" ? new TextEncoder().encode(data) : data
  const frame = new Uint8Array(payload.length + 1)
  frame[0] = channel
  frame.set(payload, 1)
  return frame
}

export function encodeResizeFrame(cols: number, rows: number): Uint8Array {
  const json = JSON.stringify({ Width: cols, Height: rows })
  return encodeKubeFrame(KUBE_EXEC_CHANNELS.RESIZE, json)
}

export function decodeKubeFrame(buffer: ArrayBuffer | Uint8Array): {
  channel: number
  data: string
} {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  if (bytes.length === 0) {
    return { channel: 0, data: "" }
  }
  const channel = bytes[0]
  const data = new TextDecoder().decode(bytes.subarray(1))
  return { channel, data }
}

export async function resolveStackExecCredentials(stackId: string): Promise<{
  url: string
  token: string
  caCert?: string
}> {
  const kubeConfig = await resolveClusterIntegration(stackId, "KUBECONFIG")

  let apiServerUrl = kubeConfig.apiServerUrl
  let token = kubeConfig.serviceAccountToken
  let caCert = kubeConfig.caCertificate ?? undefined

  if (kubeConfig.connectionMode === "INTERNAL" || !apiServerUrl || !token) {
    if (!apiServerUrl) {
      const host = process.env.KUBERNETES_SERVICE_HOST
      const port = process.env.KUBERNETES_SERVICE_PORT || "443"
      apiServerUrl = host
        ? `https://${host}:${port}`
        : "https://kubernetes.default.svc"
    }

    if (!token) {
      try {
        if (existsSync("/var/run/secrets/kubernetes.io/serviceaccount/token")) {
          token = readFileSync(
            "/var/run/secrets/kubernetes.io/serviceaccount/token",
            "utf8"
          ).trim()
        }
      } catch {}
    }

    if (!caCert) {
      try {
        if (
          existsSync("/var/run/secrets/kubernetes.io/serviceaccount/ca.crt")
        ) {
          caCert = readFileSync(
            "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt",
            "utf8"
          )
        }
      } catch {}
    }
  }

  if (!token) {
    throw new Error(
      "No Kubernetes service account token available for pod execution"
    )
  }

  return {
    url: apiServerUrl ?? "https://kubernetes.default.svc",
    token,
    caCert,
  }
}

export type StackExecCredentials = Awaited<
  ReturnType<typeof resolveStackExecCredentials>
>

type BunFetchInit = RequestInit & { tls?: { ca?: string[] } }

// The `deploy` chart labels pods with app.kubernetes.io/instance=<release>,
// and the ArgoCD release name is the stack slug (unique per org), so this
// selector never matches a sibling app that merely shares a name prefix.
export async function listStackExecTargets({
  namespace,
  slug,
  creds,
}: {
  namespace: string
  slug: string
  creds: StackExecCredentials
}): Promise<TerminalTargetDTO[]> {
  const selector = encodeURIComponent(`app.kubernetes.io/instance=${slug}`)
  const url = `${creds.url.replace(/\/+$/, "")}/api/v1/namespaces/${encodeURIComponent(namespace)}/pods?labelSelector=${selector}`
  const init: BunFetchInit = {
    headers: {
      Authorization: `Bearer ${creds.token}`,
      Accept: "application/json",
    },
    ...(creds.caCert ? { tls: { ca: [creds.caCert] } } : {}),
  }
  const res = await fetch(url, init)
  if (!res.ok) {
    throw new Error(`Failed to list app pods (HTTP ${res.status})`)
  }
  const body = (await res.json()) as { items?: KubeExecPod[] }

  return (body.items ?? [])
    .filter(
      (pod) =>
        pod.metadata?.name &&
        pod.status?.phase === "Running" &&
        !pod.metadata.deletionTimestamp
    )
    .sort(
      (a, b) =>
        (a.metadata?.creationTimestamp ?? "").localeCompare(
          b.metadata?.creationTimestamp ?? ""
        ) || (a.metadata?.name ?? "").localeCompare(b.metadata?.name ?? "")
    )
    .map(toTerminalTargetDTO)
}

export type ExecTargetSelection = { pod: string; container: string }

export function pickExecTarget(
  targets: TerminalTargetDTO[],
  pod?: string,
  container?: string
): ExecTargetSelection | { error: string } {
  const target = pod
    ? targets.find((candidate) => candidate.pod === pod)
    : (targets.find((candidate) => candidate.ready) ?? targets[0])
  if (!target) {
    return { error: pod ? "Pod is not part of this app" : "No running pod" }
  }
  if (container && !target.containers.includes(container)) {
    return { error: "Container is not part of this pod" }
  }
  return { pod: target.pod, container: container ?? target.defaultContainer }
}
