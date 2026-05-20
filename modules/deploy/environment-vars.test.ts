import { describe, expect, it } from "bun:test"

import {
  ENV_VAR_MAX_VALUE_SIZE,
  getEnvVarPreviewValue,
  inferEnvVarTypeFromKey,
  parseDotEnvImport,
} from "@/modules/deploy/environment-vars"

describe("environment vars helpers", () => {
  it("infers secret keys", () => {
    expect(inferEnvVarTypeFromKey("APP_KEY")).toBe("secret")
    expect(inferEnvVarTypeFromKey("CACHE_STORE")).toBe("plain")
  })

  it("masks secrets in previews", () => {
    expect(
      getEnvVarPreviewValue({
        id: "env-1",
        key: "APP_KEY",
        value: "base64:abc",
        type: "secret",
      })
    ).toMatch(/^\*{8,16}$/)

    expect(
      getEnvVarPreviewValue({
        id: "env-2",
        key: "APP_NAME",
        value: "Portal",
        type: "plain",
        masked: true,
      })
    ).toBe("********")
  })

  it("parses dotenv imports and reports invalid lines", () => {
    const parsed = parseDotEnvImport(
      [
        "# app config",
        "APP_ENV=staging",
        "export APP_URL=\"https://example.test\"",
        "INVALID_LINE",
      ].join("\n")
    )

    expect(parsed.entries).toEqual([
      { key: "APP_ENV", value: "staging" },
      { key: "APP_URL", value: "https://example.test" },
    ])
    expect(parsed.errors).toEqual(["Line 4 is not a valid KEY=VALUE entry."])
  })

  it("keeps max value size stable", () => {
    expect(ENV_VAR_MAX_VALUE_SIZE).toBe(4096)
  })
})
