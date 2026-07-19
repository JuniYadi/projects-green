import "@/test/register"
import React from "react"
import { afterEach, expect, mock } from "bun:test"
import { cleanup, configure } from "@testing-library/react"
import * as matchers from "@testing-library/jest-dom/matchers"

// Prevent ioredis from attempting real connections during tests
mock.module("ioredis", () => ({
  default: class MockRedis {
    status = "end"
    get() {
      return Promise.resolve(null)
    }
    set() {
      return Promise.resolve("OK")
    }
    del() {
      return Promise.resolve(1)
    }
    exists() {
      return Promise.resolve(0)
    }
    expire() {
      return Promise.resolve(1)
    }
    on() {
      return this
    }
    quit() {
      return Promise.resolve("OK")
    }
    disconnect() {}
    connect() {}
  },
}))

// Happy DOM sets window.location.origin to "null" (the string), which causes
// Eden Treaty to build URLs like "null/api/...". Set the env var before any
// module that imports eden gets loaded.
if (!process.env.NEXT_PUBLIC_APP_URL) {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3300"
}

mock.module("react-icons/si", () => {
  const React = require("react")
  const createMock = (name: string) => (props: any) =>
    React.createElement(
      "div",
      { ...props, "data-testid": `si-${name.toLowerCase()}` },
      `${name} Icon`
    )

  return {
    SiWordpress: createMock("SiWordpress"),
    SiN8N: createMock("SiN8N"),
    SiDocker: createMock("SiDocker"),
    SiGhost: createMock("SiGhost"),
    SiStrapi: createMock("SiStrapi"),
    SiDirectus: createMock("SiDirectus"),
    SiPayloadcms: createMock("SiPayloadcms"),
    SiPocketbase: createMock("SiPocketbase"),
    SiUmami: createMock("SiUmami"),
    SiPlausibleanalytics: createMock("SiPlausibleanalytics"),
  }
})

mock.module("@workos-inc/node", () => {
  class MockWorkOSException extends Error {
    constructor(
      props?:
        | string
        | {
            message?: string
            code?: string
            requestID?: string
            path?: string
            errors?: unknown[]
          },
      _statusCode?: number,
      _requestID?: string
    ) {
      if (typeof props === "string") {
        super(props)
      } else if (props && props.message) {
        super(props.message)
      } else {
        super("WorkOS error")
      }
      this.name = new.target.name
    }
  }

  return {
    WorkOS: class WorkOS {},
    createWorkOS: () => ({}),
    // Exception classes used by auth / tenant / admin modules
    NotFoundException: class NotFoundException extends MockWorkOSException {},
    UnauthorizedException: class UnauthorizedException extends MockWorkOSException {},
    AuthenticationException: class AuthenticationException extends MockWorkOSException {
      data: unknown
      constructor(statusCode: number, data: unknown, requestID: string) {
        super(
          typeof data === "object" && data !== null && "message" in data
            ? (data as { message: string }).message
            : "auth error"
        )
        this.data = data
      }
    },
    ConflictException: class ConflictException extends MockWorkOSException {},
    UnprocessableEntityException: class UnprocessableEntityException extends MockWorkOSException {},
    BadRequestException: class BadRequestException extends MockWorkOSException {},
    // Stubs for remaining exports (unused in tests)
    ApiKeyRequiredException: class ApiKeyRequiredException extends MockWorkOSException {},
    GenericServerException: class GenericServerException extends MockWorkOSException {},
    RateLimitExceededException: class RateLimitExceededException extends MockWorkOSException {},
    OauthException: class OauthException extends MockWorkOSException {},
    SignatureVerificationException: class SignatureVerificationException extends MockWorkOSException {},
    NoApiKeyProvidedException: class NoApiKeyProvidedException extends MockWorkOSException {},
    isAuthenticationErrorData: mock(() => false),
    serializeRevokeSessionOptions: (opts: unknown) => opts,
    AutoPaginatable: class AutoPaginatable {},
    CookieSession: class CookieSession {},
    PKCE: class PKCE {},
    FeatureFlagsRuntimeClient: class FeatureFlagsRuntimeClient {},
    AuthenticateWithSessionCookieFailureReason: {},
    RefreshSessionFailureReason: {},
    ConnectionType: {},
    DomainDataState: {},
    GenerateLinkIntent: {},
    OrganizationDomainState: {},
    OrganizationDomainVerificationStrategy: {},
  }
})

mock.module("next/navigation", () => {
  const { mock } = require("bun:test")

  const routerMock = {
    push: mock(),
    replace: mock(),
    prefetch: mock(),
    back: mock(),
    refresh: mock(),
    forward: mock(),
  }

  return {
    useRouter: mock(() => routerMock),
    usePathname: mock(() => ""),
    useSearchParams: mock(() => new URLSearchParams()),
    useParams: mock(() => ({})),
    redirect: mock(),
    notFound: mock(),
  }
})

expect.extend(matchers)

// Increase default waitFor timeout for async components under coverage mode
// (single-process CI is 2-3x slower than local parallel mode)
configure({ asyncUtilTimeout: 5000 })

// Enable act() environment for React 18+ concurrent rendering in tests
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

if (!window.matchMedia) {
  Object.defineProperty(
    window as unknown as Record<string, unknown>,
    "matchMedia",
    {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    }
  )
}

// Note: Prisma mocking is done in individual test files using mock.module()
// to avoid module evaluation order issues with DATABASE_URL check

afterEach(() => {
  cleanup()
})
