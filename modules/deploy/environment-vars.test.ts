import { describe, expect, it } from "bun:test"

import {
  ENV_VAR_MAX_VALUE_SIZE,
  getEnvVarPreviewValue,
  inferEnvVarTypeFromKey,
  parseDotEnvImport,
} from "@/modules/deploy/environment-vars"

describe("environment vars helpers", () => {
  it("infers secret keys", () => {
    expect(inferEnvVarTypeFromKey("APP_KEY")).toBe("secret_ref")
    expect(inferEnvVarTypeFromKey("DB_CREDENTIAL")).toBe("secret_ref")
    expect(inferEnvVarTypeFromKey("CACHE_STORE")).toBe("plain")
  })

  it("masks secrets in previews", () => {
    expect(
      getEnvVarPreviewValue({
        id: "env-1",
        key: "APP_KEY",
        value: "base64:abc",
        type: "secret_ref",
      })
    ).toBe("••••••••")

    expect(
      getEnvVarPreviewValue({
        id: "env-2",
        key: "APP_NAME",
        value: "Portal",
        type: "plain",
        masked: true,
      })
    ).toBe("••••••••")
  })

  it("parses dotenv imports and reports invalid lines", () => {
    const parsed = parseDotEnvImport(
      [
        "# app config",
        "APP_ENV=staging",
        'export APP_URL="https://example.test"',
        "INVALID_LINE",
      ].join("\n")
    )

    expect(parsed.entries).toEqual([
      { key: "APP_ENV", value: "staging", type: "plain" },
      {
        key: "APP_URL",
        value: "https://example.test",
        type: "plain",
      },
    ])
    expect(parsed.errors).toEqual(["Line 4 is not a valid KEY=VALUE entry."])
  })

  it("rejects invalid dotenv keys before import", () => {
    const parsed = parseDotEnvImport("bad-key=value")

    expect(parsed.entries).toEqual([])
    expect(parsed.errors[0]).toContain("Line 1 has an invalid key")
  })

  it("rejects dotenv values over the environment limit", () => {
    const parsed = parseDotEnvImport(
      `BIG_VALUE=${"a".repeat(ENV_VAR_MAX_VALUE_SIZE + 1)}`
    )

    expect(parsed.entries).toEqual([])
    expect(parsed.errors[0]).toContain("Line 1 value cannot exceed")
  })

  it("keeps max value size stable", () => {
    expect(ENV_VAR_MAX_VALUE_SIZE).toBe(4096)
  })
})
