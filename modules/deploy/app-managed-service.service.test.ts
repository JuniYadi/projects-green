import { describe, expect, it, mock, beforeEach, type Mock } from "bun:test"
type MockAsync = Mock<(args?: unknown) => Promise<unknown>>

mock.module("@/lib/prisma", () => ({
  prisma: {
    appHostingCluster: {
      findUnique: mock(async () => ({ id: "cl_1" })),
    },
    appManagedServiceCredential: {
      findUnique: mock(async () => null),
      upsert: mock(async () => ({
        id: "cred_1",
        clusterId: "cl_1",
        serviceType: "MYSQL",
        endpointHost: "db.example.com",
        endpointPort: 3306,
        tlsEnabled: false,
        username: "admin",
        secretCiphertext: null,
        secretPreview: "ab…ef",
        isActive: true,
        keyVersion: 1,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      })),
      update: mock(async ({ data }: { data: { isActive: boolean } }) => ({
        id: "cred_1",
        clusterId: "cl_1",
        serviceType: "MYSQL",
        endpointHost: "db.example.com",
        endpointPort: 3306,
        tlsEnabled: false,
        username: "admin",
        secretCiphertext: null,
        secretPreview: "ab…ef",
        isActive: data.isActive,
        keyVersion: 1,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      })),
    },
  },
}))

mock.module("@/lib/encryption", () => ({
  encrypt: mock((plaintext: string, key: Buffer) => ({
    encrypted: "enc",
    iv: "iv",
    tag: "tag",
  })),
  decrypt: mock(
    (data: { encrypted: string; iv: string; tag: string }, key: Buffer) =>
      JSON.stringify({ password: "secret123" })
  ),
  parseEncryptedField: mock((value: string | null) =>
    value ? { encrypted: "enc", iv: "iv", tag: "tag" } : null
  ),
  serializeEncryptedField: mock(
    (data: { encrypted: string; iv: string; tag: string }) =>
      JSON.stringify(data)
  ),
  deriveEncryptionKey: mock(() => Buffer.from("key")),
}))

const {
  upsertAppManagedServiceCredential,
  updateAppManagedServiceCredentialStatus,
  resolveAppManagedServiceCredential,
} = await import("@/modules/deploy/app-managed-service.service")

describe("AppManagedServiceCredentialService", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  describe("upsertAppManagedServiceCredential", () => {
    it("creates a MySQL credential", async () => {
      const result = await upsertAppManagedServiceCredential("cl_1", "MYSQL", {
        endpointHost: "db.example.com",
        endpointPort: 3306,
        username: "admin",
        password: "secret123",
      })
      expect(result.id).toBe("cred_1")
      expect(result.serviceType).toBe("MYSQL")
    })

    it("rejects empty endpointHost", async () => {
      await expect(
        upsertAppManagedServiceCredential("cl_1", "MYSQL", {
          endpointHost: "",
          endpointPort: 3306,
          username: "admin",
          password: "secret123",
        })
      ).rejects.toThrow("endpointHost is required")
    })

    it("rejects invalid port", async () => {
      await expect(
        upsertAppManagedServiceCredential("cl_1", "MYSQL", {
          endpointHost: "db.example.com",
          endpointPort: 0,
          username: "admin",
          password: "secret123",
        })
      ).rejects.toThrow("endpointPort must be a valid port")
    })

    it("rejects missing username for MySQL", async () => {
      await expect(
        upsertAppManagedServiceCredential("cl_1", "MYSQL", {
          endpointHost: "db.example.com",
          endpointPort: 3306,
          password: "secret123",
        })
      ).rejects.toThrow("username is required")
    })

    it("rejects missing password for MySQL", async () => {
      await expect(
        upsertAppManagedServiceCredential("cl_1", "MYSQL", {
          endpointHost: "db.example.com",
          endpointPort: 3306,
          username: "admin",
        })
      ).rejects.toThrow("password is required")
    })

    it("rejects missing authToken for Redis", async () => {
      await expect(
        upsertAppManagedServiceCredential("cl_1", "REDIS", {
          endpointHost: "redis.example.com",
          endpointPort: 6379,
        })
      ).rejects.toThrow("authToken is required")
    })

    it("rejects missing cluster", async () => {
      const { prisma } = await import("@/lib/prisma")
      ;(
        prisma.appHostingCluster.findUnique as unknown as MockAsync
      ).mockResolvedValueOnce(null)

      await expect(
        upsertAppManagedServiceCredential("cl_missing", "MYSQL", {
          endpointHost: "db.example.com",
          endpointPort: 3306,
          username: "admin",
          password: "secret123",
        })
      ).rejects.toThrow("NOT_FOUND")
    })
  })

  describe("updateAppManagedServiceCredentialStatus", () => {
    it("updates isActive", async () => {
      const result = await updateAppManagedServiceCredentialStatus("cred_1", {
        isActive: false,
      })
      expect(result.isActive).toBe(false)
    })
  })

  describe("resolveAppManagedServiceCredential", () => {
    it("returns decrypted config for active credential", async () => {
      const { prisma } = await import("@/lib/prisma")
      ;(
        prisma.appManagedServiceCredential.findUnique as unknown as MockAsync
      ).mockResolvedValueOnce({
        id: "cred_1",
        clusterId: "cl_1",
        serviceType: "MYSQL",
        endpointHost: "db.example.com",
        endpointPort: 3306,
        tlsEnabled: false,
        username: "admin",
        secretCiphertext: JSON.stringify({
          encrypted: "enc",
          iv: "iv",
          tag: "tag",
        }),
        secretPreview: "ab…ef",
        isActive: true,
        keyVersion: 1,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      })

      const result = await resolveAppManagedServiceCredential("cl_1", "MYSQL")
      expect(result.serviceType).toBe("MYSQL")
      expect(result.endpointHost).toBe("db.example.com")
      expect(result.password).toBe("secret123")
      expect(result.authToken).toBeNull()
    })

    it("rejects inactive credential", async () => {
      const { prisma } = await import("@/lib/prisma")
      ;(
        prisma.appManagedServiceCredential.findUnique as unknown as MockAsync
      ).mockResolvedValueOnce({
        id: "cred_1",
        clusterId: "cl_1",
        serviceType: "MYSQL",
        endpointHost: "db.example.com",
        endpointPort: 3306,
        tlsEnabled: false,
        username: "admin",
        secretCiphertext: null,
        secretPreview: null,
        isActive: false,
        keyVersion: 1,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      })

      await expect(
        resolveAppManagedServiceCredential("cl_1", "MYSQL")
      ).rejects.toThrow("INACTIVE")
    })

    it("rejects missing credential", async () => {
      const { prisma } = await import("@/lib/prisma")
      ;(
        prisma.appManagedServiceCredential.findUnique as unknown as MockAsync
      ).mockResolvedValueOnce(null)

      await expect(
        resolveAppManagedServiceCredential("cl_1", "MYSQL")
      ).rejects.toThrow("NOT_FOUND")
    })
  })
})
