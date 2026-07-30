import { describe, expect, it } from "bun:test"

import {
  applyFunctionalTestIdentity,
  FUNCTIONAL_AUTH_ROLE_HEADER,
  FUNCTIONAL_AUTH_SECRET_HEADER,
  readFunctionalTestIdentity,
  resolveFunctionalTestAuth,
  stripUntrustedIdentityHeaders,
} from "./functional-test-session"

const SECRET = "functional-test-secret-at-least-32-characters"

const authenticatedHeaders = (role = "console") => {
  return new Headers({
    [FUNCTIONAL_AUTH_SECRET_HEADER]: SECRET,
    [FUNCTIONAL_AUTH_ROLE_HEADER]: role,
  })
}

describe("functional test session", () => {
  it("authenticates only with mode, a strong matching secret, and valid role", () => {
    expect(
      resolveFunctionalTestAuth(authenticatedHeaders(), {
        FUNCTIONAL_TEST_MODE: "true",
        FUNCTIONAL_TEST_AUTH_SECRET: SECRET,
      })
    ).toEqual({ status: "authenticated", role: "console" })
  })

  it("does not activate with only the role header", () => {
    expect(
      resolveFunctionalTestAuth(
        new Headers({ [FUNCTIONAL_AUTH_ROLE_HEADER]: "console" }),
        {
          FUNCTIONAL_TEST_MODE: "true",
          FUNCTIONAL_TEST_AUTH_SECRET: SECRET,
        }
      )
    ).toEqual({ status: "disabled" })
  })

  it("does not activate with only functional mode", () => {
    expect(
      resolveFunctionalTestAuth(new Headers(), {
        FUNCTIONAL_TEST_MODE: "true",
        FUNCTIONAL_TEST_AUTH_SECRET: SECRET,
      })
    ).toEqual({ status: "disabled" })
  })

  it("does not activate for blank, short, or incorrect secrets", () => {
    for (const configuredSecret of ["", "short", `${SECRET}-different`]) {
      expect(
        resolveFunctionalTestAuth(authenticatedHeaders(), {
          FUNCTIONAL_TEST_MODE: "true",
          FUNCTIONAL_TEST_AUTH_SECRET: configuredSecret,
        })
      ).toEqual({ status: "disabled" })
    }
  })

  it("does not activate with correct secret but missing FUNCTIONAL_TEST_MODE", () => {
    expect(
      resolveFunctionalTestAuth(authenticatedHeaders(), {
        FUNCTIONAL_TEST_AUTH_SECRET: SECRET,
      })
    ).toEqual({ status: "disabled" })
  })

  it("rejects invalid roles after authenticating the secret", () => {
    expect(
      resolveFunctionalTestAuth(authenticatedHeaders("owner"), {
        FUNCTIONAL_TEST_MODE: "true",
        FUNCTIONAL_TEST_AUTH_SECRET: SECRET,
      })
    ).toEqual({ status: "invalid-role" })
  })

  it("strips incoming identity headers", () => {
    const sanitized = stripUntrustedIdentityHeaders(
      new Headers({
        "x-workos-authed": "true",
        "x-workos-user-id": "attacker",
        "x-workos-session": "forged",
        "x-pfn-functional-test-validated": "console",
      })
    )

    expect([...sanitized]).toEqual([])
  })

  it("creates a fixed identity only after validation", () => {
    const trusted = applyFunctionalTestIdentity(
      new Headers(),
      "admin",
      "https://example.test/en/portal"
    )

    expect(trusted.get("x-workos-user-id")).toBe("functional_admin_user")
    expect(readFunctionalTestIdentity(trusted)).toMatchObject({
      role: "admin",
      organizationId: "functional_test_org",
    })
  })
})
