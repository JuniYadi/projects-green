import { describe, it, expect } from "bun:test"
import { HpaBuilder } from "./hpa.builder"

describe("HpaBuilder", () => {
  it("generates HPA with CPU metric only", () => {
    const hpa = new HpaBuilder()
      .setName("my-app-hpa")
      .setNamespace("production")
      .setTarget({
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: "my-app",
      })
      .setMinReplicas(2)
      .setMaxReplicas(10)
      .withCpuTarget(75)
      .build()

    expect(hpa.apiVersion).toBe("autoscaling/v2")
    expect(hpa.kind).toBe("HorizontalPodAutoscaler")
    expect(hpa.metadata.name).toBe("my-app-hpa")
    expect(hpa.metadata.namespace).toBe("production")
    expect(hpa.spec.scaleTargetRef.apiVersion).toBe("apps/v1")
    expect(hpa.spec.scaleTargetRef.kind).toBe("Deployment")
    expect(hpa.spec.scaleTargetRef.name).toBe("my-app")
    expect(hpa.spec.minReplicas).toBe(2)
    expect(hpa.spec.maxReplicas).toBe(10)
    expect(hpa.spec.metrics).toContainEqual({
      type: "Resource",
      resource: {
        name: "cpu",
        target: {
          type: "Utilization",
          averageUtilization: 75,
        },
      },
    })
  })

  it("generates HPA with memory metric only", () => {
    const hpa = new HpaBuilder()
      .setName("my-app-hpa")
      .setNamespace("default")
      .setTarget({
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: "my-app",
      })
      .setMinReplicas(1)
      .setMaxReplicas(5)
      .withMemoryTarget(256)
      .build()

    expect(hpa.spec.metrics).toContainEqual({
      type: "Resource",
      resource: {
        name: "memory",
        target: {
          type: "AverageValue",
          averageValue: "256Mi",
        },
      },
    })
  })

  it("generates HPA with both CPU and memory metrics", () => {
    const hpa = new HpaBuilder()
      .setName("my-app-hpa")
      .setNamespace("staging")
      .setTarget({
        apiVersion: "apps/v1",
        kind: "StatefulSet",
        name: "my-stateful-app",
      })
      .setMinReplicas(3)
      .setMaxReplicas(20)
      .withCpuTarget(60)
      .withMemoryTarget(512)
      .build()

    expect(hpa.spec.metrics).toHaveLength(2)
    expect(hpa.spec.metrics).toContainEqual({
      type: "Resource",
      resource: {
        name: "cpu",
        target: {
          type: "Utilization",
          averageUtilization: 60,
        },
      },
    })
    expect(hpa.spec.metrics).toContainEqual({
      type: "Resource",
      resource: {
        name: "memory",
        target: {
          type: "AverageValue",
          averageValue: "512Mi",
        },
      },
    })
  })

  it("applies custom labels", () => {
    const hpa = new HpaBuilder()
      .setName("my-app-hpa")
      .setTarget({
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: "my-app",
      })
      .setMinReplicas(1)
      .setMaxReplicas(5)
      .withCpuTarget(80)
      .withLabels({ team: "platform", app: "my-app" })
      .build()

    expect(hpa.metadata.labels).toEqual({ team: "platform", app: "my-app" })
  })

  it("uses default namespace when not specified", () => {
    const hpa = new HpaBuilder()
      .setName("my-app-hpa")
      .setTarget({
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: "my-app",
      })
      .setMinReplicas(1)
      .setMaxReplicas(5)
      .withCpuTarget(80)
      .build()

    expect(hpa.metadata.namespace).toBe("default")
  })

  it("throws error when built without metrics", () => {
    const builder = new HpaBuilder()
      .setName("my-app-hpa")
      .setTarget({
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: "my-app",
      })
      .setMinReplicas(1)
      .setMaxReplicas(5)

    expect(() => builder.build()).toThrow("At least one metric must be configured")
  })

  it("throws error when maxReplicas is less than minReplicas", () => {
    const builder = new HpaBuilder()
      .setName("my-app-hpa")
      .setTarget({
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: "my-app",
      })
      .setMinReplicas(10)
      .setMaxReplicas(5)
      .withCpuTarget(80)

    expect(() => builder.build()).toThrow("maxReplicas must be >= minReplicas")
  })
})
