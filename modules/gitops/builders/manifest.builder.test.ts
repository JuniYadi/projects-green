import { describe, it, expect } from "bun:test"
import { AppManifestBuilder } from "./manifest.builder"
import type { KubernetesConfigMap } from "./configmap.builder"
import type { KubernetesSecret } from "./secret.builder"
import type { KubernetesDeployment, KubernetesHPA } from "./deployment.builder"

describe("AppManifestBuilder", () => {
  it("generates full manifest with ConfigMap, Secret, Deployment, HPA", () => {
    const manifest = new AppManifestBuilder()
      .setAppName("my-app")
      .setTeamSlug("my-team")
      .setNamespace("default")
      .setImage("nginx:latest")
      .addConfigMapData({
        DATABASE_URL: "postgres://localhost",
        CACHE_TTL: "3600",
      })
      .addSecretData({ API_KEY: "secret123" })
      .addReloaderAnnotation()
      .setHPAMinReplicas(2)
      .setHPAMaxReplicas(10)
      .setHPATargetCPUUtilization(70)
      .build()

    expect(manifest.appName).toBe("my-app")
    expect(manifest.resources).toHaveLength(4) // ConfigMap, Secret, Deployment, HPA

    const configMap = manifest.resources.find(
      (r) => r.kind === "ConfigMap"
    )! as unknown as KubernetesConfigMap
    expect(configMap.metadata.name).toBe("my-app-config")
    expect(configMap.data).toEqual({
      DATABASE_URL: "postgres://localhost",
      CACHE_TTL: "3600",
    })

    const secret = manifest.resources.find(
      (r) => r.kind === "Secret"
    )! as unknown as KubernetesSecret
    expect(secret.metadata.name).toBe("my-app-secret")
    expect(secret.data).toBeDefined() // base64 encoded

    const deployment = manifest.resources.find(
      (r) => r.kind === "Deployment"
    )! as unknown as KubernetesDeployment
    expect(deployment).toBeDefined()
    expect(deployment.spec.template.spec.containers[0].envFrom).toHaveLength(2)

    const hpa = manifest.resources.find(
      (r) => r.kind === "HorizontalPodAutoscaler"
    )! as unknown as KubernetesHPA
    expect(hpa).toBeDefined()
    expect(hpa.spec.minReplicas).toBe(2)
    expect(hpa.spec.maxReplicas).toBe(10)
  })

  it("generates manifest with volume mounts", () => {
    const manifest = new AppManifestBuilder()
      .setAppName("my-app")
      .setTeamSlug("my-team")
      .setNamespace("default")
      .setImage("nginx:latest")
      .addConfigMapVolume("app-config", "/etc/config")
      .addSecretVolume("app-secrets", "/etc/secrets")
      .addPVCVolume("data-pvc", "/data")
      .build()

    expect(manifest.resources).toHaveLength(2) // Deployment + Service (no HPA by default)

    const deployment = manifest.resources.find(
      (r) => r.kind === "Deployment"
    )! as unknown as KubernetesDeployment
    const volumes = deployment.spec.template.spec.volumes
    expect(volumes).toContainEqual({
      name: "app-config",
      configMap: { name: "app-config" },
    })
    expect(volumes).toContainEqual({
      name: "app-secrets",
      secret: { secretName: "app-secrets" },
    })
    expect(volumes).toContainEqual({
      name: "data-pvc",
      persistentVolumeClaim: { claimName: "data-pvc" },
    })
  })

  it("generates manifest with custom port and HPA memory metric", () => {
    const manifest = new AppManifestBuilder()
      .setAppName("my-app")
      .setTeamSlug("my-team")
      .setNamespace("default")
      .setImage("nginx:latest")
      .setPort(8080)
      .setHPAMinReplicas(1)
      .setHPAMaxReplicas(5)
      .setHPATargetCPUUtilization(60)
      .setHPATargetMemoryUtilization(512)
      .build()

    expect(manifest.resources).toHaveLength(2) // Deployment + HPA

    const deployment = manifest.resources.find(
      (r) => r.kind === "Deployment"
    )! as unknown as KubernetesDeployment
    expect(deployment.spec.template.spec.containers[0].ports).toEqual([
      { containerPort: 8080 },
    ])

    const hpa = manifest.resources.find(
      (r) => r.kind === "HorizontalPodAutoscaler"
    )! as unknown as KubernetesHPA
    expect(hpa.spec.minReplicas).toBe(1)
    expect(hpa.spec.maxReplicas).toBe(5)
    expect(hpa.spec.metrics).toHaveLength(2)
  })
})
