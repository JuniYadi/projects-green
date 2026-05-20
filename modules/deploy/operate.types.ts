export type K8sEnvironmentId = "dev" | "staging" | "prod"

export type K8sEnvironment = {
  id: K8sEnvironmentId
  label: string
  description: string
  color: string
}

export type AppStatusType = "healthy" | "degraded" | "inaccessible" | "deploying"

export type CustomDomain = {
  id: string
  domain: string
  isPrimary: boolean
  tlsStatus: "active" | "expired" | "pending"
  dnsStatus: "verified" | "unverified"
  expiresAt: string
}

export type EnvVar = {
  id: string
  key: string
  value: string
  isSecret: boolean
  updatedAt: string
}

export type VolumeMount = {
  id: string
  name: string
  mountPath: string
  sourceType: "secret" | "configmap"
  fileMode: string
  readOnly: boolean
  contentSummary: string
}

export type LogMessage = {
  timestamp: string
  level: "INFO" | "WARN" | "ERROR"
  source: string
  message: string
}
