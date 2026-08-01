import { z } from "zod"

// ── Integration Type Registry ──────────────────────────

export const INTEGRATION_TYPES = [
  "JENKINS",
  "GITOPS",
  "REGISTRY",
  "ARGOCD",
  "KUBECONFIG",
  "OPENSEARCH",
  "PROMETHEUS",
] as const

export type IntegrationType = (typeof INTEGRATION_TYPES)[number]

export const INTEGRATION_TYPE_LABELS: Record<string, string> = {
  JENKINS: "Jenkins",
  GITOPS: "GitOps",
  REGISTRY: "Registry",
  ARGOCD: "Argo CD",
  KUBECONFIG: "Kubeconfig",
  OPENSEARCH: "OpenSearch",
  PROMETHEUS: "Prometheus",
}

// ── Cluster Metadata Schema ────────────────────────────

export const clusterMetadataSchema = z.strictObject({
  kubernetesVersion: z.string().trim().min(1).optional(),
  nodePoolName: z.string().trim().min(1).optional(),
  nodePoolInstanceType: z.string().trim().min(1).optional(),
  nodeCount: z.number().int().positive().optional(),
  notes: z.string().trim().optional(),
  namespacePattern: z.string().trim().min(1).optional(),
  labelSelector: z.string().trim().min(1).optional(),
})

export type ClusterMetadataInput = z.infer<typeof clusterMetadataSchema>

// ── Per-Type Metadata Schemas ──────────────────────────

export const jenkinsMetadataSchema = z.strictObject({
  baseUrl: z.url("Jenkins URL must be valid."),
  dslOwner: z.string().trim().min(1, "DSL owner is required."),
  dslRepo: z.string().trim().min(1, "DSL repository is required."),
  gitCredentialId: z
    .string()
    .trim()
    .min(1, "Jenkins Git credential ID is required."),
  sharedLibraryName: z.string().trim().min(1).optional(),
  sharedLibraryBranch: z.string().trim().min(1).optional(),
})
export const gitopsMetadataSchema = z.strictObject({
  repo: z
    .string()
    .trim()
    .regex(/^[^/\s]+\/[^/\s]+$/, "Repository must use owner/repository."),
  branch: z.string().trim().min(1, "Branch is required."),
  basePath: z
    .string()
    .trim()
    .min(1, "Base path is required.")
    .refine(
      (value) => value.includes("{slug}"),
      "Base path must contain {slug}."
    ),
  authorName: z.string().trim().min(1).optional(),
  authorEmail: z.email("Author email must be valid.").optional(),
})
export const registryMetadataSchema = z.strictObject({
  host: z.string().trim().min(1, "Registry host is required."),
  namespace: z.string().trim().min(1).optional(),
  pullSecretName: z.string().trim().min(1).optional(),
})
export const argocdMetadataSchema = z.strictObject({
  apiUrl: z.url("Argo CD URL must be valid."),
  project: z.string().trim().min(1, "Project is required."),
  appNamespace: z.string().trim().min(1, "Application namespace is required."),
  chartRepo: z.string().trim().min(1).optional(),
  chartVersion: z.string().trim().min(1).optional(),
})
export const kubeconfigMetadataSchema = z.strictObject({
  namespacePattern: z
    .string()
    .trim()
    .min(1, "Namespace pattern is required.")
    .refine(
      (value) => value.includes("{slug}"),
      "Namespace pattern must contain {slug}."
    ),
  labelSelector: z
    .string()
    .trim()
    .min(1, "Label selector is required.")
    .refine(
      (value) => value.includes("{slug}"),
      "Label selector must contain {slug}."
    ),
})
export const opensearchMetadataSchema = z.strictObject({
  host: z.string().trim().min(1, "OpenSearch host is required."),
  sslVerify: z.boolean().default(true),
  timeout: z.number().int().positive().default(30),
})

export const prometheusMetadataSchema = z.strictObject({
  endpoint: z.url("Prometheus endpoint must be valid."),
})

// ── Per-Type Secret Schemas (full) ─────────────────────

export const jenkinsSecretsSchema = z.strictObject({
  username: z.string().trim().min(1, "Jenkins username is required."),
  apiToken: z.string().trim().min(1, "Jenkins API token is required."),
  webhookToken: z.string().trim().min(1, "Jenkins webhook token is required."),
})

export const gitopsSecretsSchema = z.strictObject({
  pat: z.string().trim().min(1, "GitOps PAT is required."),
})

export const registrySecretsSchema = z
  .object({
    pushCredentialId: z.string().optional(),
  })
  .strict()

export const argocdSecretsSchema = z.strictObject({
  token: z.string().trim().min(1, "Argo CD token is required."),
  webhookSecret: z.string().trim().min(1).optional(),
})

export const kubeconfigSecretsSchema = z
  .object({
    serviceAccountToken: z.string().optional(),
    apiServerUrl: z.string().optional(),
    caCertificate: z.string().optional(),
    kubeconfig: z.string().optional(),
  })
  .strict()

export const opensearchSecretsSchema = z.strictObject({
  username: z.string().trim().min(1, "OpenSearch username is required."),
  password: z.string().trim().min(1, "OpenSearch password is required."),
})

export const prometheusSecretsSchema = z.strictObject({
  username: z.string().trim().min(1, "Prometheus username is required."),
  password: z.string().trim().min(1, "Prometheus password is required."),
})

// ── Partial Secret Patch Schemas ───────────────────────

export const jenkinsSecretsPatchSchema = jenkinsSecretsSchema.partial()
export const gitopsSecretsPatchSchema = gitopsSecretsSchema.partial()
export const registrySecretsPatchSchema = registrySecretsSchema.partial()
export const argocdSecretsPatchSchema = argocdSecretsSchema.partial()
export const kubeconfigSecretsPatchSchema = kubeconfigSecretsSchema.partial()
export const opensearchSecretsPatchSchema = opensearchSecretsSchema.partial()
export const prometheusSecretsPatchSchema = prometheusSecretsSchema.partial()

export const integrationMetaJsonSchemas = {
  JENKINS: jenkinsMetadataSchema,
  GITOPS: gitopsMetadataSchema,
  REGISTRY: registryMetadataSchema,
  ARGOCD: argocdMetadataSchema,
  KUBECONFIG: kubeconfigMetadataSchema,
  OPENSEARCH: opensearchMetadataSchema,
  PROMETHEUS: prometheusMetadataSchema,
} as const

export const integrationSecretSchemas = {
  JENKINS: jenkinsSecretsSchema,
  GITOPS: gitopsSecretsSchema,
  REGISTRY: registrySecretsSchema,
  ARGOCD: argocdSecretsSchema,
  KUBECONFIG: kubeconfigSecretsSchema,
  OPENSEARCH: opensearchSecretsSchema,
  PROMETHEUS: prometheusSecretsSchema,
} as const

export const integrationSecretPatchSchemas = {
  JENKINS: jenkinsSecretsPatchSchema,
  GITOPS: gitopsSecretsPatchSchema,
  REGISTRY: registrySecretsPatchSchema,
  ARGOCD: argocdSecretsPatchSchema,
  KUBECONFIG: kubeconfigSecretsPatchSchema,
  OPENSEARCH: opensearchSecretsPatchSchema,
  PROMETHEUS: prometheusSecretsPatchSchema,
} as const

// ── Field Labels & Descriptions ────────────────────────

export const integrationFieldLabels: Record<string, Record<string, string>> = {
  JENKINS: {
    baseUrl: "Jenkins URL",
    dslOwner: "DSL Owner",
    dslRepo: "DSL Repository",
    gitCredentialId: "Jenkins Git Credential ID",
    sharedLibraryName: "Shared Library Name",
    sharedLibraryBranch: "Shared Library Branch",
    username: "Username",
    apiToken: "API Token",
    webhookToken: "Webhook Token",
  },
  GITOPS: {
    repo: "Repository",
    branch: "Branch",
    basePath: "Base Path",
    authorName: "Author Name",
    authorEmail: "Author Email",
    pat: "Personal Access Token",
  },
  REGISTRY: {
    host: "Registry Host",
    namespace: "Namespace",
    pullSecretName: "Pull Secret Name",
    pushCredentialId: "Push Credential ID",
  },
  ARGOCD: {
    apiUrl: "API URL",
    project: "Project",
    appNamespace: "App Namespace",
    chartRepo: "Chart Repository",
    chartVersion: "Chart Version",
    token: "Authentication Token",
    webhookSecret: "Webhook Secret",
  },
  KUBECONFIG: {
    namespacePattern: "Namespace Pattern",
    labelSelector: "Label Selector",
    serviceAccountToken: "Service Account Token",
    apiServerUrl: "API Server URL",
    caCertificate: "CA Certificate",
    kubeconfig: "Kubeconfig",
  },
  OPENSEARCH: {
    host: "Host URL",
    sslVerify: "Verify SSL",
    timeout: "Timeout (seconds)",
    username: "Username",
    password: "Password",
  },
  PROMETHEUS: {
    endpoint: "Endpoint URL",
    username: "Username",
    password: "Password",
  },
}

export const integrationFieldDescriptions: Record<
  string,
  Record<string, string>
> = {
  JENKINS: {
    baseUrl: "URL of the Jenkins server (e.g. https://jenkins.example.com)",
    dslOwner: "GitHub owner for the shared library DSL repository",
    dslRepo: "Name of the shared library DSL repository",
    gitCredentialId:
      "ID of a GitHub credential already stored inside Jenkins; not the PAT value.",
    sharedLibraryName: "Optional name of the shared library",
    sharedLibraryBranch: "Optional branch of the shared library",
    username: "Jenkins user username for API authentication",
    apiToken: "Jenkins API token for authentication",
    webhookToken: "Token used to validate Jenkins webhook requests",
  },
  GITOPS: {
    repo: "Git repository containing deployment manifests",
    branch: "Branch to sync from",
    basePath: "Base path within the repository for manifests",
    authorName: "Optional Git author name for commits",
    authorEmail: "Optional Git author email for commits",
    pat: "Personal Access Token for repository access",
  },
  REGISTRY: {
    host: "Container registry hostname",
    namespace: "Optional namespace within the registry",
    pullSecretName: "Optional Kubernetes secret name for pull credentials",
    pushCredentialId: "Optional credential ID for push access",
  },
  ARGOCD: {
    apiUrl: "ArgoCD API server URL",
    project: "ArgoCD project name",
    appNamespace: "Kubernetes namespace for ArgoCD applications",
    chartRepo: "Optional Helm chart repository name",
    chartVersion: "Optional Helm chart version",
    token: "ArgoCD authentication token",
    webhookSecret: "Optional secret for webhook validation",
  },
  KUBECONFIG: {
    namespacePattern: "Kubernetes namespace pattern using {slug} placeholder",
    labelSelector: "Label selector using {slug} placeholder",
    serviceAccountToken: "Service account token for cluster auth",
    apiServerUrl: "Optional API server URL for raw kubeconfig mode",
    caCertificate: "Optional CA certificate for raw kubeconfig mode",
    kubeconfig: "Raw kubeconfig YAML for direct cluster access",
  },
  OPENSEARCH: {
    host: "OpenSearch cluster host URL",
    sslVerify: "Whether to verify SSL certificates",
    timeout: "Request timeout in seconds",
    username: "Basic auth username",
    password: "Basic auth password",
  },
  PROMETHEUS: {
    endpoint: "Prometheus endpoint URL for form configuration",
    username: "Basic auth username",
    password: "Basic auth password",
  },
}

// ── Form State to Payload Helper ───────────────────────

export function formStateToPayload(formState: Record<string, unknown>): {
  metaJson: Record<string, unknown>
  secrets?: Record<string, unknown>
} {
  const metaJson: Record<string, unknown> = {}
  const secrets: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(formState)) {
    if (value === undefined || value === null || value === "") {
      continue
    }
    if (key.startsWith("secret_")) {
      secrets[key.slice(7)] = value
    } else {
      metaJson[key] = value
    }
  }

  return { metaJson, ...(Object.keys(secrets).length > 0 && { secrets }) }
}
