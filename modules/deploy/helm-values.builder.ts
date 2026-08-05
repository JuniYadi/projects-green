export type HelmValuesEnvEntry = {
  key: string
  value: string
  type?: string
  scope?: string
}

export type HelmValuesEdgePolicy = {
  domain: string
  certificateSource: "MANAGED" | "UPLOADED"
  certificateStatus?: string
  certificateSecretName?: string | null
  allowlistMode?: "OPEN" | "ALLOWLIST_ONLY"
  enabledCidrs?: string[]
}

export type HelmValuesInput = {
  slug: string
  imageRepository: string
  imageTag: string
  env: Array<HelmValuesEnvEntry>
  replicas?: number | null
  cpu?: number | null
  memory?: number | null
  domain?: string | null
  edge?: HelmValuesEdgePolicy | null
}

const omitUndefined = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as T

export function buildHelmValues(
  input: HelmValuesInput
): Record<string, unknown> {
  const plainEnv: Record<string, string> = {}
  const secretEnv: Record<string, string> = {}

  for (const e of input.env) {
    if (e.type === "secret") {
      secretEnv[e.key] = e.value
    } else {
      plainEnv[e.key] = e.value
    }
  }

  const cpu = input.cpu ?? 500
  const memory = input.memory ?? 1024

  const values: Record<string, unknown> = {
    app: { name: input.slug },
    image: {
      repository: input.imageRepository,
      tag: input.imageTag,
    },
    replicaCount: input.replicas ?? 1,
    resources: {
      requests: { cpu: `${cpu}m`, memory: `${memory}Mi` },
      limits: {
        cpu: `${Math.max(cpu, 1000)}m`,
        memory: `${Math.max(memory, 4096)}Mi`,
      },
    },
  }

  if (Object.keys(plainEnv).length > 0) values.env = plainEnv
  if (Object.keys(secretEnv).length > 0) values.secrets = secretEnv

  const edge = input.edge
  const ingressDomain = edge?.domain || input.domain

  if (ingressDomain) {
    const ingress: Record<string, unknown> = {
      enabled: true,
      domain: ingressDomain,
      tls: true,
      className: "haproxy",
    }

    if (
      edge?.certificateSource === "UPLOADED" &&
      edge.certificateStatus === "ACTIVE"
    ) {
      if (edge.certificateSecretName) {
        ingress.tlsSecretName = edge.certificateSecretName
      }
    } else if (edge?.certificateSource === "MANAGED" || !edge) {
      ingress.certManager = { enabled: true, issuer: "production" }
    }

    if (
      edge?.allowlistMode === "ALLOWLIST_ONLY" &&
      edge.enabledCidrs &&
      edge.enabledCidrs.length > 0
    ) {
      ingress.annotations = {
        "haproxy-ingress.github.io/whitelist-source-range":
          edge.enabledCidrs.join(","),
      }
    }

    values.simpleIngress = [ingress]
  }

  return omitUndefined(values)
}
