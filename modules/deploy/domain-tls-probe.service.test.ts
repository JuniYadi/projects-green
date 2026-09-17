import { beforeEach, describe, expect, it, mock } from "bun:test"
import { EventEmitter } from "node:events"

class MockTlsSocket extends EventEmitter {
  authorized = true
  authorizationError: string | Error | null = null
  peerCert: Record<string, unknown> | null = null
  destroyed = false
  timeoutHandler?: () => void

  getPeerCertificate() {
    return this.peerCert
  }

  destroy() {
    this.destroyed = true
    return this
  }

  setTimeout(_ms: number, cb: () => void) {
    this.timeoutHandler = cb
    return this
  }
}

let currentSocket: MockTlsSocket
let shouldCallCbDirectly = true
let connectOptions: Record<string, unknown> | null = null

mock.module("node:tls", () => ({
  connect: mock((options: unknown, callback?: () => void) => {
    connectOptions = options as Record<string, unknown>
    if (shouldCallCbDirectly && callback) {
      process.nextTick(() => callback())
    }
    return currentSocket
  }),
}))

const { probeDomainCertificate } = await import("./domain-tls-probe.service")

describe("domain-tls-probe.service", () => {
  beforeEach(() => {
    currentSocket = new MockTlsSocket()
    shouldCallCbDirectly = true
    connectOptions = null
  })

  it("returns error for empty or whitespace hostname", async () => {
    const result = await probeDomainCertificate("   ")
    expect(result.ok).toBe(false)
    expect(result.error).toBe("Empty hostname")
  })

  it("handles connection error gracefully", async () => {
    shouldCallCbDirectly = false
    process.nextTick(() => {
      currentSocket.emit("error", new Error("getaddrinfo ENOTFOUND"))
    })
    const result = await probeDomainCertificate("non-existent.test")
    expect(result.ok).toBe(false)
    expect(result.error).toBe("getaddrinfo ENOTFOUND")
  })

  it("handles timeout gracefully", async () => {
    shouldCallCbDirectly = false
    const promise = probeDomainCertificate("192.0.2.1", 443, 200)
    process.nextTick(() => {
      currentSocket.timeoutHandler?.()
    })
    const result = await promise
    expect(result.ok).toBe(false)
    expect(result.error).toContain("timed out")
    expect(currentSocket.destroyed).toBe(true)
  })

  it("successfully reads certificate and destroys socket", async () => {
    currentSocket.authorized = true
    currentSocket.peerCert = {
      subject: { CN: "example.com" },
      issuer: { O: "Let's Encrypt", CN: "R3" },
      valid_from: "2026-01-01T00:00:00Z",
      valid_to: "2026-04-01T00:00:00Z",
      fingerprint256: "AA:BB:CC",
    }

    const result = await probeDomainCertificate("example.com")
    expect(result.ok).toBe(true)
    expect(result.authorized).toBe(true)
    expect(result.subject).toBe("example.com")
    expect(result.issuer).toBe("Let's Encrypt")
    expect(result.validFrom).toEqual(new Date("2026-01-01T00:00:00Z"))
    expect(result.validTo).toEqual(new Date("2026-04-01T00:00:00Z"))
    expect(result.fingerprint256).toBe("AA:BB:CC")
    expect(currentSocket.destroyed).toBe(true)
    expect(connectOptions?.servername).toBe("example.com")
  })

  it("handles missing certificate subject", async () => {
    currentSocket.peerCert = { subject: {} }
    const result = await probeDomainCertificate("example.com")
    expect(result.ok).toBe(false)
    expect(result.error).toBe("No certificate presented")
    expect(currentSocket.destroyed).toBe(true)
  })

  it("handles unauthorized certificate with Error authorizationError", async () => {
    currentSocket.authorized = false
    currentSocket.authorizationError = new Error("CERT_HAS_EXPIRED")
    currentSocket.peerCert = {
      subject: { CN: ["my-app.internal"] },
      issuer: { CN: ["Self-Signed"] },
      valid_from: "2025-01-01T00:00:00Z",
      valid_to: "2025-02-01T00:00:00Z",
      fingerprint256: "11:22",
    }

    const result = await probeDomainCertificate("10.0.0.1")
    expect(result.ok).toBe(true)
    expect(result.authorized).toBe(false)
    expect(result.authorizationError).toBe("CERT_HAS_EXPIRED")
    expect(result.subject).toBe("my-app.internal")
    expect(result.issuer).toBe("Self-Signed")
    expect(currentSocket.destroyed).toBe(true)
    expect(connectOptions?.servername).toBeUndefined()
  })
})
