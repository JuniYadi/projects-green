import type { AppManifest, KubernetesResource } from "../gitops.types"
import { ConfigMapBuilder } from "./configmap.builder"
import { SecretBuilder } from "./secret.builder"
import { DeploymentBuilder } from "./deployment.builder"
import { HpaBuilder } from "./hpa.builder"
import { VolumeMountBuilder } from "./volume.builder"

export class AppManifestBuilder {
  private appName: string = ""
  private teamSlug: string = ""
  private namespace: string = "default"
  private image: string = ""
  private port: number = 80

  private configMapData: Record<string, string> = {}
  private secretData: Record<string, string> = {}
  private addReloader: boolean = false

  private volumes: Array<{
    name: string
    mountPath: string
    type: "configMap" | "secret" | "pvc"
    readOnly?: boolean
  }> = []

  private hpaMinReplicas?: number
  private hpaMaxReplicas?: number
  private hpaTargetCPUUtilization?: number
  private hpaTargetMemoryMi?: number

  setAppName(name: string): this {
    this.appName = name
    return this
  }

  setTeamSlug(slug: string): this {
    this.teamSlug = slug
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

  addConfigMapData(data: Record<string, string>): this {
    this.configMapData = { ...this.configMapData, ...data }
    return this
  }

  addSecretData(data: Record<string, string>): this {
    this.secretData = { ...this.secretData, ...data }
    return this
  }

  addReloaderAnnotation(): this {
    this.addReloader = true
    return this
  }

  addConfigMapVolume(
    name: string,
    mountPath: string,
    readOnly: boolean = false
  ): this {
    this.volumes.push({ name, mountPath, type: "configMap", readOnly })
    return this
  }

  addSecretVolume(
    name: string,
    mountPath: string,
    readOnly: boolean = true
  ): this {
    this.volumes.push({ name, mountPath, type: "secret", readOnly })
    return this
  }

  addPVCVolume(
    name: string,
    mountPath: string,
    readOnly: boolean = false
  ): this {
    this.volumes.push({ name, mountPath, type: "pvc", readOnly })
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

  setHPATargetMemoryUtilization(memoryMi: number): this {
    this.hpaTargetMemoryMi = memoryMi
    return this
  }

  build(): AppManifest {
    const resources: KubernetesResource[] = []

    if (Object.keys(this.configMapData).length > 0) {
      const configMap = new ConfigMapBuilder(
        `${this.appName}-config`,
        this.namespace
      ).withData(this.configMapData)
      if (this.addReloader) {
        configMap.withAnnotations({ "reloader.stakater.com/auto": "true" })
      }
      resources.push(configMap.build() as unknown as KubernetesResource)
    }

    if (Object.keys(this.secretData).length > 0) {
      const secretBuilder = new SecretBuilder()
        .setName(`${this.appName}-secret`)
        .setNamespace(this.namespace)
        .addData(this.secretData)
      if (this.addReloader) {
        secretBuilder.addReloaderAnnotation()
      }
      resources.push(secretBuilder.build() as unknown as KubernetesResource)
    }

    const volumeMountBuilder = new VolumeMountBuilder()
    for (const vol of this.volumes) {
      volumeMountBuilder.add(vol.name, vol.mountPath, vol.readOnly)
    }

    const deploymentBuilder = new DeploymentBuilder()
      .setName(this.appName)
      .setNamespace(this.namespace)
      .setImage(this.image)
      .setPort(this.port)

    if (Object.keys(this.configMapData).length > 0) {
      deploymentBuilder.addEnvFromConfigMap(`${this.appName}-config`, [
        ...Object.keys(this.configMapData).map((key) => ({ key })),
      ])
    }

    if (Object.keys(this.secretData).length > 0) {
      deploymentBuilder.addEnvFromSecret(`${this.appName}-secret`, [
        ...Object.keys(this.secretData).map((key) => ({ key })),
      ])
    }

    for (const vol of this.volumes) {
      deploymentBuilder.addVolumeMount(vol.name, vol.mountPath, vol.readOnly)
      const volumeConfig: Record<string, unknown> = {}
      if (vol.type === "configMap") {
        volumeConfig.configMap = { name: vol.name }
      } else if (vol.type === "secret") {
        volumeConfig.secret = { secretName: vol.name }
      } else if (vol.type === "pvc") {
        volumeConfig.persistentVolumeClaim = { claimName: vol.name }
      }
      deploymentBuilder.addVolume(vol.name, volumeConfig)
    }

    if (this.addReloader) {
      deploymentBuilder.addReloaderAnnotation()
    }

    if (this.hpaMinReplicas !== undefined) {
      deploymentBuilder.setHPAMinReplicas(this.hpaMinReplicas)
    }
    if (this.hpaMaxReplicas !== undefined) {
      deploymentBuilder.setHPAMaxReplicas(this.hpaMaxReplicas)
    }
    if (this.hpaTargetCPUUtilization !== undefined) {
      deploymentBuilder.setHPATargetCPUUtilization(this.hpaTargetCPUUtilization)
    }
    if (this.hpaTargetMemoryMi !== undefined) {
      deploymentBuilder.setHPATargetMemoryUtilization(this.hpaTargetMemoryMi)
    }

    resources.push(deploymentBuilder.build() as unknown as KubernetesResource)

    if (
      this.hpaMinReplicas === undefined &&
      this.hpaTargetCPUUtilization === undefined &&
      this.hpaTargetMemoryMi === undefined
    ) {
      const service: KubernetesResource = {
        apiVersion: "v1",
        kind: "Service",
        metadata: {
          name: this.appName,
          namespace: this.namespace,
          labels: { app: this.appName },
        },
        spec: {
          ports: [{ port: this.port, targetPort: this.port }],
          selector: { app: this.appName },
        },
      }
      resources.push(service)
    }

    if (
      this.hpaMinReplicas !== undefined ||
      this.hpaTargetCPUUtilization !== undefined ||
      this.hpaTargetMemoryMi !== undefined
    ) {
      const hpaBuilder = new HpaBuilder()
        .setName(`${this.appName}-hpa`)
        .setNamespace(this.namespace)
        .setTarget({
          apiVersion: "apps/v1",
          kind: "Deployment",
          name: this.appName,
        })
        .setMinReplicas(this.hpaMinReplicas ?? 1)
        .setMaxReplicas(this.hpaMaxReplicas ?? 10)

      if (this.hpaTargetCPUUtilization !== undefined) {
        hpaBuilder.withCpuTarget(this.hpaTargetCPUUtilization)
      }
      if (this.hpaTargetMemoryMi !== undefined) {
        hpaBuilder.withMemoryTarget(this.hpaTargetMemoryMi)
      }

      resources.push(hpaBuilder.build() as unknown as KubernetesResource)
    }

    return {
      appName: this.appName,
      teamSlug: this.teamSlug,
      namespace: this.namespace,
      resources,
    }
  }
}
