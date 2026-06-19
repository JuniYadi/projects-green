import type { KubernetesMetadata } from "../gitops.types"

export const TLS_SECRET_TYPE = "kubernetes.io/tls"

export interface SecretData {
  [key: string]: string
}

export interface TLSSecretData {
  cert: string
  key: string
}

export class SecretBuilder {
  private name: string = ""
  private namespace: string = "default"
  private type: string = "Opaque"
  private data: Record<string, string> = {}
  private stringData: Record<string, string> = {}
  private annotations: Record<string, string> = {}

  setName(name: string): this {
    this.name = name
    return this
  }

  setNamespace(namespace: string): this {
    this.namespace = namespace
    return this
  }

  setType(type: string): this {
    this.type = type
    return this
  }

  addData(entries: SecretData): this {
    for (const [key, value] of Object.entries(entries)) {
      this.data[key] = Buffer.from(value).toString("base64")
    }
    return this
  }

  addStringData(entries: SecretData): this {
    this.stringData = { ...this.stringData, ...entries }
    return this
  }

  addTLSData(tlsData: TLSSecretData): this {
    this.type = TLS_SECRET_TYPE
    this.data = {
      "tls.crt": Buffer.from(tlsData.cert).toString("base64"),
      "tls.key": Buffer.from(tlsData.key).toString("base64"),
    }
    return this
  }

  addReloaderAnnotation(): this {
    this.annotations["reloader.stakater.com/auto"] = "true"
    return this
  }

  build(): KubernetesSecret {
    return {
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: this.name,
        namespace: this.namespace,
        annotations:
          Object.keys(this.annotations).length > 0
            ? this.annotations
            : undefined,
      },
      type: this.type,
      data: Object.keys(this.data).length > 0 ? this.data : undefined,
      stringData:
        Object.keys(this.stringData).length > 0 ? this.stringData : undefined,
    }
  }
}

export interface KubernetesSecret {
  apiVersion: "v1"
  kind: "Secret"
  metadata: KubernetesMetadata
  type: string
  data?: Record<string, string>
  stringData?: Record<string, string>
}
