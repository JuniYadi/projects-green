import { existsSync, readFileSync } from "node:fs"
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
import { logger } from "@/lib/logger"

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
  /**
   * Only the seeding/webhook path needs these; reading builds needs just
   * baseUrl/username/apiToken, so they must not make the whole config fail.
   */
  webhookToken: string | null
  dslOwner: string | null
  dslRepo: string | null
  gitCredentialId: string | null
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
  connectionMode: "INTERNAL" | "EXTERNAL"
  apiServerUrl: string | null
  caCertificate: string | null
  serviceAccountToken: string | null
  kubeconfig: string | null
  namespacePattern: string
  labelSelector: string
  /**
   * `true` when apiServerUrl/token came from the pod's own service account
   * rather than this cluster's row - the answers then describe the portal's
   * cluster, whichever cluster was asked for.
   */
  usesInClusterFallback: boolean
}

export type PrometheusClusterConfig = {
  endpoint: string
  username: string
  password: string
}

export type OpenSearchClusterConfig = {
  endpoint: string
  username: string
  password: string
  sslVerify: boolean
  timeout: number
}

export type ClusterIntegrationConfigMap = {
  JENKINS: JenkinsClusterConfig
  GITOPS: GitOpsClusterConfig
  REGISTRY: RegistryClusterConfig
  ARGOCD: ArgoCdClusterConfig
  KUBECONFIG: KubeconfigClusterConfig
  PROMETHEUS: PrometheusClusterConfig
  OPENSEARCH: OpenSearchClusterConfig
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

/**
 * A fixed mask, not a partial reveal: `ghp_`/`eyJh` prefixes name the
 * credential type on screen and tell an admin nothing they need.
 */
export function maskClusterIntegrationSecret(
  secrets: Record<string, unknown>
): string | null {
  for (const value of Object.values(secrets)) {
    if (typeof value !== "string" || value.length === 0) continue
    return "••••••••"
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
    webhookToken: readString(secrets, "webhookToken", false),
    dslOwner: readString(meta, "dslOwner", false),
    dslRepo: readString(meta, "dslRepo", false),
    gitCredentialId: readString(meta, "gitCredentialId", false),
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

function getInClusterServiceAccountCredentials(): {
  token: string | null
  ca: string | null
} {
  let token: string | null = null
  let ca: string | null = null
  try {
    if (existsSync("/var/run/secrets/kubernetes.io/serviceaccount/token")) {
      token = readFileSync(
        "/var/run/secrets/kubernetes.io/serviceaccount/token",
        "utf8"
      ).trim()
    }
  } catch {}
  try {
    if (existsSync("/var/run/secrets/kubernetes.io/serviceaccount/ca.crt")) {
      ca = readFileSync(
        "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt",
        "utf8"
      )
    }
  } catch {}
  return { token, ca }
}

function buildKubeconfigConfig(
  meta: Record<string, unknown>,
  secrets: Record<string, unknown>
): KubeconfigClusterConfig {
  const connectionMode =
    meta.connectionMode === "EXTERNAL" ? "EXTERNAL" : "INTERNAL"

  let apiServerUrl = readString(secrets, "apiServerUrl", false)
  let serviceAccountToken = readString(secrets, "serviceAccountToken", false)
  let caCertificate = readString(secrets, "caCertificate", false)
  let usesInClusterFallback = false

  if (connectionMode === "INTERNAL") {
    if (!apiServerUrl) {
      const host = process.env.KUBERNETES_SERVICE_HOST
      const port = process.env.KUBERNETES_SERVICE_PORT || "443"
      apiServerUrl = host
        ? `https://${host}:${port}`
        : "https://kubernetes.default.svc"
      usesInClusterFallback = true
    }
    if (!serviceAccountToken) {
      const inCluster = getInClusterServiceAccountCredentials()
      serviceAccountToken = inCluster.token
      usesInClusterFallback = true
      if (!caCertificate) {
        caCertificate = inCluster.ca
      }
    }
  }

  return {
    connectionMode,
    apiServerUrl,
    caCertificate,
    serviceAccountToken,
    kubeconfig: readString(secrets, "kubeconfig", false),
    namespacePattern: readString(meta, "namespacePattern", true),
    labelSelector: readString(meta, "labelSelector", true),
    usesInClusterFallback,
  }
}
function buildPrometheusConfig(
  meta: Record<string, unknown>,
  secrets: Record<string, unknown>
): PrometheusClusterConfig {
  return {
    endpoint: readString(meta, "endpoint", true),
    username: readString(secrets, "username", true),
    password: readString(secrets, "password", true),
  }
}
function buildOpenSearchConfig(
  meta: Record<string, unknown>,
  secrets: Record<string, unknown>
): OpenSearchClusterConfig {
  const endpoint =
    readString(meta, "endpoint", false) ?? readString(meta, "host", true)
  return {
    endpoint,
    username: readString(secrets, "username", true),
    password: readString(secrets, "password", true),
    sslVerify: meta.sslVerify !== false,
    timeout: typeof meta.timeout === "number" ? meta.timeout : 30,
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
    case "PROMETHEUS":
      return buildPrometheusConfig(
        meta,
        secrets
      ) as ClusterIntegrationConfigMap[T]
    case "OPENSEARCH":
      return buildOpenSearchConfig(
        meta,
        secrets
      ) as ClusterIntegrationConfigMap[T]
    default:
      throw new Error(`Unsupported cluster integration type: ${type}`)
  }
}

function mapClusterMetadata(metadataJson: unknown): {
  storageClass?: string
  nodeSelector?: Record<string, string>
  tolerations?: AppHostingClusterSummary["tolerations"]
} {
  const meta =
    metadataJson && typeof metadataJson === "object"
      ? (metadataJson as Record<string, unknown>)
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

  return { storageClass, nodeSelector, tolerations }
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
    const { storageClass, nodeSelector, tolerations } = mapClusterMetadata(
      cluster.metadataJson
    )
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
  const { storageClass, nodeSelector, tolerations } = mapClusterMetadata(
    cluster.metadataJson
  )
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

async function resolveClusterIntegrationForCluster<
  T extends keyof ClusterIntegrationConfigMap,
>(
  cluster: { id: string; code: string },
  type: T,
  vaultClient?: Pick<VaultClient, "readKV">
): Promise<ClusterIntegrationConfigMap[T]> {
  const client = vaultClient ?? getVaultClient()
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
    const vaultVersion =
      typeof meta.vaultVersion === "number" ? meta.vaultVersion : undefined
    try {
      const vaultData = await client.readKV(vaultPath, vaultVersion)
      if (vaultData && typeof vaultData === "object") {
        secrets = vaultData
      }
    } catch (vaultError) {
      logger.warn(
        {
          event: "CLUSTER_SECRET_VAULT_FALLBACK",
          clusterId: cluster.id,
          clusterCode: cluster.code,
          integrationType: type,
          vaultPath,
          vaultVersion,
          reason:
            vaultError instanceof Error
              ? vaultError.message
              : String(vaultError),
        },
        `[Vault] Failed to read cluster integration secrets from ${vaultPath}, falling back to DB`
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

export async function resolveClusterIntegration<
  T extends keyof ClusterIntegrationConfigMap,
>(
  stackId: string,
  type: T,
  vaultClient?: Pick<VaultClient, "readKV">
): Promise<ClusterIntegrationConfigMap[T]> {
  const cluster = await resolveAppHostingClusterForStack(stackId)
  return resolveClusterIntegrationForCluster(cluster, type, vaultClient)
}

export async function resolveClusterIntegrationByClusterCode<
  T extends keyof ClusterIntegrationConfigMap,
>(
  clusterCode: string,
  type: T,
  vaultClient?: Pick<VaultClient, "readKV">
): Promise<ClusterIntegrationConfigMap[T]> {
  const cluster =
    (await prisma.appHostingCluster.findUnique({
      where: { code: clusterCode },
    })) ??
    (await prisma.appHostingCluster.findUnique({
      where: { id: clusterCode },
    }))
  if (!cluster) {
    throw new Error(`App Hosting cluster not found: ${clusterCode}`)
  }
  return resolveClusterIntegrationForCluster(cluster, type, vaultClient)
}
