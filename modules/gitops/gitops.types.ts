export interface KubernetesMetadata {
  name: string
  namespace?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  [key: string]: unknown
}

export interface KubernetesResource {
  apiVersion: string
  kind: string
  metadata: KubernetesMetadata
  spec: Record<string, unknown>
  [key: string]: unknown
}

export interface HelmChart {
  repoURL: string
  chart: string
  version: string
  values: Record<string, unknown>
}

export interface AppManifest {
  appName: string
  teamSlug: string
  namespace: string
  resources: KubernetesResource[]
  helm?: HelmChart
}
