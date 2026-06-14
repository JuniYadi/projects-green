import { getWorkOS } from "@workos-inc/authkit-nextjs"
import {
  AuthenticationException,
  ConflictException,
  NotFoundException,
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

const getSessionCookieHeader = (sessionData: string, requestUrl: string) => {
  const cookieName = process.env.WORKOS_COOKIE_NAME?.trim() || "wos-session"
  const cookieDomain = process.env.WORKOS_COOKIE_DOMAIN?.trim()
  const sameSite = (
    process.env.WORKOS_COOKIE_SAMESITE?.trim() || "lax"
  ).toLowerCase()
  const safeSameSite =
    sameSite === "none" || sameSite === "strict" || sameSite === "lax"
      ? sameSite
      : "lax"

  const protocol = new URL(requestUrl).protocol
  const secure = safeSameSite === "none" || protocol === "https:"

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
  requestUrl: string
) => {
  return new Response(JSON.stringify({ ok: true as const }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": getSessionCookieHeader(sealedSession, requestUrl),
    },
  })
}

const ensureSealedSession = (sealedSession?: string | null) => {
  if (!sealedSession) {
    throw new Error("Failed to create session.")
  }

  return sealedSession
}

export type AuthService = {
  requestMagicCode(input: { email: string }): Promise<void>
  verifyMagicCode(input: {
    email: string
    code: string
    requestUrl: string
    invitationToken?: string
  }): Promise<Response>
  completeEmailVerification(input: {
    code: string
    pendingAuthenticationToken: string
    requestUrl: string
  }): Promise<Response>
  completeOrganizationSelection(input: {
    organizationId: string
    pendingAuthenticationToken: string
    requestUrl: string
  }): Promise<Response>
  signup(input: {
    name: string
    email: string
    password: string
    requestUrl: string
    invitationToken?: string
  }): Promise<Response>
  login(input: {
    email: string
    password: string
    requestUrl: string
    invitationToken?: string
  }): Promise<Response>
}

export const authService: AuthService = {
  async requestMagicCode({ email }) {
    try {
      await getWorkOS().userManagement.createMagicAuth({
        email,
      })
    } catch (error) {
      if (error instanceof NotFoundException) {
        return
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
}
