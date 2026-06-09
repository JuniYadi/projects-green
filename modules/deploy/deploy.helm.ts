/**
 * K8s manifest builder — env/secret → Helm values
 * Migrated from Laravel DeploymentBuilder.php + HasHelmChart.php
 */

import * as jsYaml from "js-yaml"

// ─── Env Var Types ─────────────────────────────────────────────────────────────

export interface EnvVar {
  name: string
  value?: string
  valueFrom?: {
    configMapKeyRef?: { name: string; key: string }
    secretKeyRef?: { name: string; key: string }
  }
}

export interface Port {
  name?: string
  containerPort: number
  protocol?: string
}

export interface ResourceRequirements {
  requests?: { cpu?: string; memory?: string }
  limits?: { cpu?: string; memory?: string }
}

export interface Probe {
  httpGet?: { path: string; port: number }
  tcpSocket?: { port: number }
  exec?: { command: string[] }
  initialDelaySeconds?: number
  periodSeconds?: number
  failureThreshold?: number
  timeoutSeconds?: number
 successThreshold?: number
}

export interface VolumeMount {
  name: string
  mountPath: string
  readOnly?: boolean
  subPath?: string
}

export interface Toleration {
  key: string
  operator?: string
  value?: string
  effect: string
  tolerationSeconds?: number
}

// ─── Helm Values Types ────────────────────────────────────────────────────────

export interface HelmImage {
  repository: string
  tag: string
  pullPolicy: string
}

export interface HelmResources {
  requests: { cpu: string; memory: string }
  limits: { cpu: string; memory: string }
}

export interface HelmValues {
  enabled: boolean
  name: string
  image: HelmImage
  replicaCount: number
  resources: HelmResources
  env: EnvVar[]
  ports: Port[]
  nodeSelector: Record<string, string>
  tolerations: Toleration[]
  affinity: Record<string, unknown>
  serviceAccount: { name: string }
  probes: {
    liveness: Probe
    readiness: Probe
    startup: Probe
  }
  volumes: unknown[]
  volumeMounts: VolumeMount[]
  labels: Record<string, string>
  securityContext: unknown
  podSecurityContext: unknown
}

export interface ApplicationHelmValues {
  global: {
    namespace: string
    labels: Record<string, string>
    annotations: Record<string, string>
  }
  chart: { name: string; version: string }
  applications: ContainerHelmValues[]
  ingress?: IngressHelmValues
  storage?: StorageHelmValues
}

export interface ContainerHelmValues {
  name: string
  image: { repository: string; tag: string; pullPolicy: string }
  type: "deployment" | "statefulset"
  replicaCount: number
  env?: Array<{ name: string; value: string }>
  service?: {
    enabled: boolean
    type: string
    port?: number
    targetPort?: number
    protocol?: string
    name?: string
    ports?: Array<{
      name: string
      port: number
      targetPort: number
      protocol: string
    }>
  }
  resources?: HelmResources
  startupProbe?: Probe
  readinessProbe?: Probe
  nodeSelector?: Record<string, string>
  tolerations?: Toleration[]
  affinity?: Record<string, unknown>
  serviceAccountName?: string
  autoscaling?: {
    enabled: boolean
    minReplicas: number
    maxReplicas: number
    targetCPUUtilizationPercentage: number
    targetMemoryUtilizationPercentage?: number
  }
}

export interface IngressHelmValues {
  enabled: boolean
  className: string
  annotations: Record<string, string>
  hosts: Array<{
    host: string
    paths: Array<{ path: string; pathType: string }>
  }>
  tls?: Array<{ secretName: string; hosts: string[] }>
}

export interface StorageHelmValues {
  persistence: {
    enabled: boolean
    storageClass: string
    accessMode: string
    size: string
    mountPath: string
  }
}

// ─── Deployment Builder ──────────────────────────────────────────────────────

export class DeploymentBuilder {
  private name: string
  private namespace: string
  private image: string = ""
  private replicas: number = 1
  private env: EnvVar[] = []
  private ports: Port[] = []
  private resources: ResourceRequirements = {}
  private volumes: unknown[] = []
  private volumeMounts: VolumeMount[] = []
  private extraContainers: unknown[] = []
  private labels: Record<string, string> = { app: "" }
  private hpaMinReplicas: number | null = null
  private hpaMaxReplicas: number | null = null
  private hpaMetrics: unknown[] = []
  private nodeSelector: Record<string, string> = {}
  private tolerations: Toleration[] = []
  private affinity: Record<string, unknown> = {}
  private livenessProbe: Probe = {}
  private readinessProbe: Probe = {}
  private startupProbe: Probe = {}
  private securityContext: unknown = {}
  private podSecurityContext: unknown = {}
  private serviceAccountName: string = ""

  constructor(name: string, namespace: string) {
    this.name = name
    this.namespace = namespace
    this.labels = { app: name }
  }

  setImage(image: string): this { this.image = image; return this }
  setReplicas(replicas: number): this { this.replicas = replicas; return this }
  setEnv(env: EnvVar[]): this { this.env = env; return this }
  setPorts(ports: Port[]): this { this.ports = ports; return this }
  setResources(resources: ResourceRequirements): this { this.resources = resources; return this }
  setLabels(labels: Record<string, string>): this { this.labels = { ...this.labels, ...labels }; return this }
  setNodeSelector(ns: Record<string, string>): this { this.nodeSelector = ns; return this }
  setTolerations(t: Toleration[]): this { this.tolerations = t; return this }
  setAffinity(a: Record<string, unknown>): this { this.affinity = a; return this }
  setLivenessProbe(p: Probe): this { this.livenessProbe = p; return this }
  setReadinessProbe(p: Probe): this { this.readinessProbe = p; return this }
  setStartupProbe(p: Probe): this { this.startupProbe = p; return this }
  setSecurityContext(sc: unknown): this { this.securityContext = sc; return this }
  setPodSecurityContext(psc: unknown): this { this.podSecurityContext = psc; return this }
  setServiceAccountName(sa: string): this { this.serviceAccountName = sa; return this }
  setHPA(min: number, max: number, metrics: unknown[] = []): this {
    this.hpaMinReplicas = min; this.hpaMaxReplicas = max; this.hpaMetrics = metrics; return this
  }

  addEnvVar(name: string, value: string): this {
    this.env.push({ name, value })
    return this
  }

  addEnvFromConfigMap(name: string, configMapName: string, key: string): this {
    this.env.push({ name, valueFrom: { configMapKeyRef: { name: configMapName, key } } })
    return this
  }

  addEnvFromSecret(name: string, secretName: string, key: string): this {
    this.env.push({ name, valueFrom: { secretKeyRef: { name: secretName, key } } })
    return this
  }

  addVolume(volume: unknown, mount: VolumeMount): this {
    this.volumes.push(volume)
    this.volumeMounts.push(mount)
    return this
  }

  addContainer(container: unknown): this {
    this.extraContainers.push(container)
    return this
  }

  addPVC(pvcName: string, mountPath: string, readOnly = false): this {
    this.volumes.push({ name: pvcName, persistentVolumeClaim: { claimName: pvcName } })
    this.volumeMounts.push({ name: pvcName, mountPath, readOnly })
    return this
  }

  addConfigMapMount(configMapName: string, mountPath: string, volumeName?: string, items: unknown[] = [], defaultMode = 0o644): this {
    const volName = volumeName ?? configMapName
    this.volumes.push({ name: volName, configMap: { name: configMapName, items, defaultMode } })
    this.volumeMounts.push({ name: volName, mountPath })
    return this
  }

  addSecretMount(secretName: string, mountPath: string, volumeName?: string, items: unknown[] = [], defaultMode = 0o644): this {
    const volName = volumeName ?? secretName
    this.volumes.push({ name: volName, secret: { secretName, items, defaultMode } })
    this.volumeMounts.push({ name: volName, mountPath })
    return this
  }

  addEmptyDirMount(volumeName: string, mountPath: string, sizeLimit?: string, medium = ""): this {
    this.volumes.push({ name: volumeName, emptyDir: sizeLimit ? { sizeLimit, medium } : { medium } })
    this.volumeMounts.push({ name: volumeName, mountPath })
    return this
  }

  addHostPathMount(volumeName: string, hostPath: string, mountPath: string, type = "DirectoryOrCreate", readOnly = false): this {
    this.volumes.push({ name: volumeName, hostPath: { path: hostPath, type } })
    this.volumeMounts.push({ name: volumeName, mountPath, readOnly })
    return this
  }

  build(): { content: unknown; helm: { deployment: HelmValues } } {
    const ports = this.ports.length > 0 ? this.ports : [{ name: "http", containerPort: 8080, protocol: "TCP" }]
    const resources = Object.keys(this.resources).length > 0 ? this.resources : {
      requests: { cpu: "100m", memory: "128Mi" },
      limits: { cpu: "500m", memory: "512Mi" },
    }

    const containers = [
      {
        name: this.name,
        image: this.image,
        ports,
        env: this.env,
        resources,
        volumeMounts: this.volumeMounts,
        ...(Object.keys(this.livenessProbe).length > 0 && { livenessProbe: this.livenessProbe }),
        ...(Object.keys(this.readinessProbe).length > 0 && { readinessProbe: this.readinessProbe }),
        ...(Object.keys(this.startupProbe).length > 0 && { startupProbe: this.startupProbe }),
        ...(Object.keys(this.securityContext as object).length > 0 && { securityContext: this.securityContext }),
      },
      ...this.extraContainers,
    ]

    const podSpec: Record<string, unknown> = { containers }
    if (this.volumes.length > 0) podSpec.volumes = this.volumes
    if (Object.keys(this.nodeSelector).length > 0) podSpec.nodeSelector = this.nodeSelector
    if (this.tolerations.length > 0) podSpec.tolerations = this.tolerations
    if (Object.keys(this.affinity).length > 0) podSpec.affinity = this.affinity
    if (Object.keys(this.podSecurityContext as object).length > 0) podSpec.securityContext = this.podSecurityContext
    if (this.serviceAccountName) podSpec.serviceAccountName = this.serviceAccountName

    const deployment = {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: { name: this.name, namespace: this.namespace, labels: this.labels },
      spec: {
        replicas: this.replicas,
        selector: { matchLabels: this.labels },
        template: {
          metadata: { labels: this.labels },
          spec: podSpec,
        },
      },
    }

    const imageParts = (this.image ?? "").split(":")
    const imageRepo = imageParts[0] || this.image
    const imageTag = imageParts[1] || "latest"

    return {
      content: deployment,
      helm: { deployment: this.buildHelmValues(ports, resources, imageRepo, imageTag) },
    }
  }

  private buildHelmValues(ports: Port[], resources: ResourceRequirements, imageRepo: string, imageTag: string): HelmValues {
    return {
      enabled: true,
      name: this.name,
      image: { repository: imageRepo, tag: imageTag, pullPolicy: "IfNotPresent" },
      replicaCount: this.replicas,
      resources: resources as HelmResources,
      env: this.env,
      ports,
      nodeSelector: this.nodeSelector,
      tolerations: this.tolerations,
      affinity: this.affinity,
      serviceAccount: { name: this.serviceAccountName },
      probes: {
        liveness: this.livenessProbe,
        readiness: this.readinessProbe,
        startup: this.startupProbe,
      },
      volumes: this.volumes,
      volumeMounts: this.volumeMounts,
      labels: this.labels,
      securityContext: this.securityContext,
      podSecurityContext: this.podSecurityContext,
    }
  }

  /** Build full ApplicationHelmValues from container + stack metadata */
  buildApplicationHelmValues(opts: {
    namespace: string
    slug: string
    env: string
    containerName: string
    image: string
    tag: string
    replicas: number
    envVars?: Array<{ name: string; value: string }>
    ports?: Port[]
    cpuRequest?: string
    memoryRequestMb?: number
    cpuLimit?: string
    memoryLimitMb?: number
    startupProbe?: Probe
    readinessProbe?: Probe
    nodeSelector?: Record<string, string>
    tolerations?: Toleration[]
    affinity?: Record<string, unknown>
    serviceAccountName?: string
    domainName?: string
    certIssuer?: string
    storageClass?: string
    storageSizeGb?: number
    requiresPersistentStorage?: boolean
    isHpaSupported?: boolean
    autoscaling?: { minReplicas: number; maxReplicas: number; cpuThreshold: number; memoryThreshold?: number; mode: string }
  }): ApplicationHelmValues {
    const imageParts = (opts.image ?? "").split(":")
    const imageRepo = imageParts[0] || opts.image
    const imageTag = opts.tag || imageParts[1] || "latest"

    const containerConfig: ContainerHelmValues = {
      name: opts.containerName,
      image: { repository: imageRepo, tag: imageTag, pullPolicy: "IfNotPresent" },
      type: "deployment",
      replicaCount: opts.replicas,
    }

    if (opts.envVars && opts.envVars.length > 0) {
      containerConfig.env = opts.envVars
    }

    if (opts.ports && opts.ports.length > 0) {
      containerConfig.service = {
        enabled: true,
        type: "ClusterIP",
        ports: opts.ports.map((p) => ({
          name: p.name ?? "http",
          port: p.containerPort,
          targetPort: p.containerPort,
          protocol: p.protocol ?? "TCP",
        })),
      }
    }

    if (opts.cpuRequest || opts.memoryRequestMb || opts.cpuLimit || opts.memoryLimitMb) {
      containerConfig.resources = {
        requests: { cpu: opts.cpuRequest ?? "100m", memory: `${opts.memoryRequestMb ?? 128}Mi` },
        limits: { cpu: opts.cpuLimit ?? "500m", memory: `${opts.memoryLimitMb ?? 512}Mi` },
      }
    }

    if (opts.startupProbe) containerConfig.startupProbe = opts.startupProbe
    if (opts.readinessProbe) containerConfig.readinessProbe = opts.readinessProbe
    if (opts.nodeSelector) containerConfig.nodeSelector = opts.nodeSelector
    if (opts.tolerations) containerConfig.tolerations = opts.tolerations
    if (opts.affinity) containerConfig.affinity = opts.affinity
    if (opts.serviceAccountName) containerConfig.serviceAccountName = opts.serviceAccountName

    if (opts.autoscaling && opts.isHpaSupported) {
      containerConfig.autoscaling = {
        enabled: true,
        minReplicas: opts.autoscaling.minReplicas,
        maxReplicas: opts.autoscaling.maxReplicas,
        targetCPUUtilizationPercentage: opts.autoscaling.cpuThreshold,
        ...(opts.autoscaling.mode === "memory" || opts.autoscaling.mode === "all" ? { targetMemoryUtilizationPercentage: opts.autoscaling.memoryThreshold ?? 80 } : {}),
      }
    }

    const helmValues: ApplicationHelmValues = {
      global: {
        namespace: opts.namespace,
        labels: {
          "app.kubernetes.io/name": opts.slug,
          "app.kubernetes.io/instance": opts.slug,
          "app.kubernetes.io/environment": opts.env,
        },
        annotations: {},
      },
      chart: { name: "app-deployment", version: "0.1.0" },
      applications: [containerConfig],
    }

    if (opts.domainName) {
      helmValues.ingress = {
        enabled: true,
        className: "haproxy",
        annotations: { "cert-manager.io/cluster-issuer": opts.certIssuer ?? "letsencrypt-prod" },
        hosts: [{ host: opts.domainName, paths: [{ path: "/", pathType: "Prefix" }] }],
        tls: [{ secretName: `${opts.namespace}-tls-secret`, hosts: [opts.domainName] }],
      }
    }

    if (opts.requiresPersistentStorage) {
      helmValues.storage = {
        persistence: {
          enabled: true,
          storageClass: opts.storageClass ?? "standard",
          accessMode: "ReadWriteOnce",
          size: `${opts.storageSizeGb ?? 1}Gi`,
          mountPath: "/data",
        },
      }
    }

    return helmValues
  }
}

// ─── Helm Commands ───────────────────────────────────────────────────────────

export function generateHelmInstallCommand(releaseName: string, chartName: string, values: ApplicationHelmValues): string {
  const app = values.applications[0]
  if (!app) return `helm install ${releaseName} ${chartName}`

  let cmd = `helm install ${releaseName} ${chartName}`
  cmd += ` --set image.repository=${app.image.repository}`
  cmd += ` --set image.tag=${app.image.tag}`
  cmd += ` --set replicaCount=${app.replicaCount}`

  if (app.service?.port) {
    cmd += ` --set service.type=${app.service.type}`
    cmd += ` --set service.port=${app.service.port}`
    cmd += ` --set service.targetPort=${app.service.targetPort ?? app.service.port}`
  }

  return cmd
}

export function generateHelmUpgradeCommand(releaseName: string, chartName: string, values: ApplicationHelmValues): string {
  const app = values.applications[0]
  if (!app) return `helm upgrade ${releaseName} ${chartName}`

  let cmd = `helm upgrade ${releaseName} ${chartName}`
  cmd += ` --set image.repository=${app.image.repository}`
  cmd += ` --set image.tag=${app.image.tag}`
  cmd += ` --set replicaCount=${app.replicaCount}`

  if (app.service?.port) {
    cmd += ` --set service.type=${app.service.type}`
    cmd += ` --set service.port=${app.service.port}`
    cmd += ` --set service.targetPort=${app.service.targetPort ?? app.service.port}`
  }

  return cmd
}

export function helmValuesToYaml(values: ApplicationHelmValues): string {
  return jsYaml.dump(values, { indent: 2, lineWidth: -1, noRefs: true })
}
