import { describe, it, expect, vi, beforeEach } from "vitest"
import { hashApiKey, type PlatformScope, type WorkOSScope } from "../auth"

describe("WhatsApp auth middleware", () => {
  describe("hashApiKey", () => {
    it("produces deterministic output", () => {
      const hash = hashApiKey("live_test_key_abc123")
      expect(hash).toBe(hashApiKey("live_test_key_abc123"))
    })

    it("produces different output for different keys", () => {
      const hash1 = hashApiKey("live_key_a")
      const hash2 = hashApiKey("live_key_b")
      expect(hash1).not.toBe(hash2)
    })

    it("produces a 64-char hex string (SHA-256)", () => {
      const hash = hashApiKey("live_test_key")
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe("PlatformScope type guard", () => {
    it("accepts platform scope shape", () => {
      const scope: PlatformScope = { type: "platform", role: "developer", keyHash: "abc" }
      expect(scope.type).toBe("platform")
    })

    it("accepts workos scope shape", () => {
      const scope: WorkOSScope = {
        type: "workos",
        userId: "user_123",
        organizationId: "org_456",
        role: "member",
        sessionId: "sess_789",
      }
      expect(scope.type).toBe("workos")
      expect(scope.organizationId).toBe("org_456")
    })
  })
})