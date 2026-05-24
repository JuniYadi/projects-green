import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"

const GITHUB_INSTALL_STATE_TTL_MS = 10 * 60 * 1000

export type GithubInstallStatePayload = {
  workosUserId: string
  organizationId: string | null
  returnTo: string
  nonce: string
  expiresAt: number
}

type GithubInstallStateNonceRecord = {
  nonceHash: string
  workosUserId: string
  organizationId: string | null
  expiresAt: Date
  consumedAt: Date | null
}

type GithubInstallStateNonceStore = {
  create: (args: {
    data: {
      nonceHash: string
      workosUserId: string
      organizationId: string | null
      expiresAt: Date
    }
  }) => Promise<unknown>
  findUnique: (args: {
    where: {
      nonceHash: string
    }
    select: {
      nonceHash: true
      workosUserId: true
      organizationId: true
      expiresAt: true
      consumedAt: true
    }
  }) => Promise<GithubInstallStateNonceRecord | null>
  updateMany: (args: {
    where: {
      nonceHash: string
      consumedAt: null
    }
    data: {
      consumedAt: Date
    }
  }) => Promise<{ count: number }>
}

const getDefaultNonceStore =
  async (): Promise<GithubInstallStateNonceStore> => {
    const { prisma } = await import("@/lib/prisma")
    return prisma.githubInstallStateNonce as unknown as GithubInstallStateNonceStore
  }

export class GithubInstallStateError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "GithubInstallStateError"
    this.code = code
  }
}

const toSha256Hex = (value: string) => {
  return createHash("sha256").update(value).digest("hex")
}

const createSignature = (payloadSegment: string, secret: string) => {
  return createHmac("sha256", secret).update(payloadSegment).digest("base64url")
}

export const getSafeReturnTo = (returnTo: string | null | undefined) => {
  if (!returnTo) {
    return "/console"
  }

  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/console"
  }

  return returnTo
}

const parsePayload = (state: string) => {
  const parts = state.split(".")

  if (parts.length !== 2) {
    throw new GithubInstallStateError(
      "INVALID_STATE",
      "GitHub install state is malformed."
    )
  }

  const [payloadSegment, signatureSegment] = parts

  if (!payloadSegment || !signatureSegment) {
    throw new GithubInstallStateError(
      "INVALID_STATE",
      "GitHub install state is malformed."
    )
  }

  let payloadJson = ""

  try {
    payloadJson = Buffer.from(payloadSegment, "base64url").toString("utf8")
  } catch {
    throw new GithubInstallStateError(
      "INVALID_STATE",
      "GitHub install state cannot be decoded."
    )
  }

  let payloadUnknown: unknown = null

  try {
    payloadUnknown = JSON.parse(payloadJson)
  } catch {
    throw new GithubInstallStateError(
      "INVALID_STATE",
      "GitHub install state is invalid JSON."
    )
  }

  if (!payloadUnknown || typeof payloadUnknown !== "object") {
    throw new GithubInstallStateError(
      "INVALID_STATE",
      "GitHub install state payload is invalid."
    )
  }

  const payload = payloadUnknown as Partial<GithubInstallStatePayload>

  if (
    typeof payload.workosUserId !== "string" ||
    (payload.organizationId !== null &&
      payload.organizationId !== undefined &&
      typeof payload.organizationId !== "string") ||
    typeof payload.returnTo !== "string" ||
    typeof payload.nonce !== "string" ||
    typeof payload.expiresAt !== "number"
  ) {
    throw new GithubInstallStateError(
      "INVALID_STATE",
      "GitHub install state payload fields are invalid."
    )
  }

  return {
    payload: {
      workosUserId: payload.workosUserId,
      organizationId: payload.organizationId ?? null,
      returnTo: getSafeReturnTo(payload.returnTo),
      nonce: payload.nonce,
      expiresAt: payload.expiresAt,
    } satisfies GithubInstallStatePayload,
    payloadSegment,
    signatureSegment,
  }
}

export const issueGithubInstallState = async ({
  workosUserId,
  organizationId,
  returnTo,
  secret,
  nonceStore,
  now = new Date(),
}: {
  workosUserId: string
  organizationId: string | null
  returnTo: string | null | undefined
  secret: string
  nonceStore?: GithubInstallStateNonceStore
  now?: Date
}) => {
  if (!secret.trim()) {
    throw new GithubInstallStateError(
      "MISSING_STATE_SECRET",
      "Missing GitHub install state secret."
    )
  }

  const nonce = randomBytes(18).toString("base64url")
  const expiresAt = now.getTime() + GITHUB_INSTALL_STATE_TTL_MS

  const payload: GithubInstallStatePayload = {
    workosUserId,
    organizationId,
    returnTo: getSafeReturnTo(returnTo),
    nonce,
    expiresAt,
  }

  const payloadSegment = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  )
  const signatureSegment = createSignature(payloadSegment, secret)

  const store = nonceStore ?? (await getDefaultNonceStore())

  await store.create({
    data: {
      nonceHash: toSha256Hex(nonce),
      workosUserId,
      organizationId,
      expiresAt: new Date(expiresAt),
    },
  })

  return {
    state: `${payloadSegment}.${signatureSegment}`,
    payload,
  }
}

export const validateGithubInstallState = async ({
  state,
  secret,
  nonceStore,
  now = new Date(),
}: {
  state: string | null
  secret: string
  nonceStore?: GithubInstallStateNonceStore
  now?: Date
}) => {
  if (!state) {
    throw new GithubInstallStateError(
      "MISSING_STATE",
      "GitHub install state is missing."
    )
  }

  if (!secret.trim()) {
    throw new GithubInstallStateError(
      "MISSING_STATE_SECRET",
      "Missing GitHub install state secret."
    )
  }

  const { payload, payloadSegment, signatureSegment } = parsePayload(state)

  const expectedSignature = createSignature(payloadSegment, secret)
  const expectedBuffer = Buffer.from(expectedSignature)
  const providedBuffer = Buffer.from(signatureSegment)

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw new GithubInstallStateError(
      "INVALID_SIGNATURE",
      "GitHub install state signature is invalid."
    )
  }

  const nowMs = now.getTime()

  if (payload.expiresAt <= nowMs) {
    throw new GithubInstallStateError(
      "EXPIRED_STATE",
      "GitHub install state has expired."
    )
  }

  const nonceHash = toSha256Hex(payload.nonce)
  const store = nonceStore ?? (await getDefaultNonceStore())
  const nonceRecord = await store.findUnique({
    where: { nonceHash },
    select: {
      nonceHash: true,
      workosUserId: true,
      organizationId: true,
      expiresAt: true,
      consumedAt: true,
    },
  })

  if (!nonceRecord) {
    throw new GithubInstallStateError(
      "INVALID_NONCE",
      "GitHub install state nonce was not found."
    )
  }

  if (nonceRecord.consumedAt) {
    throw new GithubInstallStateError(
      "NONCE_ALREADY_USED",
      "GitHub install state nonce has already been used."
    )
  }

  if (nonceRecord.expiresAt.getTime() <= nowMs) {
    throw new GithubInstallStateError(
      "EXPIRED_STATE",
      "GitHub install state nonce has expired."
    )
  }

  if (
    nonceRecord.workosUserId !== payload.workosUserId ||
    (nonceRecord.organizationId ?? null) !== payload.organizationId
  ) {
    throw new GithubInstallStateError(
      "INVALID_NONCE",
      "GitHub install state nonce context mismatch."
    )
  }

  const consumeResult = await store.updateMany({
    where: {
      nonceHash,
      consumedAt: null,
    },
    data: {
      consumedAt: now,
    },
  })

  if (consumeResult.count !== 1) {
    throw new GithubInstallStateError(
      "NONCE_ALREADY_USED",
      "GitHub install state nonce has already been consumed."
    )
  }

  return payload
}
