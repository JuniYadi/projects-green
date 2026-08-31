import {
  decrypt,
  deriveEncryptionKey,
  encrypt,
  parseEncryptedField,
  serializeEncryptedField,
} from "@/lib/encryption"
import { prisma } from "@/lib/prisma"
import { VaultClient } from "@/lib/vault/vault-client"
import { redis } from "@/lib/redis"

const CLUSTER_INTEGRATION_KEY_SALT = "app-hosting-cluster-integration"
const CLUSTER_INTEGRATION_KEY_INFO_PREFIX = "app-hosting-integration-v"

export const CLUSTER_CREDS_CACHE_TTL_SECS = 86400

export function getClusterCredsCacheKey(
  clusterId: string,
  type: string
): string {
  return `sec:cluster:creds:${clusterId}:${type}`
}

export async function getCachedClusterIntegrationSecrets(
  clusterId: string,
  type: string
): Promise<Record<string, unknown> | null> {
  try {
    const ciphertext = await redis.get(getClusterCredsCacheKey(clusterId, type))
    if (!ciphertext) return null
    return decryptClusterIntegrationSecrets(ciphertext)
  } catch {
    return null
  }
}

export async function setCachedClusterIntegrationSecrets(
  clusterId: string,
  type: string,
  secrets: Record<string, unknown>
): Promise<void> {
  const ciphertext = encryptClusterIntegrationSecrets(secrets)
  await redis.set(
    getClusterCredsCacheKey(clusterId, type),
    ciphertext,
    "EX",
    CLUSTER_CREDS_CACHE_TTL_SECS
  )
}

export async function invalidateClusterIntegrationCache(
  clusterId: string,
  type: string
): Promise<void> {
  await redis.del(getClusterCredsCacheKey(clusterId, type))
}

const getClusterIntegrationEncryptionKey = (keyVersion = 1): Buffer => {
  const secret = process.env.ENCRYPTION_KEY
  if (!secret) throw new Error("Missing ENCRYPTION_KEY env var")
  return deriveEncryptionKey({
    secret,
    salt: CLUSTER_INTEGRATION_KEY_SALT,
    info: `${CLUSTER_INTEGRATION_KEY_INFO_PREFIX}${keyVersion}`,
  })
}

export type AppHostingClusterSummary = {
  id: string
  code: string
  name: string
  region: string
  storageClass?: string
  nodeSelector?: Record<string, string>
  tolerations?: Array<{
    key: string
    operator?: string
    value?: string
    effect: string
    tolerationSeconds?: number
  }>
  managedBaseDomain?: string
}
export type JenkinsClusterConfig = {
  baseUrl: string
  username: string
  apiToken: string
  webhookToken: string
  dslOwner: string
  dslRepo: string
  gitCredentialId: string
  sharedLibraryName: string | null
  sharedLibraryBranch: string | null
}

export type GitOpsClusterConfig = {
  repo: string
  branch: string
  basePath: string
  pat: string
  authorName: string | null
  authorEmail: string | null
}

export type RegistryClusterConfig = {
  host: string
  namespace: string | null
  pushCredentialId: string | null
  pullSecretName: string | null
}

export type ArgoCdClusterConfig = {
  apiUrl: string
  token: string
  project: string
  appNamespace: string
  webhookSecret: string | null
  chartRepo: string | null
  chartVersion: string | null
}

export type KubeconfigClusterConfig = {
  apiServerUrl: string | null
  caCertificate: string | null
  serviceAccountToken: string | null
  kubeconfig: string | null
  namespacePattern: string
  labelSelector: string
}

export type ClusterIntegrationConfigMap = {
  JENKINS: JenkinsClusterConfig
  GITOPS: GitOpsClusterConfig
  REGISTRY: RegistryClusterConfig
  ARGOCD: ArgoCdClusterConfig
  KUBECONFIG: KubeconfigClusterConfig
}

export function encryptClusterIntegrationSecrets(
  secrets: Record<string, unknown>,
  keyVersion = 1
): string {
  const plaintext = JSON.stringify(secrets)
  const encrypted = encrypt(
    plaintext,
    getClusterIntegrationEncryptionKey(keyVersion)
  )
  return serializeEncryptedField(encrypted)
}

export function decryptClusterIntegrationSecrets(
  ciphertext: string | null,
  keyVersion = 1
): Record<string, unknown> {
  if (!ciphertext) return {}
  const parsed = parseEncryptedField(ciphertext)
  if (!parsed) throw new Error("Invalid cluster integration encrypted payload")
  const plaintext = decrypt(
    parsed,
    getClusterIntegrationEncryptionKey(keyVersion)
  )
  try {
    const result = JSON.parse(plaintext)
    if (result && typeof result === "object" && !Array.isArray(result)) {
      return result as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}

export function maskClusterIntegrationSecret(
  secrets: Record<string, unknown>
): string | null {
  for (const value of Object.values(secrets)) {
    if (typeof value !== "string" || value.length === 0) continue
    if (value.length <= 8) return `${value.slice(0, 1)}…`
    const prefix = value.slice(0, 4)
    const suffix = value.slice(-4)
    return `${prefix}…${suffix}`
  }
  return null
}

function readString(
  source: Record<string, unknown>,
  key: string,
  required: true
): string
function readString(
  source: Record<string, unknown>,
  key: string,
  required: false
): string | null
function readString(
  source: Record<string, unknown>,
  key: string,
  required: boolean
): string | null {
  const value = source[key]
  if (typeof value === "string" && value.length > 0) return value
  if (required) {
    throw new Error(`Missing required cluster integration field: ${key}`)
  }
  return null
}

function buildJenkinsConfig(
  meta: Record<string, unknown>,
  secrets: Record<string, unknown>
): JenkinsClusterConfig {
  return {
    baseUrl: readString(meta, "baseUrl", true),
    username: readString(secrets, "username", true),
    apiToken: readString(secrets, "apiToken", true),
    webhookToken: readString(secrets, "webhookToken", true),
    dslOwner: readString(meta, "dslOwner", true),
    dslRepo: readString(meta, "dslRepo", true),
    gitCredentialId: readString(meta, "gitCredentialId", true),
    sharedLibraryName: readString(meta, "sharedLibraryName", false),
    sharedLibraryBranch: readString(meta, "sharedLibraryBranch", false),
  }
}

function buildGitOpsConfig(
  meta: Record<string, unknown>,
  secrets: Record<string, unknown>
): GitOpsClusterConfig {
  return {
    repo: readString(meta, "repo", true),
    branch: readString(meta, "branch", true),
    basePath: readString(meta, "basePath", true),
    pat: readString(secrets, "pat", true),
    authorName: readString(meta, "authorName", false),
    authorEmail: readString(meta, "authorEmail", false),
  }
}

function buildRegistryConfig(
  meta: Record<string, unknown>,
  secrets: Record<string, unknown>
): RegistryClusterConfig {
  return {
    host: readString(meta, "host", true),
    namespace: readString(meta, "namespace", false),
    pushCredentialId: readString(secrets, "pushCredentialId", false),
    pullSecretName: readString(meta, "pullSecretName", false),
  }
}

function buildArgoCdConfig(
  meta: Record<string, unknown>,
  secrets: Record<string, unknown>
): ArgoCdClusterConfig {
  return {
    apiUrl: readString(meta, "apiUrl", true),
    token: readString(secrets, "token", true),
    project: readString(meta, "project", true),
    appNamespace: readString(meta, "appNamespace", true),
    webhookSecret: readString(secrets, "webhookSecret", false),
    chartRepo: readString(meta, "chartRepo", false),
    chartVersion: readString(meta, "chartVersion", false),
  }
}

function buildKubeconfigConfig(
  meta: Record<string, unknown>,
  secrets: Record<string, unknown>
): KubeconfigClusterConfig {
  return {
    apiServerUrl: readString(secrets, "apiServerUrl", false),
    caCertificate: readString(secrets, "caCertificate", false),
    serviceAccountToken: readString(secrets, "serviceAccountToken", false),
    kubeconfig: readString(secrets, "kubeconfig", false),
    namespacePattern: readString(meta, "namespacePattern", true),
    labelSelector: readString(meta, "labelSelector", true),
  }
}

function buildTypedConfig<T extends keyof ClusterIntegrationConfigMap>(
  type: T,
  meta: Record<string, unknown>,
  secrets: Record<string, unknown>
): ClusterIntegrationConfigMap[T] {
  switch (type) {
    case "JENKINS":
      return buildJenkinsConfig(meta, secrets) as ClusterIntegrationConfigMap[T]
    case "GITOPS":
      return buildGitOpsConfig(meta, secrets) as ClusterIntegrationConfigMap[T]
    case "REGISTRY":
      return buildRegistryConfig(
        meta,
        secrets
      ) as ClusterIntegrationConfigMap[T]
    case "ARGOCD":
      return buildArgoCdConfig(meta, secrets) as ClusterIntegrationConfigMap[T]
    case "KUBECONFIG":
      return buildKubeconfigConfig(
        meta,
        secrets
      ) as ClusterIntegrationConfigMap[T]
    default:
      throw new Error(`Unsupported cluster integration type: ${String(type)}`)
  }
}

export async function resolveAppHostingClusterForStack(
  stackId: string
): Promise<AppHostingClusterSummary> {
  const stack = await prisma.applicationStack.findUnique({
    where: { id: stackId },
    select: { clusterId: true },
  })
  if (!stack) {
    throw new Error(`Application stack not found: ${stackId}`)
  }
  if (stack.clusterId) {
    const cluster = await prisma.appHostingCluster.findUnique({
      where: { id: stack.clusterId },
      include: { region: true, endpoint: true },
    })
    if (!cluster) {
      throw new Error(`Referenced cluster ${stack.clusterId} not found`)
    }
    if (cluster.status !== "ACTIVE") {
      throw new Error("No active default App Hosting cluster configured")
    }
    const meta =
      cluster.metadataJson && typeof cluster.metadataJson === "object"
        ? (cluster.metadataJson as Record<string, unknown>)
        : {}
    const storageClass =
      typeof meta.storageClass === "string" &&
      meta.storageClass.trim().length > 0
        ? meta.storageClass.trim()
        : undefined
    const nodeSelector =
      meta.nodeSelector &&
      typeof meta.nodeSelector === "object" &&
      !Array.isArray(meta.nodeSelector)
        ? (meta.nodeSelector as Record<string, string>)
        : undefined
    const tolerations = Array.isArray(meta.tolerations)
      ? (meta.tolerations as AppHostingClusterSummary["tolerations"])
      : undefined

    return {
      id: cluster.id,
      code: cluster.code,
      name: cluster.name,
      region: cluster.region?.name ?? "Global",
      storageClass,
      nodeSelector,
      tolerations,
      managedBaseDomain: cluster.endpoint?.managedBaseDomain ?? undefined,
    }
  }

  const defaults = await prisma.appHostingCluster.findMany({
    where: { status: "ACTIVE", isDefault: true },
    include: { region: true, endpoint: true },
  })
  if (defaults.length === 0) {
    throw new Error("No active default App Hosting cluster configured")
  }
  if (defaults.length > 1) {
    throw new Error("Multiple active default App Hosting clusters configured")
  }
  const cluster = defaults[0]
  const meta =
    cluster.metadataJson && typeof cluster.metadataJson === "object"
      ? (cluster.metadataJson as Record<string, unknown>)
      : {}
  const storageClass =
    typeof meta.storageClass === "string" && meta.storageClass.trim().length > 0
      ? meta.storageClass.trim()
      : undefined
  const nodeSelector =
    meta.nodeSelector &&
    typeof meta.nodeSelector === "object" &&
    !Array.isArray(meta.nodeSelector)
      ? (meta.nodeSelector as Record<string, string>)
      : undefined
  const tolerations = Array.isArray(meta.tolerations)
    ? (meta.tolerations as AppHostingClusterSummary["tolerations"])
    : undefined

  return {
    id: cluster.id,
    code: cluster.code,
    name: cluster.name,
    region: cluster.region?.name ?? "Global",
    storageClass,
    nodeSelector,
    tolerations,
    managedBaseDomain: cluster.endpoint?.managedBaseDomain ?? undefined,
  }
}

export async function resolveDefaultAppHostingClusterId(): Promise<string> {
  const defaults = await prisma.appHostingCluster.findMany({
    where: { status: "ACTIVE", isDefault: true },
    select: { id: true },
  })
  if (defaults.length === 0) {
    throw new Error("No active default App Hosting cluster configured")
  }
  if (defaults.length > 1) {
    throw new Error("Multiple active default App Hosting clusters configured")
  }
  return defaults[0].id
}

const getVaultClient = (): Pick<VaultClient, "readKV"> => new VaultClient()

export async function resolveClusterIntegration<
  T extends keyof ClusterIntegrationConfigMap,
>(
  stackId: string,
  type: T,
  vaultClient?: Pick<VaultClient, "readKV">
): Promise<ClusterIntegrationConfigMap[T]> {
  const client = vaultClient ?? getVaultClient()
  const cluster = await resolveAppHostingClusterForStack(stackId)
  const integration = await prisma.appHostingClusterIntegration.findFirst({
    where: { clusterId: cluster.id, type, isActive: true },
  })
  if (!integration) {
    throw new Error(
      `Missing ${String(type)} integration for App Hosting cluster ${cluster.code}`
    )
  }
  const meta =
    integration.metaJson && typeof integration.metaJson === "object"
      ? (integration.metaJson as Record<string, unknown>)
      : {}

  const cachedSecrets = await getCachedClusterIntegrationSecrets(
    cluster.id,
    type
  )
  if (cachedSecrets) {
    return buildTypedConfig(type, meta, cachedSecrets)
  }

  let secrets: Record<string, unknown> = {}
  const vaultPath = typeof meta.vaultPath === "string" ? meta.vaultPath : null

  if (vaultPath) {
    try {
      const vaultVersion =
        typeof meta.vaultVersion === "number" ? meta.vaultVersion : undefined
      const vaultData = await client.readKV(vaultPath, vaultVersion)
      if (vaultData && typeof vaultData === "object") {
        secrets = vaultData
      }
    } catch (vaultError) {
      console.warn(
        `[Vault] Failed to read cluster integration secrets from ${vaultPath}, falling back to DB:`,
        vaultError
      )
    }
  }

  // Gracefully fallback to legacy DB decryption if secrets were not retrieved from Vault
  if (Object.keys(secrets).length === 0 && integration.secretCiphertext) {
    secrets = decryptClusterIntegrationSecrets(
      integration.secretCiphertext,
      integration.keyVersion
    )
  }
  if (Object.keys(secrets).length > 0) {
    await setCachedClusterIntegrationSecrets(cluster.id, type, secrets)
  }

  return buildTypedConfig(type, meta, secrets)
}
