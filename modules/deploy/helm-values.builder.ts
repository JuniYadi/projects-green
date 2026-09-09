import { buildHelmApplicationManifest } from "./gitops-manifest.builder"
import * as jsYaml from "js-yaml"

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
  name?: string
  mountPath?: string
  path?: string
  size?: string
  storageClass?: string
  accessMode?: string
  fsGroup?: number | null
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
  additionalContainerPorts?: Array<{ port: number; name: string }>
  servicePort?: number | null
  domain?: string | null
  edge?: HelmValuesEdgePolicy | null
  externalSecretVaultPath?: string
  storage?: HelmValuesStorage | null
  livenessProbe?: HelmValuesProbe | null
  readinessProbe?: HelmValuesProbe | null
  startupProbe?: HelmValuesProbe | null
  haproxy?: HelmValuesHAProxyConfig | null
  nodeSelector?: Record<string, string> | null
  tolerations?: Array<{
    key: string
    operator?: string
    value?: string
    effect: string
    tolerationSeconds?: number
  }> | null
  reloader?: boolean
  logging?: boolean
  podAnnotations?: Record<string, string> | null
  runAsNonRoot?: boolean
  fsGroup?: number | null
  podSecurityContext?: Record<string, unknown> | null
}
const omitUndefined = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as T

export class HelmValuesBuilder {
  private values: Record<string, unknown> = {}

  app(params: { name: string; version?: string } | string): this {
    if (typeof params === "string") {
      this.values.app = { name: params }
    } else {
      this.values.app = {
        name: params.name,
        ...(params.version ? { version: params.version } : {}),
      }
    }
    return this
  }

  image(params: {
    repository: string
    tag?: string
    pullPolicy?: string
    command?: string[]
    args?: string[]
  }): this {
    this.values.image = {
      repository: params.repository,
      tag: params.tag ?? "latest",
      ...(params.pullPolicy ? { pullPolicy: params.pullPolicy } : {}),
      ...(params.command && params.command.length > 0
        ? { command: params.command }
        : {}),
      ...(params.args && params.args.length > 0 ? { args: params.args } : {}),
    }
    return this
  }

  replicas(count: number): this {
    this.values.replicaCount = count
    return this
  }

  deploymentType(type: "deployment" | "statefulset"): this {
    this.values.deploymentType = type
    return this
  }

  resources(params: {
    requests?: { cpu?: string; memory?: string }
    limits?: { cpu?: string; memory?: string }
  }): this {
    this.values.resources = {
      ...(params.requests ? { requests: params.requests } : {}),
      ...(params.limits ? { limits: params.limits } : {}),
    }
    return this
  }

  service(params: {
    port: number
    targetPort?: number
    type?: string
    ports?: Array<{
      port: number
      targetPort: number
      name: string
      protocol?: string
    }>
  }): this {
    this.values.service = {
      enabled: true,
      type: params.type ?? "ClusterIP",
      port: params.port,
      targetPort: params.targetPort ?? params.port,
      ...(params.ports && params.ports.length > 0
        ? { ports: params.ports }
        : {}),
    }
    return this
  }

  containerPorts(ports: Array<{ containerPort: number; name: string }>): this {
    this.values.containerPorts = ports
    return this
  }

  env(
    entries: Array<{ name: string; value: string } | HelmValuesEnvEntry>
  ): this {
    if (entries.length > 0) {
      this.values.env = entries.map((e) => {
        if ("key" in e) {
          return { name: e.key, value: e.value }
        }
        return { name: e.name, value: e.value }
      })
    }
    return this
  }

  externalSecret(params: {
    vaultPath: string
    secretStore?: string
    refreshInterval?: string
    autoEnvFrom?: boolean
    target?: { creationPolicy?: string; deletionPolicy?: string }
  }): this {
    this.values.externalSecret = {
      enabled: true,
      secretStoreRef: {
        kind: "ClusterSecretStore",
        name: params.secretStore ?? "vault-backend",
      },
      dataFrom: [{ extract: { key: params.vaultPath } }],
      ...(params.autoEnvFrom !== undefined
        ? { autoEnvFrom: params.autoEnvFrom }
        : {}),
      ...(params.refreshInterval
        ? { refreshInterval: params.refreshInterval }
        : {}),
      ...(params.target ? { target: params.target } : {}),
    }
    return this
  }

  simpleIngress(params: {
    domain: string
    className?: string
    tls?: boolean
    tlsSecretName?: string
    certIssuer?: string
    externalDns?: {
      enabled: boolean
      target: string
      cloudflareProxied?: boolean
    }
    haproxy?: HelmValuesHAProxyConfig
    annotations?: Record<string, string>
  }): this {
    const item: Record<string, unknown> = {
      enabled: true,
      domain: params.domain,
      className: params.className ?? "haproxy",
      tls: params.tls ?? true,
    }

    if (params.tlsSecretName) {
      item.tlsSecretName = params.tlsSecretName
    } else if (params.certIssuer) {
      item.certManager = { enabled: true, issuer: params.certIssuer }
    }

    if (params.externalDns?.enabled) {
      item.externalDns = params.externalDns
    }

    if (params.haproxy) {
      const haproxyConfig: Record<string, unknown> = {}
      if (params.haproxy.rateLimit?.enabled) {
        haproxyConfig.security = {
          rateLimit: {
            enabled: true,
            rpm: params.haproxy.rateLimit.rpm ?? 1000,
            burst: params.haproxy.rateLimit.burst ?? 100,
          },
        }
      }
      if (params.haproxy.cors?.enabled) {
        haproxyConfig.cors = {
          enabled: true,
          allowOrigin: params.haproxy.cors.allowOrigin ?? "*",
          allowMethods:
            params.haproxy.cors.allowMethods ??
            "GET, POST, PUT, DELETE, OPTIONS",
          allowHeaders:
            params.haproxy.cors.allowHeaders ??
            "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization",
          allowCredentials: params.haproxy.cors.allowCredentials ?? true,
        }
      }
      if (params.haproxy.stickySession?.enabled) {
        haproxyConfig.stickySession = {
          enabled: true,
          cookieName: params.haproxy.stickySession.cookieName ?? "JSESSIONID",
          strategy: params.haproxy.stickySession.strategy ?? "insert",
        }
      }
      if (Object.keys(haproxyConfig).length > 0) {
        item.haproxy = haproxyConfig
      }
    }

    if (params.annotations && Object.keys(params.annotations).length > 0) {
      item.annotations = params.annotations
    }

    this.values.simpleIngress = [item]
    return this
  }

  simpleStorage(params: HelmValuesStorage): this {
    if (params.enabled !== false) {
      const storagePath = params.path ?? params.mountPath
      const accessMode = params.accessMode ?? "ReadWriteOnce"
      this.values.simpleStorage = [
        {
          name: params.name ?? "data",
          ...(storagePath ? { path: storagePath } : {}),
          size: params.size ?? "10Gi",
          accessMode,
          accessModes: [accessMode],
          ...(params.storageClass
            ? {
                class: params.storageClass,
                storageClassName: params.storageClass,
              }
            : {}),
        },
      ]
    }
    return this
  }

  livenessProbe(probe: HelmValuesProbe): this {
    if (probe.path) {
      this.values.livenessProbe = {
        httpGet: {
          path: probe.path,
          port: probe.port ?? "http",
        },
        initialDelaySeconds: probe.initialDelaySeconds ?? 30,
        periodSeconds: probe.periodSeconds ?? 10,
        timeoutSeconds: probe.timeoutSeconds ?? 5,
        failureThreshold: probe.failureThreshold ?? 3,
      }
    }
    return this
  }

  readinessProbe(probe: HelmValuesProbe): this {
    if (probe.path) {
      this.values.readinessProbe = {
        httpGet: {
          path: probe.path,
          port: probe.port ?? "http",
        },
        initialDelaySeconds: probe.initialDelaySeconds ?? 10,
        periodSeconds: probe.periodSeconds ?? 5,
        timeoutSeconds: probe.timeoutSeconds ?? 3,
        failureThreshold: probe.failureThreshold ?? 3,
      }
    }
    return this
  }

  startupProbe(probe: HelmValuesProbe): this {
    if (probe.path) {
      this.values.startupProbe = {
        httpGet: {
          path: probe.path,
          port: probe.port ?? "http",
        },
        initialDelaySeconds: probe.initialDelaySeconds ?? 10,
        periodSeconds: probe.periodSeconds ?? 5,
        timeoutSeconds: probe.timeoutSeconds ?? 3,
        failureThreshold: probe.failureThreshold ?? 30,
      }
    }
    return this
  }

  securityContext(sc: Record<string, unknown>): this {
    this.values.securityContext = sc
    return this
  }

  podSecurityContext(psc: Record<string, unknown>): this {
    this.values.podSecurityContext = psc
    return this
  }

  nodeSelector(ns: Record<string, string>): this {
    if (Object.keys(ns).length > 0) {
      this.values.nodeSelector = ns
    }
    return this
  }

  tolerations(
    t: Array<{
      key: string
      operator?: string
      value?: string
      effect: string
      tolerationSeconds?: number
    }>
  ): this {
    if (t.length > 0) {
      this.values.tolerations = t
    }
    return this
  }

  reloader(enabled = true): this {
    if (enabled) {
      this.values.reloader = { enabled: true }
    }
    return this
  }
  logging(enabled = true): this {
    this.values.logging = { enabled }
    return this
  }

  podAnnotations(annotations: Record<string, string>): this {
    this.values.podAnnotations = {
      ...((this.values.podAnnotations as Record<string, string> | undefined) ??
        {}),
      ...annotations,
    }
    return this
  }

  setRaw(key: string, value: unknown): this {
    this.values[key] = value
    return this
  }

  fromInput(input: HelmValuesInput): this {
    const plainEntries: HelmValuesEnvEntry[] = []
    const secretEntries: HelmValuesEnvEntry[] = []

    for (const e of input.env) {
      if (e.type === "secret") {
        secretEntries.push(e)
      } else {
        plainEntries.push(e)
      }
    }

    if (secretEntries.length > 0 && !input.externalSecretVaultPath) {
      throw new Error(
        `Cannot generate Helm values: ${secretEntries.length} secret env var(s) have no resolved Vault path (externalSecretVaultPath missing)`
      )
    }

    const cpu = input.cpu ?? 500
    const memory = input.memory ?? 1024
    const port = input.containerPort ?? input.servicePort ?? 80

    const resolvedAppName = /^[0-9]/.test(input.slug)
      ? `app-${input.slug}`
      : input.slug
    this.app({ name: resolvedAppName })
    if (/^[0-9]/.test(input.slug)) {
      this.setRaw("fullnameOverride", `app-${input.slug}-deploy`)
    }
    this.image({
      repository: input.imageRepository,
      tag: input.imageTag,
      command: input.command,
      args: input.args,
    })
    this.replicas(input.replicas ?? 1)
    this.deploymentType(input.deploymentType ?? "deployment")
    this.service({
      port: input.servicePort ?? port,
      targetPort: input.containerPort ?? port,
    })
    this.containerPorts([
      {
        containerPort: input.containerPort ?? port,
        name: "http",
      },
      ...(input.additionalContainerPorts ?? []).map((p) => ({
        containerPort: p.port,
        name: p.name,
      })),
    ])
    this.resources({
      requests: { cpu: `${cpu}m`, memory: `${memory}Mi` },
      limits: {
        cpu: `${Math.max(cpu, 1000)}m`,
        memory: `${Math.max(memory, 4096)}Mi`,
      },
    })

    if (input.runAsNonRoot) {
      this.securityContext({ runAsNonRoot: true })
    }

    const resolvedFsGroup = input.fsGroup ?? input.storage?.fsGroup
    if (resolvedFsGroup != null || input.podSecurityContext) {
      this.podSecurityContext({
        ...(resolvedFsGroup != null ? { fsGroup: resolvedFsGroup } : {}),
        ...(input.podSecurityContext ?? {}),
      })
    }
    if (input.reloader) {
      this.reloader(true)
      this.podAnnotations({
        "reloader.stakater.com/auto": "true",
      })
    }

    if (input.logging !== undefined) {
      this.logging(input.logging)
    }

    if (input.podAnnotations) {
      this.podAnnotations(input.podAnnotations)
    }

    if (input.storage && input.storage.enabled) {
      this.simpleStorage(input.storage)
    }

    if (input.livenessProbe) this.livenessProbe(input.livenessProbe)
    if (input.readinessProbe) this.readinessProbe(input.readinessProbe)
    if (input.startupProbe) this.startupProbe(input.startupProbe)

    if (plainEntries.length > 0) {
      this.env(plainEntries)
    }

    if (input.externalSecretVaultPath) {
      this.externalSecret({
        vaultPath: input.externalSecretVaultPath,
      })
    }

    const edge = input.edge
    const ingressDomain = edge?.domain || input.domain
    if (ingressDomain) {
      let tlsSecretName: string | undefined
      let certIssuer: string | undefined

      if (
        edge?.certificateSource === "UPLOADED" &&
        edge.certificateStatus === "ACTIVE"
      ) {
        if (edge.certificateSecretName) {
          tlsSecretName = edge.certificateSecretName
        }
      } else if (edge?.certificateSource === "MANAGED" || !edge) {
        certIssuer = "production"
      }

      let annotations: Record<string, string> | undefined
      if (
        edge?.allowlistMode === "ALLOWLIST_ONLY" &&
        edge.enabledCidrs &&
        edge.enabledCidrs.length > 0
      ) {
        annotations = {
          "haproxy-ingress.github.io/whitelist-source-range":
            edge.enabledCidrs.join(","),
        }
      }

      this.simpleIngress({
        domain: ingressDomain,
        className: "haproxy",
        tls: true,
        tlsSecretName,
        certIssuer,
        haproxy: input.haproxy ?? undefined,
        annotations,
      })
    }

    if (input.nodeSelector) this.nodeSelector(input.nodeSelector)
    if (input.tolerations) this.tolerations(input.tolerations)

    return this
  }

  build(): Record<string, unknown> {
    return omitUndefined(structuredClone(this.values))
  }

  toYaml(): string {
    return jsYaml.dump(this.build(), { indent: 2, lineWidth: -1, noRefs: true })
  }
}

export class HelmChartBuilder {
  private _appName = ""
  private _namespace = "default"
  private _chartRepoUrl = "https://pfnapp.github.io/charts"
  private _chartName = "deploy"
  private _chartVersion = "2.12.4"
  private _gitopsRepoUrl = ""
  private _branch = "main"
  private _valueFilePath = ""

  appName(name: string): this {
    this._appName = name
    return this
  }

  namespace(ns: string): this {
    this._namespace = ns
    return this
  }

  chartRepoUrl(url: string): this {
    this._chartRepoUrl = url
    return this
  }

  chartName(name: string): this {
    this._chartName = name
    return this
  }

  chartVersion(version: string): this {
    this._chartVersion = version
    return this
  }

  gitopsRepoUrl(url: string): this {
    this._gitopsRepoUrl = url
    return this
  }

  branch(branch: string): this {
    this._branch = branch
    return this
  }

  valueFilePath(path: string): this {
    this._valueFilePath = path
    return this
  }

  build(): Record<string, unknown> {
    const yaml = this.toYaml()
    return jsYaml.load(yaml) as Record<string, unknown>
  }

  toYaml(): string {
    return buildHelmApplicationManifest({
      appName: this._appName,
      namespace: this._namespace,
      chartRepoUrl: this._chartRepoUrl,
      chartName: this._chartName,
      chartVersion: this._chartVersion,
      gitopsRepoUrl: this._gitopsRepoUrl,
      branch: this._branch,
      valueFilePath: this._valueFilePath,
    })
  }
}

export class Helm {
  static values(): HelmValuesBuilder {
    return new HelmValuesBuilder()
  }

  static chart(): HelmChartBuilder {
    return new HelmChartBuilder()
  }
}

export function buildHelmValues(
  input: HelmValuesInput
): Record<string, unknown> {
  return new HelmValuesBuilder().fromInput(input).build()
}
