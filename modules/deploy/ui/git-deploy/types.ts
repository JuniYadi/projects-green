export type GitDeployStep =
  "source" | "config" | "sizing" | "review" | "rollout"

export type GitAccessState =
  | "idle"
  | "inspecting"
  | "public"
  | "connected"
  | "required"
  | "denied"
  | "error"

export type ConnectedRepository = {
  id: string
  name: string
  fullName: string
  defaultBranch: string
  isPrivate: boolean
  htmlUrl: string
  updatedAt?: string
}

export type GitSourceConfig = {
  url: string
  branch: string
  rootDir: string
  repoName?: string
  isPrivate?: boolean
}

export type EnvVar = {
  id: string
  key: string
  value: string
  isSecret: boolean
}

export type GitBuildConfig = {
  framework: string
  frameworkVersion?: string
  runtime?: string
  confidence?: number
  buildCommand: string
  startCommand: string
  outputDir: string
  port: number
  useDockerfile: boolean
  dockerfilePath: string
  envVars: EnvVar[]
}

export type GitSizingConfig = {
  tier: "starter" | "standard" | "pro" | "payg"
  cpu: number
  memory: number
  hourlyRate: number
  subdomain: string
  customDomain?: string
}
