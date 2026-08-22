import { getWorkOS } from "@workos-inc/authkit-nextjs"
import { isSecureRequest } from "@/lib/request-url"
import {
  AuthenticationException,
  BadRequestException,
  ConflictException,
  GenericServerException,
  NotFoundException,
  OauthException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@workos-inc/node"

export class MissingAuthConfigurationError extends Error {
  constructor() {
    super("Missing WorkOS auth configuration.")
    this.name = "MissingAuthConfigurationError"
  }
}

export class InvalidAuthCredentialsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidAuthCredentialsError"
  }
}

export class AuthValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthValidationError"
  }
}

export class AuthEmailAlreadyExistsError extends Error {
  constructor() {
    super("An account with this email already exists.")
    this.name = "AuthEmailAlreadyExistsError"
  }
}

const getWorkosClientId = () => process.env.WORKOS_CLIENT_ID?.trim()

const getWorkosCookiePassword = () => process.env.WORKOS_COOKIE_PASSWORD?.trim()

const getCookieMaxAge = () => {
  const raw = process.env.WORKOS_COOKIE_MAX_AGE
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN

  return Number.isFinite(parsed) ? parsed : 60 * 60 * 24 * 400
}
const getSessionCookieHeader = (
  sessionData: string,
  requestUrlOrRequest?: string | Request | { headers?: Headers; url?: string }
) => {
  const cookieName = process.env.WORKOS_COOKIE_NAME?.trim() || "wos-session"
  const cookieDomain = process.env.WORKOS_COOKIE_DOMAIN?.trim()
  const sameSite = (
    process.env.WORKOS_COOKIE_SAMESITE?.trim() || "lax"
  ).toLowerCase()
  const safeSameSite =
    sameSite === "none" || sameSite === "strict" || sameSite === "lax"
      ? sameSite
      : "lax"

  const secure = safeSameSite === "none" || isSecureRequest(requestUrlOrRequest)
  const parts = [
    `${cookieName}=${sessionData}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${safeSameSite.charAt(0).toUpperCase()}${safeSameSite.slice(1)}`,
    `Max-Age=${getCookieMaxAge()}`,
  ]

  if (cookieDomain) {
    parts.push(`Domain=${cookieDomain}`)
  }

  if (secure) {
    parts.push("Secure")
  }

  return parts.join("; ")
}

const splitName = (name: string) => {
  const [firstName, ...rest] = name.trim().split(/\s+/)

  return {
    firstName,
    lastName: rest.length > 0 ? rest.join(" ") : undefined,
  }
}

const getAuthConfig = () => {
  const clientId = getWorkosClientId()
  const cookiePassword = getWorkosCookiePassword()

  if (!clientId || !cookiePassword) {
    throw new MissingAuthConfigurationError()
  }

  return {
    clientId,
    cookiePassword,
  }
}

const toSessionResponse = (
  status: number,
  sealedSession: string,
  requestUrl?: string | Request | { headers?: Headers; url?: string }
) => {
  const response = new Response(JSON.stringify({ ok: true as const }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })
  response.headers.set(
    "Set-Cookie",
    getSessionCookieHeader(sealedSession, requestUrl)
  )
  return response
}

const ensureSealedSession = (sealedSession?: string | null) => {
  if (!sealedSession) {
    throw new Error("Failed to create session.")
  }

  return sealedSession
}

const isSafeAuthUserMessage = (message: unknown): message is string => {
  if (typeof message !== "string") return false
  const trimmed = message.trim()
  if (!trimmed || trimmed.length > 160 || /[\r\n]/.test(trimmed)) return false
  if (
    /(exception|stack|requestid|econn|fetch failed|internal server)/i.test(
      trimmed
    )
  ) {
    return false
  }
  return true
}

const toInvalidMagicCodeError = (error: unknown) => {
  const candidate =
    error instanceof OauthException
      ? error.errorDescription || error.error
      : error instanceof Error
        ? error.message
        : undefined
  return new InvalidAuthCredentialsError(
    isSafeAuthUserMessage(candidate)
      ? candidate.trim()
      : "Invalid or expired verification code."
  )
}

export type AuthService = {
  requestMagicCode(input: { email: string }): Promise<void>
  verifyMagicCode(input: {
    email: string
    code: string
    requestUrl: string | Request | { headers?: Headers; url?: string }
    invitationToken?: string
  }): Promise<Response>
  completeEmailVerification(input: {
    code: string
    pendingAuthenticationToken: string
    requestUrl: string | Request | { headers?: Headers; url?: string }
  }): Promise<Response>
  completeOrganizationSelection(input: {
    organizationId: string
    pendingAuthenticationToken: string
    requestUrl: string | Request | { headers?: Headers; url?: string }
  }): Promise<Response>
  signup(input: {
    name: string
    email: string
    password: string
    requestUrl: string | Request | { headers?: Headers; url?: string }
    invitationToken?: string
  }): Promise<Response>
  login(input: {
    email: string
    password: string
    requestUrl: string | Request | { headers?: Headers; url?: string }
    invitationToken?: string
  }): Promise<Response>
  updateProfile(input: {
    userId: string
    firstName?: string
    lastName?: string
    profilePictureUrl?: string
  }): Promise<{
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    profilePictureUrl: string | null
  }>
  getUserDetails(userId: string): Promise<{
    user: {
      id: string
      email: string
      emailVerified: boolean
      firstName: string | null
      lastName: string | null
      name: string | null
      profilePictureUrl: string | null
      createdAt: string
      lastSignInAt: string | null
    }
    identities: Array<{
      type: string
      provider: string
      idpId?: string
    }>
    sessions: Array<{
      id: string
      status: string
      authMethod: string | null
      ipAddress: string | null
      userAgent: string | null
      createdAt: string
      expiresAt: string
    }>
  }>
  revokeUserSession(sessionId: string): Promise<void>
}

export const authService: AuthService = {
  async requestMagicCode({ email }) {
    try {
      await getWorkOS().userManagement.createMagicAuth({
        email,
      })
    } catch (error) {
      if (error instanceof NotFoundException) {
      }

      if (error instanceof UnprocessableEntityException) {
        throw new AuthValidationError(error.message)
      }

      throw error
    }
  },
  async verifyMagicCode({ email, code, requestUrl, invitationToken }) {
    const { clientId, cookiePassword } = getAuthConfig()

    try {
      const authResponse =
        await getWorkOS().userManagement.authenticateWithMagicAuth({
          clientId,
          email,
          code,
          ...(invitationToken ? { invitationToken } : {}),
          session: {
            sealSession: true,
            cookiePassword,
          },
        })

      const sealedSession = ensureSealedSession(authResponse.sealedSession)

      return toSessionResponse(200, sealedSession, requestUrl)
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof AuthenticationException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof OauthException ||
        (error instanceof GenericServerException &&
          typeof error.status === "number" &&
          error.status >= 400 &&
          error.status < 500)
      ) {
        throw toInvalidMagicCodeError(error)
      }

      if (error instanceof UnprocessableEntityException) {
        throw new AuthValidationError(error.message)
      }

      throw error
    }
  },
  async completeEmailVerification({
    code,
    pendingAuthenticationToken,
    requestUrl,
  }) {
    const { clientId, cookiePassword } = getAuthConfig()

    try {
      const authResponse =
        await getWorkOS().userManagement.authenticateWithEmailVerification({
          clientId,
          code,
          pendingAuthenticationToken,
          session: {
            sealSession: true,
            cookiePassword,
          },
        })

      const sealedSession = ensureSealedSession(authResponse.sealedSession)

      return toSessionResponse(200, sealedSession, requestUrl)
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof AuthenticationException ||
        error instanceof NotFoundException
      ) {
        throw new InvalidAuthCredentialsError(
          "Invalid or expired verification code."
        )
      }

      if (error instanceof UnprocessableEntityException) {
        throw new AuthValidationError(error.message)
      }

      throw error
    }
  },
  async completeOrganizationSelection({
    organizationId,
    pendingAuthenticationToken,
    requestUrl,
  }) {
    const { clientId, cookiePassword } = getAuthConfig()

    try {
      const authResponse =
        await getWorkOS().userManagement.authenticateWithOrganizationSelection({
          clientId,
          organizationId,
          pendingAuthenticationToken,
          session: {
            sealSession: true,
            cookiePassword,
          },
        })

      const sealedSession = ensureSealedSession(authResponse.sealedSession)

      return toSessionResponse(200, sealedSession, requestUrl)
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof AuthenticationException ||
        error instanceof NotFoundException
      ) {
        throw new InvalidAuthCredentialsError(
          "Invalid or expired authentication session. Please login again."
        )
      }

      if (error instanceof UnprocessableEntityException) {
        throw new AuthValidationError(error.message)
      }

      throw error
    }
  },
  async signup({ name, email, password, requestUrl, invitationToken }) {
    const { clientId, cookiePassword } = getAuthConfig()
    const { firstName, lastName } = splitName(name)

    try {
      await getWorkOS().userManagement.createUser({
        email,
        password,
        firstName,
        lastName,
      })

      const authResponse =
        await getWorkOS().userManagement.authenticateWithPassword({
          clientId,
          email,
          password,
          ...(invitationToken ? { invitationToken } : {}),
          session: {
            sealSession: true,
            cookiePassword,
          },
        })

      const sealedSession = ensureSealedSession(authResponse.sealedSession)

      return toSessionResponse(201, sealedSession, requestUrl)
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new AuthEmailAlreadyExistsError()
      }

      if (error instanceof UnprocessableEntityException) {
        throw new AuthValidationError(error.message)
      }

      throw error
    }
  },
  async login({ email, password, requestUrl, invitationToken }) {
    const { clientId, cookiePassword } = getAuthConfig()

    try {
      const authResponse =
        await getWorkOS().userManagement.authenticateWithPassword({
          clientId,
          email,
          password,
          ...(invitationToken ? { invitationToken } : {}),
          session: {
            sealSession: true,
            cookiePassword,
          },
        })

      const sealedSession = ensureSealedSession(authResponse.sealedSession)

      return toSessionResponse(200, sealedSession, requestUrl)
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof AuthenticationException
      ) {
        throw new InvalidAuthCredentialsError("Invalid email or password.")
      }

      throw error
    }
  },
  async updateProfile({ userId, firstName, lastName, profilePictureUrl }) {
    try {
      const updatedUser = await getWorkOS().userManagement.updateUser({
        userId,
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(profilePictureUrl !== undefined ? { profilePictureUrl } : {}),
      })

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName ?? null,
        lastName: updatedUser.lastName ?? null,
        profilePictureUrl: updatedUser.profilePictureUrl ?? null,
      }
    } catch (error) {
      if (error instanceof UnprocessableEntityException) {
        throw new AuthValidationError(error.message)
      }
      throw error
    }
  },
  async getUserDetails(userId: string) {
    const workos = getWorkOS()
    const [user, identities, sessions] = await Promise.all([
      workos.userManagement.getUser(userId),
      workos.userManagement.getUserIdentities(userId).catch(() => []),
      workos.userManagement.listSessions(userId).catch(() => ({ data: [] })),
    ])

    return {
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        name: user.name ?? null,
        profilePictureUrl: user.profilePictureUrl ?? null,
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt ?? null,
      },
      identities: identities.map((id) => ({
        type: id.type,
        provider: id.provider,
        idpId: id.idpId,
      })),
      sessions: (sessions.data || []).map((s) => ({
        id: s.id,
        status: s.status,
        authMethod: s.authMethod ?? null,
        ipAddress: s.ipAddress ?? null,
        userAgent: s.userAgent ?? null,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
    }
  },
  async revokeUserSession(sessionId: string) {
    await getWorkOS().userManagement.revokeSession({ sessionId })
  },
}
