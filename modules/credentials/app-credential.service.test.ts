import { beforeEach, describe, expect, it, mock } from "bun:test"

type AppCredentialRow = {
  id: string
  organizationId: string
  type: string
  name: string
  metadata: unknown
  encryptedJSON: string
  maskedPreview: string
}

const store = new Map<string, AppCredentialRow>()

const mockUpsert = mock(
  async ({
    where,
    create,
    update,
  }: {
    where: {
      organizationId_type_name: {
        organizationId: string
        type: string
        name: string
      }
    }
    create: Omit<AppCredentialRow, "id">
    update: Partial<AppCredentialRow>
  }) => {
    const key = JSON.stringify(where.organizationId_type_name)
    const existing = store.get(key)
    const row: AppCredentialRow = existing
      ? { ...existing, ...update }
      : { id: `cred_${store.size + 1}`, ...create }
    store.set(key, row)
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      metadata: row.metadata,
      maskedPreview: row.maskedPreview,
      status: "ACTIVE",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }
  }
)

mock.module("@/lib/prisma", () => ({
  prisma: {
    appCredential: {
      upsert: mockUpsert,
    },
  },
}))

import { upsertGithubAppCredential } from "./app-credential.service"

describe("upsertGithubAppCredential", () => {
  beforeEach(() => {
    store.clear()
    mockUpsert.mockClear()
  })

  it("creates a GITHUB_APP credential on first install", async () => {
    const result = await upsertGithubAppCredential({
      organizationId: "org_123",
      githubInstallationId: 123,
      accountLogin: "acme",
      accountType: "Organization",
      targetType: "Organization",
      permissions: ["contents:read"],
      events: ["push"],
    })

    expect(result.type).toBe("GITHUB_APP")
    expect(result.name).toBe("acme")
    expect(result.metadata).toMatchObject({
      githubInstallationId: 123,
      accountLogin: "acme",
      accountType: "Organization",
      targetType: "Organization",
      permissions: ["contents:read"],
      events: ["push"],
    })
    expect(mockUpsert).toHaveBeenCalledTimes(1)
  })

  it("updates the same row in place on reinstall/repermission", async () => {
    const first = await upsertGithubAppCredential({
      organizationId: "org_123",
      githubInstallationId: 123,
      accountLogin: "acme",
      accountType: "Organization",
      targetType: "Organization",
      permissions: ["contents:read"],
      events: ["push"],
    })

    const second = await upsertGithubAppCredential({
      organizationId: "org_123",
      githubInstallationId: 123,
      accountLogin: "acme",
      accountType: "Organization",
      targetType: "Organization",
      permissions: ["contents:read", "issues:write"],
      events: ["push", "pull_request"],
    })

    expect(second.id).toBe(first.id)
    expect(second.metadata).toMatchObject({
      permissions: ["contents:read", "issues:write"],
      events: ["push", "pull_request"],
    })
    expect(store.size).toBe(1)
    expect(mockUpsert).toHaveBeenCalledTimes(2)
  })
})
