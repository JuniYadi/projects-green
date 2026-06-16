import { describe, it, expect, beforeEach, mock } from "bun:test"

import {
  VpnPairingTokenAlreadyUsedError,
  VpnPairingTokenExpiredError,
  VpnPairingTokenInvalidError,
} from "./vpn-mobile.errors"

// ─── Mocks ──────────────────────────────────────────────────────────────
// Mock @/lib/prisma only (leaf dependency).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any

const tokenCreate = mock<AnyFn>(async () => ({}))
const tokenUpdate = mock<AnyFn>(async () => ({}))
const tokenUpdateMany = mock<AnyFn>(async () => ({ count: 0 }))
const tokenFindUnique = mock<AnyFn>(async () => null)
const tokenDeleteMany = mock<AnyFn>(async () => ({ count: 0 }))

const mockPrisma = {
  vpnPairingToken: {
    create: tokenCreate,
    update: tokenUpdate,
    updateMany: tokenUpdateMany,
    findUnique: tokenFindUnique,
    deleteMany: tokenDeleteMany,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

mock.module("@/lib/prisma", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: mockPrisma as any,
}))

import { prisma } from "@/lib/prisma"
import type { PairingClaims } from "./vpn-pairing-token.service"
import { VpnPairingTokenService } from "./vpn-pairing-token.service"

const prismaMock = prisma as unknown as {
  vpnPairingToken: {
    create: ReturnType<typeof mock>
    update: ReturnType<typeof mock>
    updateMany: ReturnType<typeof mock>
    findUnique: ReturnType<typeof mock>
    deleteMany: ReturnType<typeof mock>
  }
}

const NOW = new Date("2026-06-16T12:00:00Z")
const IAT = Math.floor(NOW.getTime() / 1000)
const EXP = IAT + 300 // 5 min
const JTI = "jti-uuid-1234"
const SUB = "sub-1"
const ORG = "org-1"

// Sign/verify are injected so we don't depend on env vars or real crypto in
// tests. The signing logic itself is exercised by the integration tests.
const signJwt = mock<AnyFn>(() => "signed-jwt-token")
const verifyJwt = mock<AnyFn>(() => ({
  sub: SUB,
  org: ORG,
  iat: IAT,
  exp: EXP,
  jti: JTI,
  typ: "vpn-pairing" as const,
}))
const randomJti = mock<AnyFn>(() => JTI)

// Fake device service — bypasses the real device service which has its own
// test file. This is allowed because VpnMobileDeviceService is injected as
// a dependency, not mocked at the module level.
const fakeDeviceService = {
  create: mock<AnyFn>(async () => ({ id: "dev-1" })),
}

const service = new VpnPairingTokenService(
  prismaMock as unknown as import("@prisma/client").PrismaClient,
  {
    now: () => NOW,
    signJwt,
    verifyJwt,
    randomJti,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deviceService: fakeDeviceService as any,
  }
)

const validClaims: PairingClaims = {
  sub: SUB,
  org: ORG,
  iat: IAT,
  exp: EXP,
  jti: JTI,
  typ: "vpn-pairing",
}

const tokenRow = {
  id: JTI,
  subscriptionId: SUB,
  token: "signed-jwt-token",
  expiresAt: new Date(EXP * 1000),
  claimedAt: null,
  claimedByDevice: null,
  createdAt: NOW,
}

beforeEach(() => {
  tokenCreate.mockClear()
  tokenUpdate.mockClear()
  tokenUpdateMany.mockClear()
  tokenFindUnique.mockClear()
  tokenDeleteMany.mockClear()
  signJwt.mockClear()
  verifyJwt.mockClear()
  randomJti.mockClear()
  fakeDeviceService.create.mockClear()

  // Reset defaults.
  tokenCreate.mockResolvedValue(tokenRow)
  tokenUpdate.mockResolvedValue(tokenRow)
  tokenUpdateMany.mockResolvedValue({ count: 0 })
  tokenFindUnique.mockResolvedValue(null)
  tokenDeleteMany.mockResolvedValue({ count: 0 })

  verifyJwt.mockImplementation(() => ({ ...validClaims }))
  fakeDeviceService.create.mockResolvedValue({ id: "dev-1" })
})

describe("VpnPairingTokenService", () => {
  describe("generate", () => {
    it("signs JWT with {sub,org,iat,exp,jti,typ} and persists row", async () => {
      const result = await service.generate({
        subscriptionId: SUB,
        organizationId: ORG,
      })

      // Verify JWT claims passed to signJwt.
      expect(signJwt).toHaveBeenCalledTimes(1)
      const [claimsArg, nowArg] = signJwt.mock.calls[0] as [
        PairingClaims,
        Date,
      ]
      expect(claimsArg.sub).toBe(SUB)
      expect(claimsArg.org).toBe(ORG)
      expect(claimsArg.iat).toBe(IAT)
      expect(claimsArg.exp).toBe(IAT + 300)
      expect(claimsArg.jti).toBe(JTI)
      expect(claimsArg.typ).toBe("vpn-pairing")
      expect(nowArg).toEqual(NOW)

      // Verify DB row persisted with jti as id.
      expect(prismaMock.vpnPairingToken.create).toHaveBeenCalledWith({
        data: {
          id: JTI,
          subscriptionId: SUB,
          token: "signed-jwt-token",
          expiresAt: new Date(EXP * 1000),
        },
      })

      // Verify result shape.
      expect(result.pairingToken).toBe("signed-jwt-token")
      expect(result.expiresAt).toEqual(new Date(EXP * 1000))
      expect(result.qrPayload).toBe("signed-jwt-token")
    })
  })

  describe("validate", () => {
    it("passes through to verifyJwt and returns claims", () => {
      const result = service.validate("token-123")
      expect(verifyJwt).toHaveBeenCalledWith("token-123", NOW)
      expect(result.sub).toBe(SUB)
      expect(result.typ).toBe("vpn-pairing")
    })

    it("throws VpnPairingTokenInvalidError on bad signature", () => {
      verifyJwt.mockImplementation(() => {
        throw new VpnPairingTokenInvalidError("bad sig")
      })
      expect(() => service.validate("bad")).toThrow(
        VpnPairingTokenInvalidError
      )
    })

    it("throws VpnPairingTokenInvalidError on wrong typ", () => {
      verifyJwt.mockImplementation(() => {
        throw new VpnPairingTokenInvalidError("wrong typ")
      })
      expect(() => service.validate("wrong")).toThrow(
        VpnPairingTokenInvalidError
      )
    })

    it("throws VpnPairingTokenExpiredError when expired", () => {
      verifyJwt.mockImplementation(() => {
        throw new VpnPairingTokenExpiredError()
      })
      expect(() => service.validate("expired")).toThrow(
        VpnPairingTokenExpiredError
      )
    })
  })

  describe("claim", () => {
    it("claims successfully: updateMany count=1 → upsert device", async () => {
      tokenUpdateMany.mockResolvedValue({ count: 1 })

      const result = await service.claim({
        pairingToken: "signed-jwt-token",
        deviceName: "iPhone 15",
        deviceFingerprint: "fp-abc",
        platform: "ios",
        osVersion: "18.2.1",
        appVersion: "1.0.0",
      })

      // Atomic guard: updateMany where {id: jti, claimedAt: null}.
      expect(prismaMock.vpnPairingToken.updateMany).toHaveBeenCalledWith({
        where: { id: JTI, claimedAt: null },
        data: { claimedAt: NOW },
      })

      // Device upsert called with pairedVia QR.
      expect(fakeDeviceService.create).toHaveBeenCalledWith({
        subscriptionId: SUB,
        organizationId: ORG,
        deviceName: "iPhone 15",
        deviceFingerprint: "fp-abc",
        platform: "ios",
        osVersion: "18.2.1",
        appVersion: "1.0.0",
        pairedVia: "QR",
      })

      expect(result).toEqual({
        deviceId: "dev-1",
        subscriptionId: SUB,
        organizationId: ORG,
      })
    })

    it("concurrent-claim assertion: updateMany uses {id, claimedAt:null}", async () => {
      tokenUpdateMany.mockResolvedValue({ count: 1 })
      await service.claim({
        pairingToken: "signed-jwt-token",
        deviceName: "iPhone",
        deviceFingerprint: "fp",
        platform: "ios",
      })
      expect(
        prismaMock.vpnPairingToken.updateMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: JTI, claimedAt: null }),
        })
      )
    })

    it("throws VpnPairingTokenAlreadyUsedError when already claimed", async () => {
      tokenUpdateMany.mockResolvedValue({ count: 0 })
      tokenFindUnique.mockResolvedValue({
        ...tokenRow,
        claimedAt: new Date("2026-06-16T11:59:00Z"),
      })

      await expect(
        service.claim({
          pairingToken: "signed-jwt-token",
          deviceName: "iPhone",
          deviceFingerprint: "fp",
          platform: "ios",
        })
      ).rejects.toThrow(VpnPairingTokenAlreadyUsedError)

      expect(fakeDeviceService.create).not.toHaveBeenCalled()
    })

    it("throws VpnPairingTokenExpiredError when updateMany=0 and unclaimed", async () => {
      tokenUpdateMany.mockResolvedValue({ count: 0 })
      tokenFindUnique.mockResolvedValue({ ...tokenRow, claimedAt: null })

      await expect(
        service.claim({
          pairingToken: "signed-jwt-token",
          deviceName: "iPhone",
          deviceFingerprint: "fp",
          platform: "ios",
        })
      ).rejects.toThrow(VpnPairingTokenExpiredError)

      expect(fakeDeviceService.create).not.toHaveBeenCalled()
    })

    it("throws VpnPairingTokenExpiredError when row missing after updateMany=0", async () => {
      tokenUpdateMany.mockResolvedValue({ count: 0 })
      tokenFindUnique.mockResolvedValue(null)

      await expect(
        service.claim({
          pairingToken: "signed-jwt-token",
          deviceName: "iPhone",
          deviceFingerprint: "fp",
          platform: "ios",
        })
      ).rejects.toThrow(VpnPairingTokenExpiredError)
    })

    it("propagates VpnPairingTokenInvalidError from validate before claim", async () => {
      verifyJwt.mockImplementation(() => {
        throw new VpnPairingTokenInvalidError()
      })
      await expect(
        service.claim({
          pairingToken: "bad",
          deviceName: "iPhone",
          deviceFingerprint: "fp",
          platform: "ios",
        })
      ).rejects.toThrow(VpnPairingTokenInvalidError)
      expect(prismaMock.vpnPairingToken.updateMany).not.toHaveBeenCalled()
    })
  })

  describe("expireStale", () => {
    it("deletes tokens with expiresAt < now and returns count", async () => {
      tokenDeleteMany.mockResolvedValue({ count: 5 })
      const count = await service.expireStale()
      expect(count).toBe(5)
      expect(prismaMock.vpnPairingToken.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: NOW } },
      })
    })
  })

  describe("getStatus", () => {
    it("returns {status:'valid'} for valid unclaimed token", async () => {
      tokenFindUnique.mockResolvedValue({ ...tokenRow, claimedAt: null })
      const result = await service.getStatus("signed-jwt-token")
      expect(result).toEqual({ status: "valid" })
    })

    it("returns {status:'claimed', claimedAt} for claimed token", async () => {
      const claimedAt = new Date("2026-06-16T11:59:00Z")
      tokenFindUnique.mockResolvedValue({ ...tokenRow, claimedAt })
      const result = await service.getStatus("signed-jwt-token")
      expect(result.status).toBe("claimed")
      expect(result.claimedAt).toEqual(claimedAt)
    })

    it("returns {status:'expired'} when row missing", async () => {
      tokenFindUnique.mockResolvedValue(null)
      const result = await service.getStatus("signed-jwt-token")
      expect(result).toEqual({ status: "expired" })
    })

    it("returns {status:'expired'} when expiresAt < now", async () => {
      tokenFindUnique.mockResolvedValue({
        ...tokenRow,
        expiresAt: new Date("2026-06-16T11:00:00Z"),
        claimedAt: null,
      })
      const result = await service.getStatus("signed-jwt-token")
      expect(result).toEqual({ status: "expired" })
    })

    it("throws VpnPairingTokenInvalidError on invalid signature", async () => {
      verifyJwt.mockImplementation(() => {
        throw new VpnPairingTokenInvalidError()
      })
      await expect(service.getStatus("bad")).rejects.toThrow(
        VpnPairingTokenInvalidError
      )
    })
  })
})
