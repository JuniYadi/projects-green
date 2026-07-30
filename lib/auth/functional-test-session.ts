import { timingSafeEqual } from "node:crypto"

export const FUNCTIONAL_AUTH_SECRET_HEADER = "x-pfn-functional-test-auth-secret"
export const FUNCTIONAL_AUTH_ROLE_HEADER = "x-pfn-functional-test-role"
export const FUNCTIONAL_AUTH_VALIDATED_HEADER =
  "x-pfn-functional-test-validated"

export type FunctionalTestRole = "console" | "admin"

type FunctionalTestEnvironment = {
  FUNCTIONAL_TEST_MODE?: string
  FUNCTIONAL_TEST_AUTH_SECRET?: string
}

type FunctionalTestAuthResult =
  | { status: "disabled" }
  | { status: "invalid-role" }
  | { status: "authenticated"; role: FunctionalTestRole }

const IDENTITY_HEADERS = [
  "x-workos-authed",
  "x-workos-user-id",
  "x-workos-user-email",
  "x-workos-organization-id",
  "x-workos-session-role",
  "x-workos-session-roles",
  "x-workos-session",
  "x-workos-middleware",
  "x-url",
  FUNCTIONAL_AUTH_VALIDATED_HEADER,
] as const

const constantTimeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false
  const leftBuffer = Buffer.from(left) // Moved AFTER length check
  const rightBuffer = Buffer.from(right)
  return timingSafeEqual(leftBuffer, rightBuffer)
}

export const resolveFunctionalTestAuth = (
  headers: Headers,
  environment: FunctionalTestEnvironment
): FunctionalTestAuthResult => {
  const configuredSecret = environment.FUNCTIONAL_TEST_AUTH_SECRET?.trim() ?? ""
  const suppliedSecret =
    headers.get(FUNCTIONAL_AUTH_SECRET_HEADER)?.trim() ?? ""

  if (
    configuredSecret.length < 32 ||
    suppliedSecret.length === 0 ||
    !constantTimeEqual(configuredSecret, suppliedSecret)
  ) {
    return { status: "disabled" }
  }

  if (environment.FUNCTIONAL_TEST_MODE !== "true") {
    return { status: "disabled" }
  }

  const role = headers.get(FUNCTIONAL_AUTH_ROLE_HEADER)?.trim()
  if (role !== "console" && role !== "admin") {
    return { status: "invalid-role" }
  }

  return { status: "authenticated", role }
}

export const stripUntrustedIdentityHeaders = (headers: Headers) => {
  const sanitized = new Headers(headers)

  for (const header of IDENTITY_HEADERS) {
    sanitized.delete(header)
  }
  sanitized.delete(FUNCTIONAL_AUTH_SECRET_HEADER)
  sanitized.delete(FUNCTIONAL_AUTH_ROLE_HEADER)

  return sanitized
}

export const applyFunctionalTestIdentity = (
  headers: Headers,
  role: FunctionalTestRole,
  url: string
) => {
  const trusted = stripUntrustedIdentityHeaders(headers)
  const isAdmin = role === "admin"
  const userId = `functional_${role}_user`
  const roleClaim = isAdmin ? "admin_owner" : "user_member"

  trusted.set(FUNCTIONAL_AUTH_VALIDATED_HEADER, role)
  trusted.set("x-workos-middleware", "true")
  trusted.set("x-url", url)
  trusted.set("x-workos-authed", "true")
  trusted.set("x-workos-user-id", userId)
  trusted.set("x-workos-user-email", `${userId}@example.test`)
  trusted.set("x-workos-organization-id", "functional_test_org")
  trusted.set("x-workos-session-role", roleClaim)
  trusted.set("x-workos-session-roles", JSON.stringify([roleClaim]))

  return trusted
}

export const readFunctionalTestIdentity = (headers: Headers) => {
  const role = headers.get(FUNCTIONAL_AUTH_VALIDATED_HEADER)
  if (role !== "console" && role !== "admin") {
    return null
  }

  return {
    role,
    user: {
      id: `functional_${role}_user`,
      email: `functional_${role}_user@example.test`,
      emailVerified: true,
      firstName: "Functional",
      lastName: role === "admin" ? "Admin" : "User",
      name: role === "admin" ? "Functional Admin" : "Functional User",
      profilePictureUrl: null,
      object: "user" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      lastSignInAt: "2026-01-01T00:00:00.000Z",
      externalId: null,
      metadata: {},
      locale: null,
    },
    organizationId: "functional_test_org",
  }
}
