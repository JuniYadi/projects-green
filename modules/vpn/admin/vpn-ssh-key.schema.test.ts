import { describe, it, expect } from "bun:test"

import { createVpnSshKeySchema } from "./vpn-ssh-key.schema"

const validName = "Prod Key"

describe("createVpnSshKeySchema", () => {
  describe("name", () => {
    it("accepts a valid name", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: "My Key",
        privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----",
      })
      expect(result.success).toBe(true)
    })

    it("rejects a name shorter than 2 characters", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: "X",
        privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----",
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("at least 2")
      }
    })

    it("rejects a name longer than 80 characters", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: "K".repeat(81),
        privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----",
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("at most 80")
      }
    })
  })

  describe("privateKey", () => {
    const validKey = (header: string) =>
      `${header}\nfake\n${header.replace("BEGIN", "END")}`

    it("accepts OpenSSH private key header", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: validName,
        privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----",
      })
      expect(result.success).toBe(true)
    })

    it("accepts PKCS#8 PEM header", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: validName,
        privateKey: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
      })
      expect(result.success).toBe(true)
    })

    it("accepts RSA PEM header", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: validName,
        privateKey: "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----",
      })
      expect(result.success).toBe(true)
    })

    it("accepts EC PEM header", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: validName,
        privateKey: "-----BEGIN EC PRIVATE KEY-----\nfake\n-----END EC PRIVATE KEY-----",
      })
      expect(result.success).toBe(true)
    })

    it("accepts DSA PEM header", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: validName,
        privateKey: "-----BEGIN DSA PRIVATE KEY-----\nfake\n-----END DSA PRIVATE KEY-----",
      })
      expect(result.success).toBe(true)
    })

    it("rejects a public key", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: validName,
        privateKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILf4TEST",
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(
          /unsupported|private key/i
        )
      }
    })

    it("rejects an unknown private key header", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: validName,
        privateKey: "-----BEGIN FAKE PRIVATE KEY-----\nfake\n-----END FAKE PRIVATE KEY-----",
      })
      expect(result.success).toBe(false)
    })

    it("rejects a public PEM key", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: validName,
        privateKey: "-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----",
      })
      expect(result.success).toBe(false)
    })

    it("rejects empty string", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: validName,
        privateKey: "",
      })
      expect(result.success).toBe(false)
    })
  })
})
