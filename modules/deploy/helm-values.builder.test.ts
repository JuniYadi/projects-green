import { describe, it, expect } from "bun:test"
import { buildHelmValues } from "./helm-values.builder"

describe("buildHelmValues", () => {
  it("renders image and replicaCount with default resources", () => {
    const out = buildHelmValues({
      slug: "app-test",
      imageRepository: "registry.example.com/app-test",
      imageTag: "187",
      env: [],
    })
    expect(out.app).toEqual({ name: "app-test" })
    expect(out.image).toEqual({
      repository: "registry.example.com/app-test",
      tag: "187",
    })
    expect(out.replicaCount).toBe(1)
    expect(out.resources).toEqual({
      requests: { cpu: "500m", memory: "1024Mi" },
      limits: { cpu: "1000m", memory: "4096Mi" },
    })
    expect(out.env).toBeUndefined()
    expect(out.secrets).toBeUndefined()
    expect(out.simpleIngress).toBeUndefined()
  })

  it("uses provided cpu/memory and applies resource floors", () => {
    const out = buildHelmValues({
      slug: "app-test",
      imageRepository: "r",
      imageTag: "1",
      env: [],
      cpu: 100,
      memory: 256,
    })
    expect(out.resources).toEqual({
      requests: { cpu: "100m", memory: "256Mi" },
      limits: { cpu: "1000m", memory: "4096Mi" },
    })
  })

  it("respects explicit replicas", () => {
    const out = buildHelmValues({
      slug: "s",
      imageRepository: "r",
      imageTag: "1",
      env: [],
      replicas: 3,
    })
    expect(out.replicaCount).toBe(3)
  })

  it("splits plain env and secret env by type", () => {
    const out = buildHelmValues({
      slug: "s",
      imageRepository: "r",
      imageTag: "1",
      env: [
        { key: "NODE_ENV", value: "production" },
        { key: "API_KEY", value: "shhh", type: "secret" },
      ],
    })
    expect(out.env).toEqual({ NODE_ENV: "production" })
    expect(out.secrets).toEqual({ API_KEY: "shhh" })
  })

  it("emits simpleIngress when domain provided", () => {
    const out = buildHelmValues({
      slug: "s",
      imageRepository: "r",
      imageTag: "1",
      env: [],
      domain: "example.com",
    })
    expect(out.simpleIngress).toEqual([
      {
        enabled: true,
        domain: "example.com",
        tls: true,
        className: "haproxy",
        certManager: { enabled: true, issuer: "production" },
      },
    ])
  })

  it("omits env, secrets, and simpleIngress when not applicable", () => {
    const out = buildHelmValues({
      slug: "s",
      imageRepository: "r",
      imageTag: "1",
      env: [],
    })
    expect("env" in out).toBe(false)
    expect("secrets" in out).toBe(false)
    expect("simpleIngress" in out).toBe(false)
  })
})
