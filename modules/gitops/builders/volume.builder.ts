export interface KubernetesVolume {
  name: string
  configMap?: {
    name: string
    items?: Array<{ key: string; path: string }>
    defaultMode?: number
  }
  secret?: {
    secretName: string
    items?: Array<{ key: string; path: string }>
    defaultMode?: number
  }
  persistentVolumeClaim?: { claimName: string; readOnly?: boolean }
  emptyDir?: Record<string, unknown>
}

export interface VolumeMount {
  name: string
  mountPath: string
  readOnly?: boolean
  subPath?: string
}

export class VolumeBuilder {
  private name: string = ""
  private mountPath: string = ""
  private readOnly: boolean = false
  private volumeType: "configMap" | "secret" | "pvc" | "emptyDir" | null = null

  configMap(name: string, mountPath: string): this {
    this.name = name
    this.mountPath = mountPath
    this.volumeType = "configMap"
    return this
  }

  secret(name: string, mountPath: string): this {
    this.name = name
    this.mountPath = mountPath
    this.volumeType = "secret"
    return this
  }

  pvc(name: string, mountPath: string): this {
    this.name = name
    this.mountPath = mountPath
    this.volumeType = "pvc"
    return this
  }

  withReadOnly(readOnly: boolean): this {
    this.readOnly = readOnly
    return this
  }

  build(): KubernetesVolume {
    const base: KubernetesVolume = { name: this.name }

    switch (this.volumeType) {
      case "configMap":
        base.configMap = { name: this.name }
        break
      case "secret":
        base.secret = { secretName: this.name }
        break
      case "pvc":
        base.persistentVolumeClaim = {
          claimName: this.name,
          readOnly: this.readOnly,
        }
        break
      case "emptyDir":
        base.emptyDir = {}
        break
    }

    return base
  }
}

export class VolumeMountBuilder {
  private mounts: VolumeMount[] = []

  add(volumeName: string, mountPath: string, readOnly: boolean = false): this {
    this.mounts.push({ name: volumeName, mountPath, readOnly })
    return this
  }

  build(): VolumeMount[] {
    return this.mounts
  }
}
