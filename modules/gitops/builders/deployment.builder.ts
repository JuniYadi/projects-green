import type { KubernetesMetadata } from "../gitops.types"
import type { EnvVar, EnvFromSource } from "./env.builder"
import type { VolumeMount } from "./volume.builder"

export interface ContainerPort {
  containerPort: number
  protocol?: string
}

export interface Probe {
  httpGet?: { path: string; port: number }
  initialDelaySeconds?: number
  periodSeconds?: number
}

export class DeploymentBuilder {
  private name: string = ""
  private namespace: string = "default"
  private image: string = ""
  private port: number = 80
  private replicas?: number
  private healthCheckPath?: string

  private envVars: EnvVar[] = []
  private envFromSources: EnvFromSource[] = []
  private volumeMounts: VolumeMount[] = []
  private volumes: Array<{ name: string; [key: string]: unknown }> = []
  private annotations: Record<string, string> = {}

  private hpaMinReplicas?: number
  private hpaMaxReplicas?: number
  private hpaTargetCPUUtilization?: number
  private hpaTargetMemoryUtilization?: number

  setName(name: string): this {
    this.name = name
    return this
  }

  setNamespace(namespace: string): this {
    this.namespace = namespace
    return this
  }

  setImage(image: string): this {
    this.image = image
    return this
  }

  setPort(port: number): this {
    this.port = port
    return this
  }

  setReplicas(replicas: number): this {
    this.replicas = replicas
    return this
  }

  setHealthCheckPath(path: string): this {
    this.healthCheckPath = path
    return this
  }

  addEnvVar(name: string, value: string): this {
    this.envVars.push({ name, value })
    return this
  }

  addEnvFromConfigMap(
    configMapName: string,
    items: Array<{ key: string; optional?: boolean }>
  ): this {
    this.envFromSources.push({
      configMapRef: {
        name: configMapName,
        items: items.map((item) => ({
          key: item.key,
          optional: item.optional,
        })),
      },
    })
    return this
  }

  addEnvFromSecret(
    secretName: string,
    items: Array<{ key: string; optional?: boolean }>
  ): this {
    this.envFromSources.push({
      secretRef: {
        name: secretName,
        items: items.map((item) => ({
          key: item.key,
          optional: item.optional,
        })),
      },
    })
    return this
  }

  addVolumeMount(
    name: string,
    mountPath: string,
    readOnly: boolean = false
  ): this {
    this.volumeMounts.push({ name, mountPath, readOnly })
    return this
  }

  addVolume(name: string, volumeConfig: Record<string, unknown>): this {
    this.volumes.push({ name, ...volumeConfig })
    return this
  }

  addReloaderAnnotation(): this {
    this.annotations["reloader.stakater.com/auto"] = "true"
    return this
  }

  setHPAMinReplicas(min: number): this {
    this.hpaMinReplicas = min
    return this
  }

  setHPAMaxReplicas(max: number): this {
    this.hpaMaxReplicas = max
    return this
  }

  setHPATargetCPUUtilization(percentage: number): this {
    this.hpaTargetCPUUtilization = percentage
    return this
  }

  setHPATargetMemoryUtilization(percentage: number): this {
    this.hpaTargetMemoryUtilization = percentage
    return this
  }

  build(): KubernetesDeployment {
    const healthPath = this.healthCheckPath ?? "/healthz"

    const container: Record<string, unknown> = {
      name: this.name,
      image: this.image,
      ports: [{ containerPort: this.port }],
      livenessProbe: {
        httpGet: { path: healthPath, port: this.port },
        initialDelaySeconds: 15,
        periodSeconds: 10,
      },
      readinessProbe: {
        httpGet: { path: healthPath, port: this.port },
        initialDelaySeconds: 5,
        periodSeconds: 5,
      },
    }

    if (this.envVars.length > 0) {
      container.env = this.envVars
    }

    if (this.envFromSources.length > 0) {
      container.envFrom = this.envFromSources
    }

    if (this.volumeMounts.length > 0) {
      container.volumeMounts = this.volumeMounts
    }

    const podSpec: Record<string, unknown> = {
      containers: [container],
    }

    if (this.volumes.length > 0) {
      podSpec.volumes = this.volumes
    }

    const deployment: Record<string, unknown> = {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: this.name,
        namespace: this.namespace,
        labels: { app: this.name },
        annotations:
          Object.keys(this.annotations).length > 0
            ? this.annotations
            : undefined,
      },
      spec: {
        replicas: this.replicas ?? 1,
        selector: { matchLabels: { app: this.name } },
        template: {
          metadata: { labels: { app: this.name } },
          spec: podSpec,
        },
      },
    }

    return deployment as unknown as KubernetesDeployment
  }

  buildHPA(): KubernetesHPA | null {
    if (
      this.hpaMinReplicas === undefined &&
      this.hpaTargetCPUUtilization === undefined
    ) {
      return null
    }

    const metrics: Array<{
      type: "Resource"
      resource: {
        name: string
        target: {
          type: "Utilization" | "AverageValue"
          averageUtilization?: number
          averageValue?: string
        }
      }
    }> = []

    if (this.hpaTargetCPUUtilization !== undefined) {
      metrics.push({
        type: "Resource",
        resource: {
          name: "cpu",
          target: {
            type: "Utilization",
            averageUtilization: this.hpaTargetCPUUtilization,
          },
        },
      })
    }

    if (this.hpaTargetMemoryUtilization !== undefined) {
      metrics.push({
        type: "Resource",
        resource: {
          name: "memory",
          target: {
            type: "AverageValue",
            averageValue: `${this.hpaTargetMemoryUtilization}Mi`,
          },
        },
      })
    }

    return {
      apiVersion: "autoscaling/v2",
      kind: "HorizontalPodAutoscaler",
      metadata: {
        name: `${this.name}-hpa`,
        namespace: this.namespace,
      },
      spec: {
        minReplicas: this.hpaMinReplicas ?? 1,
        maxReplicas: this.hpaMaxReplicas ?? 10,
        scaleTargetRef: {
          apiVersion: "apps/v1",
          kind: "Deployment",
          name: this.name,
        },
        metrics,
      },
    }
  }
}

export interface KubernetesDeployment {
  apiVersion: "apps/v1"
  kind: "Deployment"
  metadata: KubernetesMetadata
  spec: {
    replicas: number
    selector: { matchLabels: Record<string, string> }
    template: {
      metadata: { labels: Record<string, string> }
      spec: {
        containers: Array<Record<string, unknown>>
        volumes?: Array<{ name: string; [key: string]: unknown }>
      }
    }
  }
}

export interface KubernetesHPA {
  apiVersion: "autoscaling/v2"
  kind: "HorizontalPodAutoscaler"
  metadata: KubernetesMetadata
  spec: {
    minReplicas: number
    maxReplicas: number
    scaleTargetRef: { apiVersion: string; kind: string; name: string }
    metrics: Array<{
      type: "Resource"
      resource: {
        name: string
        target: {
          type: "Utilization" | "AverageValue"
          averageUtilization?: number
          averageValue?: string
        }
      }
    }>
  }
}
