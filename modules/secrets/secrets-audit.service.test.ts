import { beforeEach, describe, expect, it, mock } from "bun:test"

const create = mock(async () => undefined)
const mockConsoleError = mock(() => {})
console.error = mockConsoleError
mock.module("@/lib/prisma", () => ({
  prisma: { vaultSecretAuditLog: { create } },
}))

const { logVaultSecretReveal } = await import("./secrets-audit.service")

describe("logVaultSecretReveal", () => {
  beforeEach(() => {
    create.mockClear()
    create.mockResolvedValue(undefined)
    mockConsoleError.mockClear()
  })

  it("persists reveal metadata without a secret value", async () => {
    await logVaultSecretReveal({
      organizationId: "org-1",
      stackId: "stack-1",
      workosUserId: "user-1",
      environment: "prod",
      secretKey: "API_KEY",
    })

    expect(create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        stackId: "stack-1",
        workosUserId: "user-1",
        environment: "prod",
        secretKey: "API_KEY",
        action: "SECRET_REVEALED",
      },
    })
    expect(JSON.stringify(create.mock.calls[0])).not.toContain("secret-value")
  })

  it("propagates audit persistence failures to caller", async () => {
    create.mockRejectedValue(new Error("database unavailable"))

    await expect(
      logVaultSecretReveal({
        organizationId: "org-1",
        stackId: "stack-1",
        workosUserId: "user-1",
        environment: "prod",
        secretKey: "API_KEY",
      })
    ).rejects.toThrow("database unavailable")
  })
})
