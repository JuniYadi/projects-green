import { describe, expect, it, mock } from "bun:test"

mock.module("@/lib/prisma", () => ({ prisma: {} }))

import { createVaultSecretsRoutes, vaultSecretsRoutes } from "./index"

describe("secrets API exports", () => {
  it("exports the route factory and default route", () => {
    expect(createVaultSecretsRoutes).toBeFunction()
    expect(vaultSecretsRoutes).toBeDefined()
  })
})
