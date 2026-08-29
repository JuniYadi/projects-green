import { describe, expect, it } from "bun:test"
import {
  credentialTypeRegistry,
  getCredentialTypeDef,
  buildMaskedPreview,
} from "./credential-type-registry"
import type { AppCredentialType } from "@prisma/client"

describe("credentialTypeRegistry", () => {
  describe("registry definition", () => {
    it("contains definitions for all expected credential types", () => {
      expect(credentialTypeRegistry.CLOUDFLARE_API_TOKEN).toBeDefined()
      expect(credentialTypeRegistry.CLOUDFLARE_LEGACY_TOKEN).toBeDefined()
      expect(credentialTypeRegistry.GITHUB_APP).toBeDefined()
      expect(credentialTypeRegistry.GITHUB_TOKEN).toBeDefined()
    })

    it("has correct types and metadataFields for CLOUDFLARE_API_TOKEN", () => {
      const def = credentialTypeRegistry.CLOUDFLARE_API_TOKEN
      expect(def.type).toBe("CLOUDFLARE_API_TOKEN")
      expect(def.label).toBe("Cloudflare API Token")
      expect(def.icon).toBe("Key")
      expect(def.metadataFields).toHaveLength(3)
      expect(def.metadataFields[0].key).toBe("accountName")
      expect(def.metadataFields[0].primary).toBe(true)
    })

    it("has correct types and metadataFields for CLOUDFLARE_LEGACY_TOKEN", () => {
      const def = credentialTypeRegistry.CLOUDFLARE_LEGACY_TOKEN
      expect(def.type).toBe("CLOUDFLARE_LEGACY_TOKEN")
      expect(def.label).toBe("Cloudflare Global Key (Legacy)")
      expect(def.icon).toBe("Key")
      expect(def.metadataFields).toHaveLength(1)
      expect(def.metadataFields[0].key).toBe("tokenFormat")
    })

    it("has correct types and metadataFields for GITHUB_APP", () => {
      const def = credentialTypeRegistry.GITHUB_APP
      expect(def.type).toBe("GITHUB_APP")
      expect(def.label).toBe("GitHub App")
      expect(def.icon).toBe("GithubLogo")
      expect(def.metadataFields).toHaveLength(3)
      expect(def.metadataFields[0].key).toBe("accountLogin")
      expect(def.metadataFields[0].primary).toBe(true)
    })

    it("has correct types and metadataFields for GITHUB_TOKEN", () => {
      const def = credentialTypeRegistry.GITHUB_TOKEN
      expect(def.type).toBe("GITHUB_TOKEN")
      expect(def.label).toBe("GitHub Personal Access Token")
      expect(def.icon).toBe("GithubLogo")
      expect(def.metadataFields).toHaveLength(2)
      expect(def.metadataFields[0].key).toBe("accountLogin")
      expect(def.metadataFields[0].primary).toBe(true)
    })
  })

  describe("getCredentialTypeDef", () => {
    it("returns valid definition for known credential types", () => {
      const defs: AppCredentialType[] = [
        "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_LEGACY_TOKEN",
        "GITHUB_APP",
        "GITHUB_TOKEN",
      ]

      for (const type of defs) {
        const def = getCredentialTypeDef(type)
        expect(def).toBeDefined()
        expect(def.type).toBe(type)
      }
    })

    it("throws error for unknown credential type", () => {
      expect(() =>
        getCredentialTypeDef("UNKNOWN_TYPE" as AppCredentialType)
      ).toThrow("Unknown credential type: UNKNOWN_TYPE")
    })
  })

  describe("buildMaskedPreview", () => {
    it("builds masked preview for CLOUDFLARE_API_TOKEN", () => {
      const preview = buildMaskedPreview("CLOUDFLARE_API_TOKEN", {
        token: "dummy-token-sample-cdef",
      })
      expect(preview).toBe("cf…cdef")
    })

    it("builds masked preview for CLOUDFLARE_LEGACY_TOKEN", () => {
      const preview = buildMaskedPreview("CLOUDFLARE_LEGACY_TOKEN", {
        apiKey: "dummy-key-9876",
        email: "user@example.com",
      })
      expect(preview).toBe("cf…9876")
    })

    it("builds masked preview for GITHUB_APP with token", () => {
      const preview = buildMaskedPreview("GITHUB_APP", {
        cachedInstallationToken: "dummy-installation-token-cdef",
      })
      expect(preview).toBe("ghs_***…cdef")
    })

    it("builds masked preview for GITHUB_APP without token", () => {
      const preview = buildMaskedPreview("GITHUB_APP", {})
      expect(preview).toBe("ghs_???…")
    })

    it("builds masked preview for GITHUB_TOKEN", () => {
      const preview = buildMaskedPreview("GITHUB_TOKEN", {
        token: "dummy-token-fedcba",
      })
      expect(preview).toBe("ghp_***…dcba")
    })

    it("throws error for unknown credential type", () => {
      expect(() =>
        buildMaskedPreview(
          "INVALID_TYPE" as unknown as AppCredentialType,
          { token: "abc" } as unknown as Parameters<
            typeof buildMaskedPreview
          >[1]
        )
      ).toThrow("Unknown credential type: INVALID_TYPE")
    })
  })
})
