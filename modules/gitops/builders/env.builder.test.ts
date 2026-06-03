import { describe, it, expect } from "bun:test"
import { EnvBuilder } from "./env.builder"

describe("EnvBuilder", () => {
  it("adds simple env vars (HasEnv equivalent)", () => {
    const builder = new EnvBuilder()
    builder.addVar("NODE_ENV", "production")
    builder.addVar("PORT", "3000")

    const envVars = builder.build()

    expect(envVars).toEqual([
      { name: "NODE_ENV", value: "production" },
      { name: "PORT", value: "3000" },
    ])
  })

  it("adds env vars from ConfigMap (HasEnvFromConfigMap equivalent)", () => {
    const builder = new EnvBuilder()
    builder.addFromConfigMap("my-config", [
      { key: "DATABASE_URL", optional: false },
      { key: "CACHE_TTL", optional: true },
    ])

    const envFrom = builder.buildEnvFrom()

    expect(envFrom).toContainEqual({
      configMapRef: {
        name: "my-config",
        items: [
          { key: "DATABASE_URL", optional: false },
          { key: "CACHE_TTL", optional: true },
        ],
      },
    })
  })

  it("adds env vars from Secret (HasEnvFromSecret equivalent)", () => {
    const builder = new EnvBuilder()
    builder.addFromSecret("my-secret", [
      { key: "API_KEY", optional: false },
      { key: "DEBUG_TOKEN", optional: true },
    ])

    const envFrom = builder.buildEnvFrom()

    expect(envFrom).toContainEqual({
      secretRef: {
        name: "my-secret",
        items: [
          { key: "API_KEY", optional: false },
          { key: "DEBUG_TOKEN", optional: true },
        ],
      },
    })
  })

  it("combines env vars and envFrom", () => {
    const builder = new EnvBuilder()
    builder.addVar("LOG_LEVEL", "info")
    builder.addFromConfigMap("app-config", [{ key: "DATABASE_URL" }])

    expect(builder.build()).toEqual([{ name: "LOG_LEVEL", value: "info" }])
    expect(builder.buildEnvFrom()).toContainEqual({ configMapRef: { name: "app-config", items: [{ key: "DATABASE_URL" }] } })
  })
})