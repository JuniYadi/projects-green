/**
 * Cluster Management Service Tests
 *
 * Covers: list pagination, create, update, status transitions,
 * default replacement, integration upsert, secret-safe DTOs.
 */

import { describe, it, expect, mock, beforeEach } from "bun:test"

// ── Prisma mock ──────────────────────────────────────

const mockPrismaAppHostingCluster = {
  findMany: mock(),
  findUnique: mock(),
  count: mock(),
  create: mock(),
  update: mock(),
  updateMany: mock(),
  findFirst: mock(),
}

const mockPrismaAppHostingClusterIntegration = {
  upsert: mock(),
  update: mock(),
  findFirst: mock(),
  findUnique: mock(),
}
const mockPrismaTransaction = mock(async (fn: (tx: unknown) => unknown) => {
  return fn({
    appHostingCluster: mockPrismaAppHostingCluster,
    appHostingClusterIntegration: mockPrismaAppHostingClusterIntegration,
  })
})

const mockPrismaClient = {
  appHostingCluster: mockPrismaAppHostingCluster,
  appHostingClusterIntegration: mockPrismaAppHostingClusterIntegration,
  $transaction: mockPrismaTransaction,
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

// ── Encryption mock ──────────────────────────────────

const actualClusterIntegration =
  await import("@/modules/deploy/cluster-integration.service")

const mockEncryptClusterIntegrationSecrets = mock(
  actualClusterIntegration.encryptClusterIntegrationSecrets
)
const mockMaskClusterIntegrationSecret = mock(
  actualClusterIntegration.maskClusterIntegrationSecret
)
const mockDecryptClusterIntegrationSecrets = mock(
  actualClusterIntegration.decryptClusterIntegrationSecrets
)

mock.module("@/modules/deploy/cluster-integration.service", () => ({
  ...actualClusterIntegration,
  decryptClusterIntegrationSecrets: mockDecryptClusterIntegrationSecrets,
  encryptClusterIntegrationSecrets: mockEncryptClusterIntegrationSecrets,
  maskClusterIntegrationSecret: mockMaskClusterIntegrationSecret,
}))
const mockVaultWriteKV = mock(async () => ({ version: 1 }))
const mockVaultReadKV = mock(async () => ({}))

mock.module("@/lib/vault/vault-client", () => ({
  VaultClient: class {
    writeKV = mockVaultWriteKV
    readKV = mockVaultReadKV
  },
}))
// ── Dynamic import after mocks ───────────────────────

const {
  listClusters,
  getClusterById,
  createCluster,
  updateCluster,
  updateClusterStatus,
  upsertClusterIntegration,
  updateClusterIntegrationStatus,
} = await import("@/modules/deploy/cluster-management.service")

// ── Helpers ──────────────────────────────────────────

const now = new Date("2025-07-01T00:00:00.000Z")

function fakeCluster(overrides: Record<string, unknown> = {}) {
  return {
    id: "cl_1",
    code: "us-east-1",
    name: "US East",
    region: "us-east-1",
    status: "ACTIVE" as const,
    isDefault: false,
    metadataJson: null,
    createdAt: now,
    updatedAt: now,
    integrations: [],
    ...overrides,
  }
}

function fakeIntegration(overrides: Record<string, unknown> = {}) {
  return {
    id: "int_1",
    clusterId: "cl_1",
    type: "JENKINS" as const,
    metaJson: {},
    secretCiphertext: "encrypted-xyz",
    secretPreview: "abcd…efgh",
    isActive: true,
    keyVersion: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────

describe("ClusterManagementService", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    mockPrismaAppHostingClusterIntegration.findUnique.mockResolvedValue(null)
  })

  // ── listClusters ─────────────────────────────────

  describe("listClusters", () => {
    it("returns paginated clusters with total", async () => {
      const cluster = fakeCluster()
      mockPrismaAppHostingCluster.findMany.mockResolvedValue([cluster])
      mockPrismaAppHostingCluster.count.mockResolvedValue(1)

      const result = await listClusters({ page: 1, limit: 20 })

      expect(result.clusters).toHaveLength(1)
      expect(result.clusters[0].code).toBe("us-east-1")
      expect(result.total).toBe(1)
      expect(mockPrismaAppHostingCluster.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 })
      )
    })

    it("computes correct offset for page 3 with limit 10", async () => {
      mockPrismaAppHostingCluster.findMany.mockResolvedValue([])
      mockPrismaAppHostingCluster.count.mockResolvedValue(0)

      await listClusters({ page: 3, limit: 10 })

      expect(mockPrismaAppHostingCluster.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 })
      )
    })
  })

  // ── getClusterById ──────────────────────────────

  describe("getClusterById", () => {
    it("returns cluster with integrations", async () => {
      const cluster = fakeCluster({ integrations: [fakeIntegration()] })
      mockPrismaAppHostingCluster.findUnique.mockResolvedValue(cluster)

      const result = await getClusterById("cl_1")

      expect(result).not.toBeNull()
      expect(result!.id).toBe("cl_1")
      expect(result!.integrations).toHaveLength(1)
    })

    it("returns null for nonexistent cluster", async () => {
      mockPrismaAppHostingCluster.findUnique.mockResolvedValue(null)

      const result = await getClusterById("nonexistent")

      expect(result).toBeNull()
    })
  })

  // ── createCluster ───────────────────────────────

  describe("createCluster", () => {
    it("creates cluster and returns DTO", async () => {
      const cluster = fakeCluster()
      mockPrismaAppHostingCluster.findFirst.mockResolvedValue(null) // no duplicate
      mockPrismaAppHostingCluster.create.mockResolvedValue(cluster)

      const result = await createCluster({
        code: "us-east-1",
        name: "US East",
        region: "us-east-1",
      })

      expect(result.code).toBe("us-east-1")
      expect(mockPrismaAppHostingCluster.create).toHaveBeenCalled()
    })

    it("throws 409 on duplicate code", async () => {
      mockPrismaAppHostingCluster.findFirst.mockResolvedValue(fakeCluster())

      await expect(
        createCluster({
          code: "us-east-1",
          name: "US East",
          region: "us-east-1",
        })
      ).rejects.toThrow("CONFLICT")
    })

    it("atomically replaces default when isDefault=true", async () => {
      mockPrismaAppHostingCluster.findFirst.mockResolvedValue(null)
      mockPrismaAppHostingCluster.create.mockResolvedValue(
        fakeCluster({ isDefault: true })
      )

      await createCluster({
        code: "us-east-1",
        name: "US East",
        region: "us-east-1",
        status: "ACTIVE",
        isDefault: true,
      })

      // Should use $transaction to clear existing defaults first
      expect(mockPrismaTransaction).toHaveBeenCalled()
    })

    it("rejects a planned cluster marked as default", async () => {
      mockPrismaAppHostingCluster.findFirst.mockResolvedValue(null)

      await expect(
        createCluster({
          code: "planned-1",
          name: "Planned",
          region: "planned",
          status: "PLANNED",
          isDefault: true,
        })
      ).rejects.toThrow("INVALID_DEFAULT_TRANSITION")
    })
  })

  // ── updateCluster ───────────────────────────────

  describe("updateCluster", () => {
    it("updates cluster metadata", async () => {
      const updated = fakeCluster({ name: "Updated Name" })
      mockPrismaAppHostingCluster.findUnique.mockResolvedValue(fakeCluster())
      mockPrismaAppHostingCluster.update.mockResolvedValue(updated)

      const result = await updateCluster("cl_1", { name: "Updated Name" })

      expect(result.name).toBe("Updated Name")
    })

    it("throws 404 for nonexistent cluster", async () => {
      mockPrismaAppHostingCluster.findUnique.mockResolvedValue(null)

      await expect(
        updateCluster("nonexistent", { name: "Updated" })
      ).rejects.toThrow("NOT_FOUND")
    })
  })

  // ── updateClusterStatus ─────────────────────────

  describe("updateClusterStatus", () => {
    it("updates status", async () => {
      const cluster = fakeCluster()
      mockPrismaAppHostingCluster.findUnique.mockResolvedValue(cluster)
      mockPrismaAppHostingCluster.update.mockResolvedValue(
        fakeCluster({ status: "DEPRECATED" })
      )

      const result = await updateClusterStatus("cl_1", "DEPRECATED")

      expect(result.status).toBe("DEPRECATED")
    })

    it("sets isDefault=true atomically (clears others)", async () => {
      mockPrismaAppHostingCluster.findUnique.mockResolvedValue(fakeCluster())
      mockPrismaAppHostingCluster.update.mockResolvedValue(
        fakeCluster({ isDefault: true })
      )

      await updateClusterStatus("cl_1", "ACTIVE", { isDefault: true })

      expect(mockPrismaTransaction).toHaveBeenCalled()
    })

    it("throws 409 when deactivating a default cluster without clearing isDefault", async () => {
      mockPrismaAppHostingCluster.findUnique.mockResolvedValue(
        fakeCluster({ isDefault: true })
      )

      await expect(updateClusterStatus("cl_1", "DEPRECATED")).rejects.toThrow(
        "INVALID_DEFAULT_TRANSITION"
      )
    })

    it("rejects clearing default when no active replacement exists", async () => {
      mockPrismaAppHostingCluster.findUnique.mockResolvedValue(
        fakeCluster({ isDefault: true })
      )
      mockPrismaAppHostingCluster.findFirst.mockResolvedValue(null)

      await expect(
        updateClusterStatus("cl_1", "DEPRECATED", { isDefault: false })
      ).rejects.toThrow("INVALID_DEFAULT_TRANSITION")
    })

    it("throws 404 for nonexistent cluster", async () => {
      mockPrismaAppHostingCluster.findUnique.mockResolvedValue(null)

      await expect(
        updateClusterStatus("nonexistent", "ACTIVE")
      ).rejects.toThrow("NOT_FOUND")
    })
  })

  // ── upsertClusterIntegration ────────────────────

  describe("upsertClusterIntegration", () => {
    it("encrypts secrets and upserts integration", async () => {
      mockPrismaAppHostingCluster.findUnique.mockResolvedValue(fakeCluster())
      mockPrismaAppHostingClusterIntegration.upsert.mockResolvedValue(
        fakeIntegration()
      )

      const result = await upsertClusterIntegration("cl_1", "JENKINS", {
        metaJson: {
          baseUrl: "https://jenkins.example.com",
          dslOwner: "pfnapp",
          dslRepo: "Jenkins",
          gitCredentialId: "github-token",
        },
        secrets: {
          username: "jenkins-user",
          apiToken: "secret123",
          webhookToken: "webhook123",
        },
      })

      expect(mockEncryptClusterIntegrationSecrets).toHaveBeenCalledWith({
        username: "jenkins-user",
        apiToken: "secret123",
        webhookToken: "webhook123",
      })
      expect(result.type).toBe("JENKINS")
      // Must not expose ciphertext
      expect(result).not.toHaveProperty("secretCiphertext")
    })

    it("updates secretPreview when secrets provided", async () => {
      mockMaskClusterIntegrationSecret.mockReturnValue("secr…ken1")
      mockPrismaAppHostingCluster.findUnique.mockResolvedValue(fakeCluster())
      mockPrismaAppHostingClusterIntegration.upsert.mockResolvedValue(
        fakeIntegration({ secretPreview: "secr…ken1" })
      )

      const result = await upsertClusterIntegration("cl_1", "GITOPS", {
        metaJson: {
          repo: "pfnapp/argocd",
          branch: "main",
          basePath: "services-yaml/{slug}",
        },
        secrets: { pat: "ghp_abc123" },
      })

      expect(mockMaskClusterIntegrationSecret).toHaveBeenCalled()
      expect(result.secretPreview).toBe("secr…ken1")
    })

    it("returns secret-safe DTO (no ciphertext)", async () => {
      mockPrismaAppHostingCluster.findUnique.mockResolvedValue(fakeCluster())
      mockPrismaAppHostingClusterIntegration.upsert.mockResolvedValue(
        fakeIntegration({ secretCiphertext: "should-not-leak" })
      )

      const result = await upsertClusterIntegration("cl_1", "JENKINS", {
        metaJson: {
          baseUrl: "https://jenkins.example.com",
          dslOwner: "pfnapp",
          dslRepo: "Jenkins",
          gitCredentialId: "github-token",
        },
        secrets: {
          username: "jenkins-user",
          apiToken: "secret123",
          webhookToken: "webhook123",
        },
      })

      expect(result).not.toHaveProperty("secretCiphertext")
    })

    it("throws 404 when cluster not found", async () => {
      mockPrismaAppHostingCluster.findUnique.mockResolvedValue(null)

      await expect(
        upsertClusterIntegration("nonexistent", "JENKINS", {})
      ).rejects.toThrow("NOT_FOUND")
    })
  })

  // ── updateClusterIntegrationStatus ───────────────

  describe("updateClusterIntegrationStatus", () => {
    it("updates integration isActive", async () => {
      mockPrismaAppHostingCluster.findUnique.mockResolvedValue(fakeCluster())
      mockPrismaAppHostingClusterIntegration.findFirst.mockResolvedValue(
        fakeIntegration()
      )
      mockPrismaAppHostingClusterIntegration.update.mockResolvedValue(
        fakeIntegration({ isActive: false })
      )

      const result = await updateClusterIntegrationStatus(
        "cl_1",
        "JENKINS",
        false
      )

      expect(result.isActive).toBe(false)
    })

    it("returns secret-safe DTO", async () => {
      mockPrismaAppHostingCluster.findUnique.mockResolvedValue(fakeCluster())
      mockPrismaAppHostingClusterIntegration.findFirst.mockResolvedValue(
        fakeIntegration({ secretCiphertext: "should-not-leak" })
      )
      mockPrismaAppHostingClusterIntegration.update.mockResolvedValue(
        fakeIntegration()
      )

      const result = await updateClusterIntegrationStatus(
        "cl_1",
        "JENKINS",
        true
      )

      expect(result).not.toHaveProperty("secretCiphertext")
    })

    it("throws 404 when cluster not found", async () => {
      mockPrismaAppHostingCluster.findUnique.mockResolvedValue(null)

      await expect(
        updateClusterIntegrationStatus("nonexistent", "JENKINS", true)
      ).rejects.toThrow("NOT_FOUND")
    })

    it("throws 404 when integration not found", async () => {
      mockPrismaAppHostingCluster.findUnique.mockResolvedValue(fakeCluster())
      mockPrismaAppHostingClusterIntegration.findFirst.mockResolvedValue(null)

      await expect(
        updateClusterIntegrationStatus("cl_1", "JENKINS", true)
      ).rejects.toThrow("NOT_FOUND")
    })
  })
})
