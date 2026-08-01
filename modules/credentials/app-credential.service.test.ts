import { beforeEach, describe, expect, it, mock } from "bun:test"

type AppCredentialRow = {
  id: string
  organizationId: string
  type: string
  name: string
  metadata: unknown
  encryptedJSON: string
  maskedPreview: string
  status?: string
  createdAt?: Date
}

type ListedCredentialRow = {
  id: string
  type: string
  name: string
  metadata: unknown
  maskedPreview: string
  status: string
  createdAt: Date
  updatedAt: Date
}

const store = new Map<string, AppCredentialRow>()
const mockFindMany = mock(async (): Promise<ListedCredentialRow[]> => [])

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
      findMany: mockFindMany,
      upsert: mockUpsert,
    },
  },
}))

import {
  listActiveGithubAppAccounts,
  upsertGithubAppCredential,
} from "./app-credential.service"

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

describe("listActiveGithubAppAccounts", () => {
  beforeEach(() => {
    mockFindMany.mockClear()
    mockFindMany.mockImplementation(async () => [])
  })

  it("maps active valid metadata and excludes secrets", async () => {
    const createdAt = new Date("2026-06-01T12:34:56.000Z")
    mockFindMany.mockImplementation(async () => [
      {
        id: "cred_active",
        type: "GITHUB_APP",
        name: "acme",
        metadata: {
          githubInstallationId: 901,
          accountLogin: "acme",
          accountType: "Organization",
          targetType: "Organization",
          permissions: [],
          events: [],
        },
        maskedPreview: "ghs_***…1234",
        status: "ACTIVE",
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: "cred_personal",
        type: "GITHUB_APP",
        name: "octocat",
        metadata: {
          githubInstallationId: 902,
          accountLogin: "octocat",
          permissions: [],
          events: [],
        },
        maskedPreview: "ghs_***…5678",
        status: "ACTIVE",
        createdAt,
        updatedAt: createdAt,
      },
    ])

    const result = await listActiveGithubAppAccounts("org_123")

    expect(result).toEqual([
      {
        id: "cred_active",
        githubInstallationId: 901,
        accountLogin: "acme",
        accountType: "Organization",
        targetType: "Organization",
        installedAt: createdAt.toISOString(),
      },
      {
        id: "cred_personal",
        githubInstallationId: 902,
        accountLogin: "octocat",
        accountType: null,
        targetType: null,
        installedAt: createdAt.toISOString(),
      },
    ])
    expect(result[0]).not.toHaveProperty("encryptedJSON")
    expect(result[0]).not.toHaveProperty("maskedPreview")
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { organizationId: "org_123", type: "GITHUB_APP" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        name: true,
        metadata: true,
        maskedPreview: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  })

  it("omits revoked and malformed metadata rows", async () => {
    const createdAt = new Date("2026-06-01T12:34:56.000Z")
    mockFindMany.mockImplementation(async () => [
      {
        id: "cred_revoked",
        type: "GITHUB_APP",
        name: "revoked",
        metadata: {
          githubInstallationId: 902,
          accountLogin: "revoked",
          permissions: [],
          events: [],
        },
        maskedPreview: "ghs_***…1234",
        status: "REVOKED",
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: "cred_malformed",
        type: "GITHUB_APP",
        name: "malformed",
        metadata: { githubInstallationId: "not-a-number" },
        maskedPreview: "ghs_***…5678",
        status: "ACTIVE",
        createdAt,
        updatedAt: createdAt,
      },
    ])

    await expect(listActiveGithubAppAccounts("org_123")).resolves.toEqual([])
  })
})
