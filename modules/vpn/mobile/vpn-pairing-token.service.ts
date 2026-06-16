import crypto, { timingSafeEqual } from "node:crypto"

import type { PrismaClient, VpnPairingMethod } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"

import {
  VpnPairingTokenAlreadyUsedError,
  VpnPairingTokenExpiredError,
  VpnPairingTokenInvalidError,
} from "./vpn-mobile.errors"
import { VpnMobileDeviceService } from "./vpn-mobile-device.service"

type PrismaLike = PrismaClient

/**
 * JWT claims for a pairing token (PRD §8.2).
 */
export type PairingClaims = {
  sub: string // subscriptionId
  org: string // organizationId
  iat: number
  exp: number
  jti: string
  typ: "vpn-pairing"
}

const PAIRING_TTL_SECONDS = 300 // 5 minutes

/**
 * Default HS256 JWT signer using node:crypto. Uses VPN_PAIRING_SECRET or
 * falls back to JWT_SECRET. Throws if neither is set.
 */
function defaultSignJwt(
  payload: Omit<PairingClaims, "iat" | "exp"> & {
    iat: number
    exp: number
  },
  // `now` is accepted for interface symmetry with verifyJwt and the
  // injected sign function signature; signing itself is timestamp-agnostic.
  _now: Date
): string {
  const secret = getSecret()
  const header = { alg: "HS256", typ: "JWT" }
  const headerSegment = Buffer.from(JSON.stringify(header)).toString(
    "base64url"
  )
  const payloadSegment = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  )
  const signingInput = `${headerSegment}.${payloadSegment}`
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64url")
  return `${signingInput}.${signature}`
}

/**
 * Default HS256 JWT verifier. Returns parsed claims or throws
 * VpnPairingTokenInvalidError.
 */
function defaultVerifyJwt(token: string, now: Date): PairingClaims {
  const secret = getSecret()
  const parts = token.split(".")
  if (parts.length !== 3) {
    throw new VpnPairingTokenInvalidError("Token is malformed.")
  }
  const [headerSegment, payloadSegment, signatureSegment] = parts
  if (!headerSegment || !payloadSegment || !signatureSegment) {
    throw new VpnPairingTokenInvalidError("Token is malformed.")
  }

  const signingInput = `${headerSegment}.${payloadSegment}`
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64url")

  const expectedBuf = Buffer.from(expectedSignature)
  const providedBuf = Buffer.from(signatureSegment)
  if (
    expectedBuf.length !== providedBuf.length ||
    !timingSafeEqual(expectedBuf, providedBuf)
  ) {
    throw new VpnPairingTokenInvalidError("Signature is invalid.")
  }

  let claimsUnknown: unknown
  try {
    claimsUnknown = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8")
    )
  } catch {
    throw new VpnPairingTokenInvalidError("Payload is not valid JSON.")
  }

  if (!claimsUnknown || typeof claimsUnknown !== "object") {
    throw new VpnPairingTokenInvalidError("Payload is not an object.")
  }

  const claims = claimsUnknown as Partial<PairingClaims>
  if (
    typeof claims.sub !== "string" ||
    typeof claims.org !== "string" ||
    typeof claims.jti !== "string" ||
    typeof claims.iat !== "number" ||
    typeof claims.exp !== "number" ||
    claims.typ !== "vpn-pairing"
  ) {
    throw new VpnPairingTokenInvalidError("Token claims are invalid.")
  }

  if (claims.exp <= Math.floor(now.getTime() / 1000)) {
    throw new VpnPairingTokenExpiredError()
  }

  return {
    sub: claims.sub,
    org: claims.org,
    iat: claims.iat,
    exp: claims.exp,
    jti: claims.jti,
    typ: "vpn-pairing",
  }
}

function getSecret(): string {
  const secret =
    process.env.VPN_PAIRING_SECRET ?? process.env.JWT_SECRET ?? ""
  if (!secret) {
    throw new Error(
      "Missing VPN_PAIRING_SECRET or JWT_SECRET environment variable."
    )
  }
  return secret
}

export type PairingTokenServiceDeps = {
  now?: () => Date
  signJwt?: (
    payload: PairingClaims,
    now: Date
  ) => string
  verifyJwt?: (token: string, now: Date) => PairingClaims
  randomJti?: () => string
  deviceService?: VpnMobileDeviceService
}

export type PairingGenerateInput = {
  subscriptionId: string
  organizationId: string
}

export type PairingClaimInput = {
  pairingToken: string
  deviceName: string
  deviceFingerprint: string
  platform: string
  osVersion?: string | null
  appVersion?: string | null
}

export type PairingGenerateResult = {
  pairingToken: string
  expiresAt: Date
  qrPayload: string
}

export type PairingStatusResult = {
  status: "valid" | "claimed" | "expired"
  claimedAt?: Date
}

/**
 * Service for QR pairing token lifecycle (T1.3).
 *
 * Flow: generate (JWT + DB row) → validate (signature + typ + exp) →
 * claim (atomic updateMany where {id, claimedAt:null} → upsert device).
 *
 * Atomic claim semantics: only one claimant wins via DB atomic updateMany.
 */
export class VpnPairingTokenService {
  private readonly prisma: PrismaLike
  private readonly now: () => Date
  private readonly signJwt: (
    payload: PairingClaims,
    now: Date
  ) => string
  private readonly verifyJwt: (token: string, now: Date) => PairingClaims
  private readonly randomJti: () => string
  private readonly deviceService: VpnMobileDeviceService

  constructor(
    prisma: PrismaLike = defaultPrisma,
    deps: PairingTokenServiceDeps = {}
  ) {
    this.prisma = prisma
    this.now = deps.now ?? (() => new Date())
    this.signJwt = deps.signJwt ?? defaultSignJwt
    this.verifyJwt = deps.verifyJwt ?? defaultVerifyJwt
    this.randomJti = deps.randomJti ?? crypto.randomUUID
    this.deviceService =
      deps.deviceService ?? new VpnMobileDeviceService(prisma)
  }

  /**
   * Generate a one-time pairing token. Signs JWT, persists DB row.
   */
  async generate(
    input: PairingGenerateInput
  ): Promise<PairingGenerateResult> {
    const now = this.now()
    const iat = Math.floor(now.getTime() / 1000)
    const exp = iat + PAIRING_TTL_SECONDS
    const jti = this.randomJti()

    const claims: PairingClaims = {
      sub: input.subscriptionId,
      org: input.organizationId,
      iat,
      exp,
      jti,
      typ: "vpn-pairing",
    }

    const pairingToken = this.signJwt(claims, now)
    const expiresAt = new Date(exp * 1000)

    await this.prisma.vpnPairingToken.create({
      data: {
        id: jti,
        subscriptionId: input.subscriptionId,
        token: pairingToken,
        expiresAt,
      },
    })

    return {
      pairingToken,
      expiresAt,
      qrPayload: pairingToken,
    }
  }

  /**
   * Validate a pairing JWT. Verifies signature, typ, and expiry.
   * Does NOT check the DB claimedAt state — use claim() for that.
   */
  validate(token: string): PairingClaims {
    return this.verifyJwt(token, this.now())
  }

  /**
   * Atomically claim a pairing token and provision the device.
   *
   * 1. Validate JWT (signature, typ, exp).
   * 2. Atomic claim: updateMany where {id: jti, claimedAt: null}.
   *    - count=0 → row already claimed OR expired; query row to disambiguate.
   * 3. Upsert VpnMobileDevice via VpnMobileDeviceService.create.
   * 4. Return { deviceId, subscriptionId, organizationId }.
   */
  async claim(
    input: PairingClaimInput
  ): Promise<{ deviceId: string; subscriptionId: string; organizationId: string }> {
    const claims = this.validate(input.pairingToken)
    const now = this.now()

    // Atomic claim — only one claimant wins.
    const result = await this.prisma.vpnPairingToken.updateMany({
      where: { id: claims.jti, claimedAt: null },
      data: { claimedAt: now },
    })

    if (result.count === 0) {
      // Disambiguate: already claimed vs expired-but-unclaimed.
      const row = await this.prisma.vpnPairingToken.findUnique({
        where: { id: claims.jti },
      })
      if (row?.claimedAt) {
        throw new VpnPairingTokenAlreadyUsedError()
      }
      throw new VpnPairingTokenExpiredError()
    }

    // Mark claimedByDevice after device create (best-effort — not in PRD
    // core flow, but useful for audit).
    const device = await this.deviceService.create({
      subscriptionId: claims.sub,
      organizationId: claims.org,
      deviceName: input.deviceName,
      deviceFingerprint: input.deviceFingerprint,
      platform: input.platform,
      osVersion: input.osVersion ?? null,
      appVersion: input.appVersion ?? null,
      pairedVia: "QR" as VpnPairingMethod,
    })

    await this.prisma.vpnPairingToken
      .update({
        where: { id: claims.jti },
        data: { claimedByDevice: device.id },
      })
      .catch(() => {
        // Best-effort audit field update. Claim already succeeded.
      })

    return {
      deviceId: device.id,
      subscriptionId: claims.sub,
      organizationId: claims.org,
    }
  }

  /**
   * Delete expired pairing tokens. Returns count of deleted rows.
   */
  async expireStale(): Promise<number> {
    const result = await this.prisma.vpnPairingToken.deleteMany({
      where: { expiresAt: { lt: this.now() } },
    })
    return result.count
  }

  /**
   * Polling endpoint for the portal QR UI.
   *
   * - valid: row exists, not claimed, not expired.
   * - claimed: row.claimedAt is set.
   * - expired: row missing or expiresAt < now.
   */
  async getStatus(token: string): Promise<PairingStatusResult> {
    // Validate JWT signature first — invalid tokens should not leak status.
    const claims = this.verifyJwt(token, this.now())
    const row = await this.prisma.vpnPairingToken.findUnique({
      where: { id: claims.jti },
    })
    if (!row) return { status: "expired" }
    if (row.claimedAt) {
      return { status: "claimed", claimedAt: row.claimedAt }
    }
    if (row.expiresAt < this.now()) return { status: "expired" }
    return { status: "valid" }
  }
}

export const vpnPairingTokenService = new VpnPairingTokenService()
