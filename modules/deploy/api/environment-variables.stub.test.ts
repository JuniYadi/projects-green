import { beforeEach, describe, expect, it } from "bun:test"

import {
  __testables,
  createEnvironmentVariable,
  updateEnvironmentVariable,
} from "@/modules/deploy/api/environment-variables.stub"
import { ENV_VAR_MAX_VALUE_SIZE } from "@/modules/deploy/environment-vars"

describe("environment variable stub validation", () => {
  beforeEach(() => {
    __testables.resetStore()
  })

  it("blocks invalid key format", () => {
    const result = createEnvironmentVariable({
      environmentId: "staging",
      key: "bad-key",
      value: "value",
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.error).toBe("INVALID_KEY")
  })

  it("blocks duplicate keys in one environment", () => {
    const first = createEnvironmentVariable({
      environmentId: "staging",
      key: "APP_ENV",
      value: "staging",
    })
    expect(first.ok).toBe(true)

    const second = createEnvironmentVariable({
      environmentId: "staging",
      key: "APP_ENV",
      value: "production",
    })

    expect(second.ok).toBe(false)
    if (second.ok) {
      return
    }

    expect(second.error).toBe("DUPLICATE_KEY")
  })

  it("blocks oversize values", () => {
    const result = createEnvironmentVariable({
      environmentId: "staging",
      key: "BIG_VALUE",
      value: "a".repeat(ENV_VAR_MAX_VALUE_SIZE + 1),
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.error).toBe("VALUE_TOO_LARGE")
  })

  it("preserves stored Vault metadata when a secret value is not rotated", () => {
    const created = createEnvironmentVariable({
      environmentId: "staging",
      key: "DATABASE_PASSWORD",
      value: "initial-secret",
      type: "secret_ref",
    })

    expect(created.ok).toBe(true)
    if (!created.ok || !created.item) {
      return
    }

    created.item.source = "vault"
    created.item.vaultPath = "tenants/org-1/stacks/stack-1/prod/app-env"
    created.item.vaultKey = "DATABASE_PASSWORD"
    created.item.version = 3
    const lastUpdatedAt = created.item.lastUpdatedAt

    const updated = updateEnvironmentVariable({
      environmentId: "staging",
      variableId: created.item.id,
      key: "DATABASE_PASSWORD",
      type: "secret_ref",
    })

    expect(updated.ok).toBe(true)
    if (updated.ok) {
      expect(updated.item).toMatchObject({
        source: "vault",
        vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
        vaultKey: "DATABASE_PASSWORD",
        version: 3,
        lastUpdatedAt,
      })
    }
  })
})
