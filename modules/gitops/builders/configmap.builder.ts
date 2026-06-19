export interface ConfigMapData {
  [key: string]: string
}

export interface ConfigMapBinaryData {
  [key: string]: string
}

export interface KubernetesConfigMap {
  apiVersion: string
  kind: string
  metadata: {
    name: string
    namespace?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  data?: ConfigMapData
  binaryData?: ConfigMapBinaryData
}

export class ConfigMapBuilder {
  private name: string
  private namespace: string
  private labels: Record<string, string> = {}
  private annotations: Record<string, string> = {}
  private data: ConfigMapData = {}
  private binaryData: ConfigMapBinaryData = {}

  constructor(name: string, namespace: string) {
    this.name = name
    this.namespace = namespace
  }

  withData(data: ConfigMapData): this {
    this.data = { ...this.data, ...data }
    return this
  }

  withLabels(labels: Record<string, string>): this {
    this.labels = { ...this.labels, ...labels }
    return this
  }

  withAnnotations(annotations: Record<string, string>): this {
    this.annotations = { ...this.annotations, ...annotations }
    return this
  }

  withBinaryData(binaryData: ConfigMapBinaryData): this {
    this.binaryData = { ...this.binaryData, ...binaryData }
    return this
  }

  addData(key: string, value: string): this {
    this.data[key] = value
    return this
  }

  build(): KubernetesConfigMap {
    const configMap: KubernetesConfigMap = {
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: {
        name: this.name,
        namespace: this.namespace,
      },
    }

    if (Object.keys(this.labels).length > 0) {
      configMap.metadata.labels = { ...this.labels }
    }

    if (Object.keys(this.annotations).length > 0) {
      configMap.metadata.annotations = { ...this.annotations }
    }

    if (Object.keys(this.data).length > 0) {
      configMap.data = { ...this.data }
    }

    if (Object.keys(this.binaryData).length > 0) {
      configMap.binaryData = { ...this.binaryData }
    }

    return configMap
  }
}
