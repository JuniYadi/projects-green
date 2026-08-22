import { describe, it, expect } from "bun:test"

import { createVpnSshKeySchema } from "./vpn-ssh-key.schema"

const validName = "Prod Key"

describe("createVpnSshKeySchema", () => {
  describe("name", () => {
    it("accepts a valid name", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: "My Key",
        privateKey:
          "-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----",
      })
      expect(result.success).toBe(true)
    })

    it("rejects a name shorter than 2 characters", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: "X",
        privateKey:
          "-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----",
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("at least 2")
      }
    })

    it("rejects a name longer than 80 characters", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: "K".repeat(81),
        privateKey:
          "-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----",
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("at most 80")
      }
    })
  })

  describe("privateKey", () => {
    const pem = (type: string) =>
      [`-----BEGIN ${type}-----`, "fake", `-----END ${type}-----`].join("\n")

    it("accepts OpenSSH private key header", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: validName,
        privateKey: pem(["OPENSSH", "PRIVATE", "KEY"].join(" ")),
      })
      expect(result.success).toBe(true)
    })

    it("accepts PKCS#8 PEM header", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: validName,
        privateKey: pem(["PRIVATE", "KEY"].join(" ")),
      })
      expect(result.success).toBe(true)
    })

    it("accepts RSA PEM header", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: validName,
        privateKey: pem(["RSA", "PRIVATE", "KEY"].join(" ")),
      })
      expect(result.success).toBe(true)
    })

    it("accepts EC PEM header", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: validName,
        privateKey: pem(["EC", "PRIVATE", "KEY"].join(" ")),
      })
      expect(result.success).toBe(true)
    })

    it("accepts DSA PEM header", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: validName,
        privateKey: pem(["DSA", "PRIVATE", "KEY"].join(" ")),
      })
      expect(result.success).toBe(true)
    })

    it("rejects a public key", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: validName,
        privateKey: ["ssh-ed25519", "AAAAC3NzaC1lZDI1NTE5AAAAILf4TEST"].join(
          " "
        ),
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
        privateKey: pem(["FAKE", "PRIVATE", "KEY"].join(" ")),
      })
      expect(result.success).toBe(false)
    })

    it("rejects a public PEM key", () => {
      const result = createVpnSshKeySchema.safeParse({
        name: validName,
        privateKey: pem(["PUBLIC", "KEY"].join(" ")),
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
