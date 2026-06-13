import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import crypto from "node:crypto"

import {
  VpnSshKeyInUseError,
  VpnSshKeyNotFoundError,
  VpnSshKeyService,
} from "./vpn-ssh-key.service"
import {
  computeSshKeyFingerprint,
  decryptSshPrivateKey,
  resetVpnSshCrypto,
  VpnSshKeyError,
} from "./vpn-ssh-key.crypto"

type AnyFn = (...args: any[]) => any

const TEST_ENCRYPTION_KEY = "a".repeat(64)

const { privateKey: testPrivateKeyPem } = crypto.generateKeyPairSync("ed25519", {
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
})

const makeKey = (over: Record<string, unknown> = {}) => ({
  id: "key-1",
  name: "Prod Key",
  privateKey: "encrypted-blob",
  fingerprint: "SHA256:abc",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  servers: [],
  ...over,
})

const findMany = mock<AnyFn>(async () => [])
const findUnique = mock<AnyFn>(async () => null)
const create = mock<AnyFn>(async () => makeKey())
const del = mock<AnyFn>(async () => makeKey())

const prismaMock = {
  vpnSshKey: { findMany, findUnique, create, delete: del },
} as any

const service = new VpnSshKeyService(prismaMock)

beforeEach(() => {
  process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
  resetVpnSshCrypto()
  findMany.mockClear()
  findUnique.mockClear()
  create.mockClear()
  del.mockClear()
  findUnique.mockResolvedValue(null)
  create.mockResolvedValue(makeKey())
  del.mockResolvedValue(makeKey())
})

afterEach(() => {
  resetVpnSshCrypto()
})

describe("computeSshKeyFingerprint", () => {
  it("produces a stable SHA256 fingerprint", () => {
    const fp1 = computeSshKeyFingerprint(testPrivateKeyPem as string)
    const fp2 = computeSshKeyFingerprint(testPrivateKeyPem as string)
    expect(fp1).toBe(fp2)
    expect(fp1).toMatch(/^SHA256:/)
  })

  it("throws on invalid key material", () => {
    expect(() => computeSshKeyFingerprint("not a key")).toThrow(VpnSshKeyError)
  })
})

describe("ssh private key encryption", () => {
  it("round-trips encrypt/decrypt and never stores plaintext", async () => {
    create.mockImplementation(async (args: any) => makeKey(args.data))
    const key = await service.create({
      name: "Prod Key",
      privateKey: testPrivateKeyPem as string,
    })
    expect(key.privateKey).not.toContain("PRIVATE KEY")
    expect(decryptSshPrivateKey(key.privateKey)).toBe(testPrivateKeyPem)
  })
})

describe("VpnSshKeyService.create", () => {
  it("computes fingerprint and persists encrypted key", async () => {
    await service.create({
      name: "Prod Key",
      privateKey: testPrivateKeyPem as string,
    })
    const data = create.mock.calls[0][0].data
    expect(data.fingerprint).toMatch(/^SHA256:/)
    expect(data.privateKey).not.toContain("PRIVATE KEY")
  })
})

describe("VpnSshKeyService.remove", () => {
  it("deletes an unused key", async () => {
    findUnique.mockResolvedValue(makeKey({ servers: [] }))
    await service.remove("key-1")
    expect(del).toHaveBeenCalledTimes(1)
  })

  it("refuses to delete a key referenced by a server", async () => {
    findUnique.mockResolvedValue(makeKey({ servers: [{ name: "ID-01" }] }))
    await expect(service.remove("key-1")).rejects.toBeInstanceOf(
      VpnSshKeyInUseError
    )
    expect(del).not.toHaveBeenCalled()
  })

  it("throws when key missing", async () => {
    findUnique.mockResolvedValue(null)
    await expect(service.remove("missing")).rejects.toBeInstanceOf(
      VpnSshKeyNotFoundError
    )
  })
})
