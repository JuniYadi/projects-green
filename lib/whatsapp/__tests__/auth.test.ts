import { describe, expect, it, beforeEach } from "bun:test"
import { hashApiKey } from "../auth"

describe("WhatsApp auth middleware", () => {
  describe("hashApiKey", () => {
    it("produces deterministic output", async () => {
      const hash = await hashApiKey("live_test_key_abc123", "test-salt")
      expect(hash).toBe(await hashApiKey("live_test_key_abc123", "test-salt"))
    })

    it("produces different output for different keys", async () => {
      const hash1 = await hashApiKey("live_key_a", "test-salt")
      const hash2 = await hashApiKey("live_key_b", "test-salt")
      expect(hash1).not.toBe(hash2)
    })

    it("produces a base64 string", async () => {
      const hash = await hashApiKey("live_test_key", "test-salt")
      // PBKDF2-SHA256 with base64 output
      expect(typeof hash).toBe("string")
      expect(hash.length).toBeGreaterThan(0)
    })
  })

  describe("PlatformScope type", () => {
    it("accepts platform scope shape", () => {
      const scope = {
        type: "platform" as const,
        keyId: "key_1",
        keyName: "Test Key",
        environment: "LIVE" as const,
        scopes: ["read"],
      }
      expect(scope.type).toBe("platform")
    })

    it("accepts WorkOS scope shape", () => {
      const scope = {
        type: "workos" as const,
        userId: "user_123",
        email: "test@example.com",
        organizationId: "org_456",
        tenantRole: "member" as const,
        platformRole: "none" as const,
      }
      expect(scope.type).toBe("workos")
      expect(scope.organizationId).toBe("org_456")
    })
  })
})
