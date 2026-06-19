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

    expect(deployment.spec.template.spec.containers[0].env).toContainEqual({
      name: "NODE_ENV",
      value: "production",
    })
    expect(deployment.spec.template.spec.containers[0].envFrom).toContainEqual({
      configMapRef: { name: "app-config", items: [{ key: "DATABASE_URL" }] },
    })
    expect(deployment.spec.template.spec.containers[0].envFrom).toContainEqual({
      secretRef: { name: "app-secrets", items: [{ key: "API_KEY" }] },
    })
    expect(
      deployment.spec.template.spec.containers[0].volumeMounts
    ).toContainEqual({
      name: "config",
      mountPath: "/etc/config",
      readOnly: false,
    })
    expect(
      deployment.spec.template.spec.containers[0].volumeMounts
    ).toContainEqual({
      name: "secrets",
      mountPath: "/etc/secrets",
      readOnly: true,
    })
    expect(deployment.metadata.annotations!["reloader.stakater.com/auto"]).toBe(
      "true"
    )
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
    expect(
      deployment.metadata.annotations?.[
        "autoscaling.kubernetes.io/current-replicas"
      ]
    ).toBeUndefined()
  })

  it("creates deployment with custom replicas and health check path", () => {
    const deployment = new DeploymentBuilder()
      .setName("my-app")
      .setNamespace("default")
      .setImage("nginx:latest")
      .setPort(8080)
      .setReplicas(3)
      .setHealthCheckPath("/ready")
      .build()

    expect(deployment.spec.replicas).toBe(3)
    expect(deployment.spec.template.spec.containers[0].livenessProbe).toEqual({
      httpGet: { path: "/ready", port: 8080 },
      initialDelaySeconds: 15,
      periodSeconds: 10,
    })
    expect(deployment.spec.template.spec.containers[0].readinessProbe).toEqual({
      httpGet: { path: "/ready", port: 8080 },
      initialDelaySeconds: 5,
      periodSeconds: 5,
    })
  })

  it("buildHPA returns null when no HPA settings configured", () => {
    const builder = new DeploymentBuilder()
      .setName("my-app")
      .setNamespace("default")
      .setImage("nginx:latest")
      .setPort(80)

    expect(builder.buildHPA()).toBeNull()
  })

  it("buildHPA with CPU and memory metrics", () => {
    const builder = new DeploymentBuilder()
      .setName("my-app")
      .setNamespace("default")
      .setImage("nginx:latest")
      .setPort(80)
      .setHPAMinReplicas(2)
      .setHPAMaxReplicas(10)
      .setHPATargetCPUUtilization(70)
      .setHPATargetMemoryUtilization(80)

    const hpa = builder.buildHPA()

    expect(hpa).not.toBeNull()
    expect(hpa!.spec.minReplicas).toBe(2)
    expect(hpa!.spec.maxReplicas).toBe(10)
    expect(hpa!.spec.metrics).toHaveLength(2)
    expect(hpa!.spec.metrics).toContainEqual({
      type: "Resource",
      resource: {
        name: "cpu",
        target: { type: "Utilization", averageUtilization: 70 },
      },
    })
    expect(hpa!.spec.metrics).toContainEqual({
      type: "Resource",
      resource: {
        name: "memory",
        target: { type: "AverageValue", averageValue: "80Mi" },
      },
    })
  })
})
