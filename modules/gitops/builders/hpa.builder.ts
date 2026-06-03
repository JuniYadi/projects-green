export interface HpaTargetRef {
  apiVersion: string
  kind: string
  name: string
}

export interface HpaMetric {
  type: "Resource"
  resource: {
    name: "cpu" | "memory"
    target: {
      type: "Utilization" | "AverageValue" | "AverageUtilization"
      averageUtilization?: number
      averageValue?: string
    }
  }
}

export interface HorizontalPodAutoscalerResource {
  apiVersion: "autoscaling/v2"
  kind: "HorizontalPodAutoscaler"
  metadata: {
    name: string
    namespace?: string
    labels?: Record<string, string>
  }
  spec: {
    scaleTargetRef: HpaTargetRef
    minReplicas: number
    maxReplicas: number
    metrics: HpaMetric[]
  }
}

export class HpaBuilder {
  private name: string = ""
  private namespace: string = "default"
  private labels: Record<string, string> = {}
  private targetRef: HpaTargetRef | null = null
  private minReplicas: number = 1
  private maxReplicas: number = 10
  private cpuTarget: number | null = null
  private memoryTargetMi: number | null = null

  setName(name: string): this {
    this.name = name
    return this
  }

  setNamespace(namespace: string): this {
    this.namespace = namespace
    return this
  }

  setTarget(targetRef: HpaTargetRef): this {
    this.targetRef = targetRef
    return this
  }

  setMinReplicas(min: number): this {
    this.minReplicas = min
    return this
  }

  setMaxReplicas(max: number): this {
    this.maxReplicas = max
    return this
  }

  withCpuTarget(percentage: number): this {
    this.cpuTarget = percentage
    return this
  }

  withMemoryTarget( memoryMi: number): this {
    this.memoryTargetMi = memoryMi
    return this
  }

  withLabels(labels: Record<string, string>): this {
    this.labels = { ...this.labels, ...labels }
    return this
  }

  build(): HorizontalPodAutoscalerResource {
    if (!this.targetRef) {
      throw new Error("scaleTargetRef is required")
    }

    if (this.maxReplicas < this.minReplicas) {
      throw new Error("maxReplicas must be >= minReplicas")
    }

    const metrics: HpaMetric[] = []

    if (this.cpuTarget !== null) {
      metrics.push({
        type: "Resource",
        resource: {
          name: "cpu",
          target: {
            type: "Utilization",
            averageUtilization: this.cpuTarget,
          },
        },
      })
    }

    if (this.memoryTargetMi !== null) {
      metrics.push({
        type: "Resource",
        resource: {
          name: "memory",
          target: {
            type: "AverageValue",
            averageValue: `${this.memoryTargetMi}Mi`,
          },
        },
      })
    }

    if (metrics.length === 0) {
      throw new Error("At least one metric must be configured")
    }

    return {
      apiVersion: "autoscaling/v2",
      kind: "HorizontalPodAutoscaler",
      metadata: {
        name: this.name,
        namespace: this.namespace,
        labels: Object.keys(this.labels).length > 0 ? this.labels : undefined,
      },
      spec: {
        scaleTargetRef: this.targetRef,
        minReplicas: this.minReplicas,
        maxReplicas: this.maxReplicas,
        metrics,
      },
    }
  }
}
