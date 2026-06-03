import { describe, it, expect } from "bun:test"
import { DeploymentBuilder } from "./deployment.builder"

describe("DeploymentBuilder", () => {
  it("creates deployment with env vars and volume mounts", () => {
    const deployment = new DeploymentBuilder()
      .setName("my-app")
      .setNamespace("default")
      .setImage("nginx:latest")
      .setPort(80)
      .addEnvVar("NODE_ENV", "production")
      .addEnvFromConfigMap("app-config", [{ key: "DATABASE_URL" }])
      .addEnvFromSecret("app-secrets", [{ key: "API_KEY" }])
      .addVolumeMount("config", "/etc/config")
      .addVolumeMount("secrets", "/etc/secrets", true)
      .addReloaderAnnotation()
      .build()

    expect(deployment.spec.template.spec.containers[0].env).toContainEqual(
      { name: "NODE_ENV", value: "production" }
    )
    expect(deployment.spec.template.spec.containers[0].envFrom).toContainEqual({
      configMapRef: { name: "app-config", items: [{ key: "DATABASE_URL" }] },
    })
    expect(deployment.spec.template.spec.containers[0].envFrom).toContainEqual({
      secretRef: { name: "app-secrets", items: [{ key: "API_KEY" }] },
    })
    expect(deployment.spec.template.spec.containers[0].volumeMounts).toContainEqual(
      { name: "config", mountPath: "/etc/config", readOnly: false }
    )
    expect(deployment.spec.template.spec.containers[0].volumeMounts).toContainEqual(
      { name: "secrets", mountPath: "/etc/secrets", readOnly: true }
    )
    expect(deployment.metadata.annotations!["reloader.stakater.com/auto"]).toBe("true")
  })

  it("creates deployment with volumes and HPA", () => {
    const deployment = new DeploymentBuilder()
      .setName("my-app")
      .setNamespace("default")
      .setImage("nginx:latest")
      .setPort(80)
      .addVolume("config", { configMap: { name: "my-config" } })
      .setHPAMinReplicas(2)
      .setHPAMaxReplicas(10)
      .setHPATargetCPUUtilization(70)
      .build()

    expect(deployment.spec.template.spec.volumes).toContainEqual({
      name: "config",
      configMap: { name: "my-config" },
    })
    expect(deployment.metadata.annotations?.["autoscaling.kubernetes.io/current-replicas"]).toBeUndefined()
  })
})