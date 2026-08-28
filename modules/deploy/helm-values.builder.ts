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

export type HelmValuesProbe = {
  path?: string
  port?: number | string
  initialDelaySeconds?: number
  periodSeconds?: number
  timeoutSeconds?: number
  failureThreshold?: number
  successThreshold?: number
}

export type HelmValuesStorage = {
  enabled: boolean
  mountPath: string
  size?: string
  storageClass?: string
  accessMode?: string
}

export type HelmValuesHAProxyConfig = {
  rateLimit?: {
    enabled: boolean
    rpm?: number
    burst?: number
  }
  cors?: {
    enabled: boolean
    allowOrigin?: string
    allowMethods?: string
    allowHeaders?: string
    allowCredentials?: boolean
  }
  stickySession?: {
    enabled: boolean
    cookieName?: string
    strategy?: string
  }
  ipFilter?: {
    whitelist?: {
      enabled: boolean
      ips: string[]
    }
    blacklist?: {
      enabled: boolean
      ips: string[]
    }
  }
}

export type HelmValuesInput = {
  slug: string
  imageRepository: string
  imageTag: string
  env: Array<HelmValuesEnvEntry>
  deploymentType?: "deployment" | "statefulset"
  command?: string[]
  args?: string[]
  replicas?: number | null
  cpu?: number | null
  memory?: number | null
  containerPort?: number | null
  servicePort?: number | null
  domain?: string | null
  edge?: HelmValuesEdgePolicy | null
  externalSecretVaultPath?: string
  storage?: HelmValuesStorage | null
  livenessProbe?: HelmValuesProbe | null
  readinessProbe?: HelmValuesProbe | null
  startupProbe?: HelmValuesProbe | null
  haproxy?: HelmValuesHAProxyConfig | null
  reloader?: boolean
  runAsNonRoot?: boolean
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

  const port = input.containerPort ?? input.servicePort ?? 80

  const values: Record<string, unknown> = {
    app: { name: input.slug },
    image: {
      repository: input.imageRepository,
      tag: input.imageTag,
    },
    replicaCount: input.replicas ?? 1,
    deploymentType: input.deploymentType ?? "deployment",
    service: {
      enabled: true,
      type: "ClusterIP",
      port: input.servicePort ?? port,
      targetPort: input.containerPort ?? port,
    },
    containerPorts: [
      {
        containerPort: input.containerPort ?? port,
        name: "http",
      },
    ],
    resources: {
      requests: { cpu: `${cpu}m`, memory: `${memory}Mi` },
      limits: {
        cpu: `${Math.max(cpu, 1000)}m`,
        memory: `${Math.max(memory, 4096)}Mi`,
      },
    },
  }

  if (input.command && input.command.length > 0) {
    values.image = {
      ...(values.image as Record<string, unknown>),
      command: input.command,
    }
  }
  if (input.args && input.args.length > 0) {
    values.image = {
      ...(values.image as Record<string, unknown>),
      args: input.args,
    }
  }

  if (input.runAsNonRoot) {
    values.securityContext = {
      runAsNonRoot: true,
    }
  }

  if (input.reloader) {
    values.reloader = { enabled: true }
  }

  if (input.storage && input.storage.enabled) {
    values.simpleStorage = [
      {
        name: "data",
        mountPath: input.storage.mountPath,
        size: input.storage.size ?? "10Gi",
        accessMode: input.storage.accessMode ?? "ReadWriteOnce",
        ...(input.storage.storageClass
          ? { storageClassName: input.storage.storageClass }
          : {}),
      },
    ]
  }

  if (input.livenessProbe && input.livenessProbe.path) {
    values.livenessProbe = {
      httpGet: {
        path: input.livenessProbe.path,
        port: input.livenessProbe.port ?? "http",
      },
      initialDelaySeconds: input.livenessProbe.initialDelaySeconds ?? 30,
      periodSeconds: input.livenessProbe.periodSeconds ?? 10,
      timeoutSeconds: input.livenessProbe.timeoutSeconds ?? 5,
      failureThreshold: input.livenessProbe.failureThreshold ?? 3,
    }
  }

  if (input.readinessProbe && input.readinessProbe.path) {
    values.readinessProbe = {
      httpGet: {
        path: input.readinessProbe.path,
        port: input.readinessProbe.port ?? "http",
      },
      initialDelaySeconds: input.readinessProbe.initialDelaySeconds ?? 10,
      periodSeconds: input.readinessProbe.periodSeconds ?? 5,
      timeoutSeconds: input.readinessProbe.timeoutSeconds ?? 3,
      failureThreshold: input.readinessProbe.failureThreshold ?? 3,
    }
  }

  if (input.startupProbe && input.startupProbe.path) {
    values.startupProbe = {
      httpGet: {
        path: input.startupProbe.path,
        port: input.startupProbe.port ?? "http",
      },
      initialDelaySeconds: input.startupProbe.initialDelaySeconds ?? 10,
      periodSeconds: input.startupProbe.periodSeconds ?? 5,
      timeoutSeconds: input.startupProbe.timeoutSeconds ?? 3,
      failureThreshold: input.startupProbe.failureThreshold ?? 30,
    }
  }

  if (Object.keys(plainEnv).length > 0) values.env = plainEnv
  if (input.externalSecretVaultPath) {
    values.externalSecret = {
      enabled: true,
      vaultPath: input.externalSecretVaultPath,
      targetSecretName: `app-${input.slug}-k8s-secrets`,
    }
  } else if (Object.keys(secretEnv).length > 0) {
    values.secrets = secretEnv
  }

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

    const haproxyConfig: Record<string, unknown> = {}
    if (input.haproxy?.rateLimit?.enabled) {
      haproxyConfig.security = {
        rateLimit: {
          enabled: true,
          rpm: input.haproxy.rateLimit.rpm ?? 1000,
          burst: input.haproxy.rateLimit.burst ?? 100,
        },
      }
    }

    if (input.haproxy?.cors?.enabled) {
      haproxyConfig.cors = {
        enabled: true,
        allowOrigin: input.haproxy.cors.allowOrigin ?? "*",
        allowMethods:
          input.haproxy.cors.allowMethods ?? "GET, POST, PUT, DELETE, OPTIONS",
        allowHeaders:
          input.haproxy.cors.allowHeaders ??
          "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization",
        allowCredentials: input.haproxy.cors.allowCredentials ?? true,
      }
    }

    if (input.haproxy?.stickySession?.enabled) {
      haproxyConfig.stickySession = {
        enabled: true,
        cookieName: input.haproxy.stickySession.cookieName ?? "JSESSIONID",
        strategy: input.haproxy.stickySession.strategy ?? "insert",
      }
    }

    if (Object.keys(haproxyConfig).length > 0) {
      ingress.haproxy = haproxyConfig
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
