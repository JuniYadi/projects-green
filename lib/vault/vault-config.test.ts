import { describe, expect, it } from "bun:test"

import { VaultConfigError, parseVaultConfig } from "./vault-config"

const validEnvironment = {
  VAULT_ADDR: "https://vault.example.test:8200/",
  VAULT_ROLE_ID: "role-id",
  VAULT_SECRET_ID: "secret-id",
}

describe("parseVaultConfig", () => {
  it("parses required values and applies safe defaults", () => {
    expect(parseVaultConfig(validEnvironment)).toEqual({
      address: "https://vault.example.test:8200",
      roleId: "role-id",
      secretId: "secret-id",
      namespace: undefined,
      mountPath: "secret",
      tokenRenewBufferSeconds: 300,
    })
  })

  it("parses optional namespace and renewal buffer values", () => {
    expect(
      parseVaultConfig({
        ...validEnvironment,
        VAULT_NAMESPACE: "admin/team",
        VAULT_MOUNT_PATH: "pfnapp",
        VAULT_TOKEN_RENEW_BUFFER_SECONDS: "45",
      })
    ).toMatchObject({
      namespace: "admin/team",
      mountPath: "pfnapp",
      tokenRenewBufferSeconds: 45,
    })
  })

  it("rejects missing credentials and unsafe mount paths", () => {
    expect(() =>
      parseVaultConfig({
        ...validEnvironment,
        VAULT_ROLE_ID: "",
        VAULT_MOUNT_PATH: "secret/data",
      })
    ).toThrow(VaultConfigError)
  })

  it("rejects non-http Vault addresses", () => {
    expect(() =>
      parseVaultConfig({
        ...validEnvironment,
        VAULT_ADDR: "ftp://vault.example.test",
      })
    ).toThrow("VAULT_ADDR must use http or https")
  })
})
