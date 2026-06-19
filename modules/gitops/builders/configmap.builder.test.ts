import { describe, it, expect } from "bun:test"
import { ConfigMapBuilder } from "./configmap.builder"

describe("ConfigMapBuilder", () => {
  it("builds a basic ConfigMap with name and data", () => {
    const configMap = new ConfigMapBuilder("my-config", "default")
      .withData({
        DATABASE_URL: "postgres://localhost:5432/db",
        CACHE_TTL: "3600",
      })
      .build()

    expect(configMap.apiVersion).toBe("v1")
    expect(configMap.kind).toBe("ConfigMap")
    expect(configMap.metadata.name).toBe("my-config")
    expect(configMap.metadata.namespace).toBe("default")
    expect(configMap.data).toEqual({
      DATABASE_URL: "postgres://localhost:5432/db",
      CACHE_TTL: "3600",
    })
  })

  it("adds labels to ConfigMap", () => {
    const configMap = new ConfigMapBuilder("my-config", "default")
      .withLabels({ app: "my-app", environment: "production" })
      .withData({ KEY: "value" })
      .build()

    expect(configMap.metadata.labels).toEqual({
      app: "my-app",
      environment: "production",
    })
  })

  it("adds annotations to ConfigMap", () => {
    const configMap = new ConfigMapBuilder("my-config", "default")
      .withAnnotations({ description: "My config map" })
      .withData({ KEY: "value" })
      .build()

    expect(configMap.metadata.annotations).toEqual({
      description: "My config map",
    })
  })

  it("builds ConfigMap with binary data", () => {
    const binaryData = {
      "key.bin": Buffer.from("binary content").toString("base64"),
    }
    const configMap = new ConfigMapBuilder("my-config", "default")
      .withBinaryData(binaryData)
      .build()

    expect(configMap.binaryData).toBeDefined()
    expect(configMap.binaryData!["key.bin"]).toBe(
      Buffer.from("binary content").toString("base64")
    )
  })

  it("chains multiple data entries", () => {
    const configMap = new ConfigMapBuilder("my-config", "default")
      .addData("KEY1", "value1")
      .addData("KEY2", "value2")
      .build()

    expect(configMap.data).toEqual({
      KEY1: "value1",
      KEY2: "value2",
    })
  })

  it("merges data when using withData after addData", () => {
    const configMap = new ConfigMapBuilder("my-config", "default")
      .addData("KEY1", "value1")
      .withData({ KEY2: "value2", KEY3: "value3" })
      .build()

    expect(configMap.data).toEqual({
      KEY1: "value1",
      KEY2: "value2",
      KEY3: "value3",
    })
  })

  it("returns immutable copy of built ConfigMap", () => {
    const builder = new ConfigMapBuilder("my-config", "default").withData({
      KEY: "value",
    })

    const configMap1 = builder.build()
    const configMap2 = builder.build()

    expect(configMap1).toEqual(configMap2)
    expect(configMap1).not.toBe(configMap2)
  })
})
