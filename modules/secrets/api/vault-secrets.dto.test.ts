import { describe, expect, it } from "bun:test"

import {
  toVaultSecretMetadataDTO,
  toVaultSecretReferenceDTO,
  toVaultSecretRevealDTO,
  toVaultSecretWriteDTO,
} from "./vault-secrets.dto"

const reference = {
  key: "API_KEY",
  type: "secret_ref" as const,
  environment: "prod",
  vaultPath: "tenants/org/stacks/stack/prod/app-env",
  vaultKey: "API_KEY",
  version: 2,
  updatedAt: "2026-08-18T12:00:00.000Z",
}

describe("vault secret DTOs", () => {
  it("maps metadata without adding secret values", () => {
    expect(toVaultSecretReferenceDTO(reference)).toEqual(reference)
    expect(
      toVaultSecretMetadataDTO({
        environment: "prod",
        vaultPath: reference.vaultPath,
        references: [reference],
      })
    ).toEqual({
      environment: "prod",
      vaultPath: reference.vaultPath,
      references: [reference],
    })
  })

  it("maps write and explicit reveal responses", () => {
    expect(
      toVaultSecretWriteDTO({
        environment: "prod",
        vaultPath: reference.vaultPath,
        version: 2,
        updatedAt: reference.updatedAt,
        references: [reference],
      })
    ).toMatchObject({ version: 2, references: [reference] })
    expect(
      toVaultSecretRevealDTO({
        environment: "prod",
        key: "API_KEY",
        value: "secret-value",
        version: 2,
        vaultPath: reference.vaultPath,
      })
    ).toEqual({
      environment: "prod",
      key: "API_KEY",
      value: "secret-value",
      version: 2,
      vaultPath: reference.vaultPath,
    })
  })
})
