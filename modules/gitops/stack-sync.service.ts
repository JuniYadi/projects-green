/**
 * Stack Sync — orchestrates per-container manifest generation + GitHub push.
 * Migrated from Laravel GitHubRepositoryService.php + YamlGenerationService.php.
 */

import * as jsYaml from "js-yaml"
import { GitOpsRepositoryService } from "./gitops.service"
import { HelmChartRenderer } from "./helm-template"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StackContainer {
  name: string
  type: "deployment" | "statefulset"
  image: string
  tag?: string
  replicas?: number
  ports?: Array<{ name?: string; containerPort: number; protocol?: string }>
  cpuRequest?: string
  memoryRequestMb?: number
  cpuLimit?: string
  memoryLimitMb?: number
  autoScalingEnabled?: boolean
  minReplicas?: number
  maxReplicas?: number
  targetCpuPercentage?: number
  targetMemoryPercentage?: number
  startupProbeEnabled?: boolean
  startupProbePath?: string
  startupProbePort?: number
  readinessProbeEnabled?: boolean
  readinessProbePath?: string
  readinessProbePort?: number
  env?: Record<string, string>
  configMaps?: Record<
    string,
    {
      value: Record<string, string>
      mountPath?: string
      subPath?: string
      readOnly?: boolean
    }
  >
  secrets?: Record<
    string,
    {
      value: Record<string, string>
      mountPath?: string
      subPath?: string
      readOnly?: boolean
    }
  >
  tlsSecrets?: Record<string, { cert: string; key: string; mountPath?: string }>
  storages?: Array<{
    name: string
    sizeGb: number
    mountPath: string
    accessMode?: string
    storageClass?: string
  }>
  ingresses?: Array<{
    host: string
    path?: string
    serviceName?: string
    servicePort?: number
    annotations?: Record<string, string>
    tlsEnabled?: boolean
  }>
}

export interface AppStack {
  id: string
  name: string
  slug: string
  namespace: string
  teamSlug: string
  version?: string
  containers: StackContainer[]
}

export interface StackSyncResult {
  success: boolean
  commitSha: string
  filesCount: number
  argocdAppCreated: boolean
}

// ─── Manifest Builder ─────────────────────────────────────────────────────────

export class ManifestBuilder {
  constructor(
    private stack: AppStack,
    private renderer = new HelmChartRenderer()
  ) {}

  buildNamespace(): K8sResource {
    return {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: this.stack.namespace,
        labels: {
          "app.kubernetes.io/name": this.stack.slug,
          "app.kubernetes.io/managed-by": "projects-green",
          team: this.stack.teamSlug,
        },
      },
    }
  }

  buildContainerDeployment(container: StackContainer): K8sResource {
    const ports = container.ports ?? [
      { name: "http", containerPort: 8080, protocol: "TCP" },
    ]
    const replicas = container.replicas ?? 1

    const labels = this.baseLabels(container.name)
    const reloaderAnnotation = this.reloaderAnnotation(container)

    const containerSpec: Record<string, unknown> = {
      name: container.name,
      image: `${container.image}:${container.tag ?? "latest"}`,
      ports: ports.map((p) => ({
        name: p.name ?? "http",
        containerPort: p.containerPort,
        protocol: p.protocol ?? "TCP",
      })),
      env: this.buildEnv(container),
      resources: this.buildResources(container),
      volumeMounts: this.buildVolumeMounts(container),
    }

    // Probes
    if (container.startupProbeEnabled) {
      containerSpec.startupProbe = {
        httpGet: {
          path: container.startupProbePath ?? "/health",
          port: container.startupProbePort ?? ports[0]?.containerPort ?? 8080,
        },
        initialDelaySeconds: 30,
        periodSeconds: 10,
      }
    }
    if (container.readinessProbeEnabled) {
      containerSpec.readinessProbe = {
        httpGet: {
          path: container.readinessProbePath ?? "/ready",
          port: container.readinessProbePort ?? ports[0]?.containerPort ?? 8080,
        },
        initialDelaySeconds: 5,
        periodSeconds: 10,
      }
    }

    const deployment: K8sResource = {
      apiVersion: "apps/v1",
      kind: container.type === "statefulset" ? "StatefulSet" : "Deployment",
      metadata: {
        name: container.name,
        namespace: this.stack.namespace,
        labels,
        annotations: reloaderAnnotation,
      },
      spec: {
        replicas,
        selector: { matchLabels: { "app.kubernetes.io/name": container.name } },
        template: {
          metadata: { labels },
          spec: {
            containers: [containerSpec],
            volumes: this.buildVolumes(container),
          },
        },
      },
    }

    // HPA
    if (
      container.autoScalingEnabled &&
      container.minReplicas !== container.maxReplicas
    ) {
      // HPA attached separately
    }

    return deployment
  }

  buildContainerService(container: StackContainer): K8sResource | null {
    if (!container.ports || container.ports.length === 0) return null
    return {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: container.name,
        namespace: this.stack.namespace,
        labels: this.baseLabels(container.name),
      },
      spec: {
        type: "ClusterIP",
        selector: { "app.kubernetes.io/name": container.name },
        ports: container.ports.map((p) => ({
          name: p.name ?? "http",
          port: p.containerPort,
          targetPort: p.containerPort,
          protocol: p.protocol ?? "TCP",
        })),
      },
    }
  }

  buildConfigMaps(container: StackContainer): K8sResource[] {
    const result: K8sResource[] = []
    if (!container.configMaps) return result

    let idx = 0
    for (const [name, cm] of Object.entries(container.configMaps)) {
      result.push({
        apiVersion: "v1",
        kind: "ConfigMap",
        metadata: {
          name,
          namespace: this.stack.namespace,
          labels: this.baseLabels(container.name),
          annotations: { "reloader.stakater.com/auto": "true" },
        },
        data: cm.value,
      })
      idx++
    }
    return result
  }

  buildSecrets(container: StackContainer): K8sResource[] {
    const result: K8sResource[] = []
    if (!container.secrets) return result

    let idx = 0
    for (const [name, secret] of Object.entries(container.secrets)) {
      const encoded: Record<string, string> = {}
      for (const [k, v] of Object.entries(secret.value)) {
        encoded[k] = Buffer.from(v).toString("base64")
      }
      result.push({
        apiVersion: "v1",
        kind: "Secret",
        metadata: {
          name,
          namespace: this.stack.namespace,
          labels: this.baseLabels(container.name),
          annotations: { "reloader.stakater.com/auto": "true" },
        },
        type: "Opaque",
        data: encoded,
      })
      idx++
    }

    // TLS secrets
    if (container.tlsSecrets) {
      for (const [name, tls] of Object.entries(container.tlsSecrets)) {
        result.push({
          apiVersion: "v1",
          kind: "Secret",
          metadata: {
            name,
            namespace: this.stack.namespace,
            labels: this.baseLabels(container.name),
            annotations: { "reloader.stakater.com/auto": "true" },
          },
          type: "kubernetes.io/tls",
          data: {
            "tls.crt": Buffer.from(tls.cert).toString("base64"),
            "tls.key": Buffer.from(tls.key).toString("base64"),
          },
        })
      }
    }

    return result
  }

  buildPVCs(container: StackContainer): K8sResource[] {
    if (!container.storages) return []
    return container.storages.map((s) => ({
      apiVersion: "v1",
      kind: "PersistentVolumeClaim",
      metadata: {
        name: s.name,
        namespace: this.stack.namespace,
        labels: this.baseLabels(container.name),
      },
      spec: {
        accessModes: [s.accessMode ?? "ReadWriteOnce"],
        storageClassName: s.storageClass ?? "standard",
        resources: { requests: { storage: `${s.sizeGb}Gi` } },
      },
    }))
  }

  buildIngresses(container: StackContainer): K8sResource[] {
    if (!container.ingresses) return []
    return container.ingresses.map((ing, idx) => {
      return {
        apiVersion: "networking.k8s.io/v1",
        kind: "Ingress",
        metadata: {
          name: `${container.name}-ingress`,
          namespace: this.stack.namespace,
          labels: this.baseLabels(container.name),
          annotations: {
            "kubernetes.io/ingress.class": "nginx",
            ...(ing.annotations ?? {}),
          },
        },
        spec: {
          rules: [
            {
              host: ing.host,
              http: {
                paths: [
                  {
                    path: ing.path ?? "/",
                    pathType: "Prefix",
                    backend: {
                      service: {
                        name: ing.serviceName ?? container.name,
                        port: {
                          number:
                            ing.servicePort ??
                            container.ports?.[0]?.containerPort ??
                            80,
                        },
                      },
                    },
                  },
                ],
              },
            },
          ],
          ...(ing.tlsEnabled
            ? {
                tls: [
                  { hosts: [ing.host], secretName: `${container.name}-tls` },
                ],
              }
            : {}),
        },
      }
    })
  }

  buildHPA(container: StackContainer): K8sResource | null {
    if (container.type !== "deployment") return null
    if (!container.autoScalingEnabled) return null
    if (container.minReplicas === container.maxReplicas) return null

    const metrics: unknown[] = []
    if (container.targetCpuPercentage) {
      metrics.push({
        type: "Resource",
        resource: {
          name: "cpu",
          target: {
            type: "Utilization",
            averageUtilization: container.targetCpuPercentage,
          },
        },
      })
    }
    if (container.targetMemoryPercentage) {
      metrics.push({
        type: "Resource",
        resource: {
          name: "memory",
          target: {
            type: "Utilization",
            averageUtilization: container.targetMemoryPercentage,
          },
        },
      })
    }
    if (metrics.length === 0) {
      metrics.push({
        type: "Resource",
        resource: {
          name: "cpu",
          target: { type: "Utilization", averageUtilization: 80 },
        },
      })
    }

    return {
      apiVersion: "autoscaling/v2",
      kind: "HorizontalPodAutoscaler",
      metadata: {
        name: `${container.name}-hpa`,
        namespace: this.stack.namespace,
        labels: this.baseLabels(container.name),
      },
      spec: {
        scaleTargetRef: {
          apiVersion: "apps/v1",
          kind: "Deployment",
          name: container.name,
        },
        minReplicas: container.minReplicas ?? 1,
        maxReplicas: container.maxReplicas ?? 10,
        metrics,
      },
    }
  }

  buildArgoCDApplication(repoName: string): K8sResource {
    return {
      apiVersion: "argoproj.io/v1alpha1",
      kind: "Application",
      metadata: {
        name: `${this.stack.teamSlug}-${this.stack.slug}`,
        namespace: "argocd",
        finalizers: ["resources-finalizer.argocd.argoproj.io"],
      },
      spec: {
        project: "default",
        source: {
          repoURL: `https://github.com/${repoName}`,
          targetRevision: "HEAD",
          path: `services-yaml/${this.stack.teamSlug}/${this.stack.slug}`,
          directory: { recurse: true },
        },
        destination: {
          server: "https://kubernetes.default.svc",
          namespace: this.stack.namespace,
        },
        syncPolicy: {
          automated: { prune: true, selfHeal: true, allowEmpty: false },
          syncOptions: [
            "CreateNamespace=true",
            "PrunePropagationPolicy=foreground",
            "PruneLast=true",
          ],
          retry: {
            limit: 5,
            backoff: { duration: "5s", factor: 2, maxDuration: "3m" },
          },
        },
        revisionHistoryLimit: 10,
      },
    }
  }

  private baseLabels(containerName: string): Record<string, string> {
    return {
      "app.kubernetes.io/name": containerName,
      "app.kubernetes.io/instance": this.stack.slug,
      "app.kubernetes.io/version": this.stack.version ?? "latest",
      "app.kubernetes.io/part-of": this.stack.slug,
      "app.kubernetes.io/managed-by": "projects-green",
      team: this.stack.teamSlug,
    }
  }

  private reloaderAnnotation(
    container: StackContainer
  ): Record<string, string> {
    if (
      (container.configMaps && Object.keys(container.configMaps).length > 0) ||
      (container.secrets && Object.keys(container.secrets).length > 0) ||
      (container.tlsSecrets && Object.keys(container.tlsSecrets).length > 0)
    ) {
      return { "reloader.stakater.com/auto": "true" }
    }
    return {}
  }

  private buildEnv(
    container: StackContainer
  ): Array<{ name: string; value?: string; valueFrom?: unknown }> {
    const envVars: Array<{
      name: string
      value?: string
      valueFrom?: unknown
    }> = []
    if (container.env) {
      for (const [name, value] of Object.entries(container.env)) {
        envVars.push({ name, value })
      }
    }
    return envVars
  }

  private buildResources(container: StackContainer): {
    requests: { cpu: string; memory: string }
    limits: { cpu: string; memory: string }
  } {
    return {
      requests: {
        cpu: container.cpuRequest ?? "100m",
        memory: `${container.memoryRequestMb ?? 128}Mi`,
      },
      limits: {
        cpu: container.cpuLimit ?? "500m",
        memory: `${container.memoryLimitMb ?? 512}Mi`,
      },
    }
  }

  private buildVolumeMounts(container: StackContainer): unknown[] {
    const mounts: unknown[] = []

    if (container.configMaps) {
      for (const [name, cm] of Object.entries(container.configMaps)) {
        mounts.push({
          name,
          mountPath: cm.mountPath ?? `/config/${name}`,
          subPath: cm.subPath,
          readOnly: cm.readOnly ?? false,
        })
      }
    }
    if (container.secrets) {
      for (const [name, secret] of Object.entries(container.secrets)) {
        mounts.push({
          name,
          mountPath: secret.mountPath ?? `/secrets/${name}`,
          subPath: secret.subPath,
          readOnly: secret.readOnly ?? true,
        })
      }
    }
    if (container.tlsSecrets) {
      for (const [name, tls] of Object.entries(container.tlsSecrets)) {
        mounts.push({
          name,
          mountPath: tls.mountPath ?? `/etc/tls/${name}`,
          readOnly: true,
        })
      }
    }
    if (container.storages) {
      for (const s of container.storages) {
        mounts.push({ name: s.name, mountPath: s.mountPath })
      }
    }

    return mounts
  }

  private buildVolumes(container: StackContainer): unknown[] {
    const volumes: unknown[] = []

    if (container.configMaps) {
      for (const [name] of Object.entries(container.configMaps)) {
        volumes.push({ name, configMap: { name } })
      }
    }
    if (container.secrets) {
      for (const [name] of Object.entries(container.secrets)) {
        volumes.push({ name, secret: { secretName: name } })
      }
    }
    if (container.tlsSecrets) {
      for (const [name] of Object.entries(container.tlsSecrets)) {
        volumes.push({ name, secret: { secretName: name } })
      }
    }
    if (container.storages) {
      for (const s of container.storages) {
        volumes.push({
          name: s.name,
          persistentVolumeClaim: { claimName: s.name },
        })
      }
    }

    return volumes
  }
}

// ─── Stack Sync Service ───────────────────────────────────────────────────────

export interface GitOpsRepoConfig {
  owner: string
  repo: string
  branch?: string
}

export class StackSyncService {
  private gitops: GitOpsRepositoryService
  private renderer = new HelmChartRenderer()

  constructor(
    private env: "development" | "staging" | "production" = "production"
  ) {
    this.gitops = new GitOpsRepositoryService()
  }

  /**
   * Full lifecycle: generate all manifests per-container and push to GitOps repo.
   */
  async syncStack(
    stack: AppStack,
    repoConfig: GitOpsRepoConfig
  ): Promise<StackSyncResult> {
    const builder = new ManifestBuilder(stack)
    const files: Array<{ file: string; content: string }> = []

    // Namespace
    files.push({
      file: `services-yaml/${stack.teamSlug}/namespace.yml`,
      content: this.serialize(builder.buildNamespace()),
    })

    // Per-container manifests
    for (const container of stack.containers) {
      const containerPath = `services-yaml/${stack.teamSlug}/${stack.slug}/${container.name}`

      // Deployment / StatefulSet
      const resourceType =
        container.type === "statefulset" ? "statefulset.yml" : "deployment.yml"
      files.push({
        file: `${containerPath}/${resourceType}`,
        content: this.serialize(builder.buildContainerDeployment(container)),
      })

      // Service
      const svc = builder.buildContainerService(container)
      if (svc)
        files.push({
          file: `${containerPath}/service.yml`,
          content: this.serialize(svc),
        })

      // ConfigMaps
      const cms = builder.buildConfigMaps(container)
      cms.forEach((cm, idx) => {
        const fn = idx === 0 ? "configmap.yml" : `configmap-${idx}.yml`
        files.push({
          file: `${containerPath}/${fn}`,
          content: this.serialize(cm),
        })
      })

      // Secrets
      const secrets = builder.buildSecrets(container)
      secrets.forEach((s, idx) => {
        const fn = idx === 0 ? "secret.yml" : `secret-${idx}.yml`
        files.push({
          file: `${containerPath}/${fn}`,
          content: this.serialize(s),
        })
      })

      // PVCs
      const pvcs = builder.buildPVCs(container)
      pvcs.forEach((pvc, idx) => {
        const fn = idx === 0 ? "pvc.yml" : `pvc-${idx}.yml`
        files.push({
          file: `${containerPath}/${fn}`,
          content: this.serialize(pvc),
        })
      })

      // Ingresses
      const ingresses = builder.buildIngresses(container)
      ingresses.forEach((ing, idx) => {
        const fn = idx === 0 ? "ingress.yml" : `ingress-${idx}.yml`
        files.push({
          file: `${containerPath}/${fn}`,
          content: this.serialize(ing),
        })
      })

      // HPA
      const hpa = builder.buildHPA(container)
      if (hpa)
        files.push({
          file: `${containerPath}/hpa.yml`,
          content: this.serialize(hpa),
        })
    }

    // ArgoCD Application
    const fullRepo = `${repoConfig.owner}/${repoConfig.repo}`
    files.push({
      file: `argocd-projects/${stack.teamSlug}-${stack.slug}.yml`,
      content: this.serialize(builder.buildArgoCDApplication(fullRepo)),
    })

    // Push to GitHub via Trees API
    const filesFormatted = files.map((f) => ({
      path: f.file,
      content: f.content,
    }))
    const result = await this.gitops.commitFiles(
      fullRepo,
      `Deploy ${stack.name} to ${this.env} — ${stack.version ?? "latest"}`,
      filesFormatted,
      []
    )

    return {
      success: true,
      commitSha: (result as { sha: string }).sha,
      filesCount: files.length,
      argocdAppCreated: true,
    }
  }

  /**
   * Delete all manifests for a stack from GitOps repo.
   */
  async deleteStack(
    stack: AppStack,
    repoConfig: GitOpsRepoConfig
  ): Promise<void> {
    const fullRepo = `${repoConfig.owner}/${repoConfig.repo}`
    const deletePaths = [
      `services-yaml/${stack.teamSlug}/${stack.slug}`,
      `argocd-projects/${stack.teamSlug}-${stack.slug}.yml`,
    ]
    await this.gitops.commitFiles(
      fullRepo,
      `Delete ${stack.name}`,
      [],
      deletePaths
    )
  }

  /**
   * Update specific manifests (incremental).
   */
  async updateManifests(
    stack: AppStack,
    repoConfig: GitOpsRepoConfig,
    manifestTypes: Array<{ type: string; container: StackContainer }>
  ): Promise<void> {
    const builder = new ManifestBuilder(stack)
    const files: Array<{ file: string; content: string }> = []

    for (const { type, container } of manifestTypes) {
      const path = `services-yaml/${stack.teamSlug}/${stack.slug}/${container.name}`

      switch (type) {
        case "deployment": {
          const resourceType =
            container.type === "statefulset"
              ? "statefulset.yml"
              : "deployment.yml"
          files.push({
            file: `${path}/${resourceType}`,
            content: this.serialize(
              builder.buildContainerDeployment(container)
            ),
          })
          break
        }
        case "configmap": {
          const cms = builder.buildConfigMaps(container)
          cms.forEach((cm, idx) => {
            const fn = idx === 0 ? "configmap.yml" : `configmap-${idx}.yml`
            files.push({ file: `${path}/${fn}`, content: this.serialize(cm) })
          })
          break
        }
        case "ingress": {
          const ingresses = builder.buildIngresses(container)
          ingresses.forEach((ing, idx) => {
            const fn = idx === 0 ? "ingress.yml" : `ingress-${idx}.yml`
            files.push({ file: `${path}/${fn}`, content: this.serialize(ing) })
          })
          break
        }
        case "secret": {
          const secrets = builder.buildSecrets(container)
          secrets.forEach((s, idx) => {
            const fn = idx === 0 ? "secret.yml" : `secret-${idx}.yml`
            files.push({ file: `${path}/${fn}`, content: this.serialize(s) })
          })
          break
        }
        case "pvc": {
          const pvcs = builder.buildPVCs(container)
          pvcs.forEach((pvc, idx) => {
            const fn = idx === 0 ? "pvc.yml" : `pvc-${idx}.yml`
            files.push({ file: `${path}/${fn}`, content: this.serialize(pvc) })
          })
          break
        }
      }
    }

    if (files.length === 0) return

    const fullRepo = `${repoConfig.owner}/${repoConfig.repo}`
    const filesFormatted = files.map((f) => ({
      path: f.file,
      content: f.content,
    }))
    await this.gitops.commitFiles(
      fullRepo,
      `Update ${stack.name} manifests`,
      filesFormatted,
      []
    )
  }

  private serialize(obj: K8sResource): string {
    return jsYaml.dump(obj, { indent: 2, lineWidth: -1, noRefs: true })
  }
}

type K8sResource = Record<string, unknown>
