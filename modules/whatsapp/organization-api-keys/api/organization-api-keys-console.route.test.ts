import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

mock.module("@/lib/prisma", () => ({ prisma: {} }))
mock.module("@/lib/workos-directory", () => ({
  listCachedOrganizations: mock(async () => []),
}))
mock.module("@/lib/whatsapp/crypto", () => ({
  generateRawApiKey: mock(async () => ({ raw: "secret", hash: "hash" })),
}))
mock.module("@/modules/whatsapp/audit/whatsapp-audit.service", () => ({
  logWhatsappAuditEvent: mock(async () => {}),
}))

type MockAuthContext = {
  type: "workos"
  userId: string
  organizationId: string | null
  platformRole: "none" | "super_admin"
  orgRole: "admin" | "owner" | "member"
} | null

const mockAuthContext: { current: MockAuthContext } = {
  current: {
    type: "workos",
    userId: "user-a",
    organizationId: "org-a",
    platformRole: "none",
    orgRole: "admin",
  },
}

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

const { createConsoleWhatsappOrganizationApiKeyRoutes } =
  await import("./organization-api-keys-console.route")
const {
  WhatsappOrganizationApiKeyAlreadyActiveError,
  WhatsappOrganizationApiKeyNotFoundError,
} = await import("../organization-api-keys.service")

const state = {
  status: "ACTIVE" as const,
  keyId: "key-a",
  fingerprint: "fingerprint-a",
  generatedKeyCount: 1,
  createdAt: "2026-08-14T10:00:00.000Z",
  rotatedAt: null,
  revokedAt: null,
  lastUsedAt: null,
}

const mockGetState = mock(async () => state)
const mockGenerate = mock(async () => ({
  key: {
    id: "key-a",
    organizationId: "org-a",
    fingerprint: "fingerprint-a",
    status: "ACTIVE" as const,
    createdAt: "2026-08-14T10:00:00.000Z",
    rotatedAt: null,
    revokedAt: null,
    lastUsedAt: null,
  },
  secret: "wa_live_one-time-secret",
}))
const mockRotate = mock(async () => ({
  previousKey: {
    id: "key-old",
    organizationId: "org-a",
    fingerprint: "fingerprint-old",
    status: "REVOKED" as const,
    createdAt: "2026-08-01T10:00:00.000Z",
    rotatedAt: "2026-08-14T10:00:00.000Z",
    revokedAt: "2026-08-14T10:00:00.000Z",
    lastUsedAt: null,
  },
  key: {
    id: "key-a-2",
    organizationId: "org-a",
    fingerprint: "fingerprint-a-2",
    status: "ACTIVE" as const,
    createdAt: "2026-08-14T10:00:00.000Z",
    rotatedAt: null,
    revokedAt: null,
    lastUsedAt: null,
  },
  secret: "wa_live_rotated-secret",
}))
const mockRevoke = mock(async () => ({
  id: "key-a",
  organizationId: "org-a",
  fingerprint: "fingerprint-a",
  status: "REVOKED" as const,
  createdAt: "2026-08-14T10:00:00.000Z",
  rotatedAt: null,
  revokedAt: "2026-08-14T10:00:00.000Z",
  lastUsedAt: null,
}))

const service = {
  getOrganizationKeyState: mockGetState,
  generate: mockGenerate,
  rotate: mockRotate,
  revoke: mockRevoke,
}

const createApp = () =>
  new Elysia().use(
    createConsoleWhatsappOrganizationApiKeyRoutes({
      service: service as never,
    })
  )

const BASE = "http://localhost/organization-api-keys/self"

beforeEach(() => {
  mockAuthContext.current = {
    type: "workos",
    userId: "user-a",
    organizationId: "org-a",
    platformRole: "none",
    orgRole: "admin",
  }
  mockGetState.mockClear()
  mockGenerate.mockClear()
  mockRotate.mockClear()
  mockRevoke.mockClear()
})

describe("console WhatsApp organization API-key routes", () => {
  it("returns self state and ignores a client organization ID", async () => {
    const response = await createApp().handle(
      new Request(`${BASE}?organizationId=org-b`)
    )

    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual(state)
    expect(mockGetState).toHaveBeenCalledWith("org-a")
  })

  it("supports generation, rotation, and revocation for the auth organization", async () => {
    const generated = await createApp().handle(
      new Request(BASE, {
        method: "POST",
        body: JSON.stringify({ organizationId: "org-b" }),
        headers: { "content-type": "application/json" },
      })
    )
    expect(generated.status).toBe(201)
    expect((await generated.json()).data.secret).toBe("wa_live_one-time-secret")
    expect(mockGenerate).toHaveBeenCalledWith({
      organizationId: "org-a",
      actorId: "user-a",
    })

    const rotated = await createApp().handle(
      new Request(`${BASE}/rotate?organizationId=org-b`, {
        method: "POST",
        body: JSON.stringify({ organizationId: "org-b" }),
        headers: { "content-type": "application/json" },
      })
    )
    expect(rotated.status).toBe(200)
    expect((await rotated.json()).data.secret).toBe("wa_live_rotated-secret")
    expect(mockRotate).toHaveBeenCalledWith({
      organizationId: "org-a",
      actorId: "user-a",
    })

    const revoked = await createApp().handle(
      new Request(`${BASE}/revoke?organizationId=org-b`, {
        method: "POST",
        body: JSON.stringify({ organizationId: "org-b" }),
        headers: { "content-type": "application/json" },
      })
    )
    expect(revoked.status).toBe(200)
    expect((await revoked.json()).data.key.status).toBe("REVOKED")
    expect(mockRevoke).toHaveBeenCalledWith({
      organizationId: "org-a",
      actorId: "user-a",
    })
  })

  it("rejects unauthenticated and non-admin users", async () => {
    mockAuthContext.current = null
    let response = await createApp().handle(new Request(BASE))
    expect(response.status).toBe(401)
    expect(mockGetState).not.toHaveBeenCalled()

    mockAuthContext.current = {
      type: "workos",
      userId: "user-a",
      organizationId: "org-a",
      platformRole: "none",
      orgRole: "member",
    }
    response = await createApp().handle(new Request(BASE))
    expect(response.status).toBe(403)
    expect(mockGetState).not.toHaveBeenCalled()
  })

  it("requires a workos organization context", async () => {
    mockAuthContext.current = {
      type: "workos",
      userId: "user-a",
      organizationId: null,
      platformRole: "none",
      orgRole: "admin",
    }
    const response = await createApp().handle(new Request(BASE))
    expect(response.status).toBe(400)
    expect(mockGetState).not.toHaveBeenCalled()
  })

  it("maps generation conflicts and missing lifecycle keys", async () => {
    mockGenerate.mockImplementationOnce(async () => {
      throw new WhatsappOrganizationApiKeyAlreadyActiveError()
    })
    let response = await createApp().handle(
      new Request(BASE, { method: "POST" })
    )
    expect(response.status).toBe(409)

    mockRotate.mockImplementationOnce(async () => {
      throw new WhatsappOrganizationApiKeyNotFoundError()
    })
    response = await createApp().handle(
      new Request(`${BASE}/rotate`, { method: "POST" })
    )
    expect(response.status).toBe(404)

    mockRevoke.mockImplementationOnce(async () => {
      throw new WhatsappOrganizationApiKeyNotFoundError()
    })
    response = await createApp().handle(
      new Request(`${BASE}/revoke`, { method: "POST" })
    )
    expect(response.status).toBe(404)
  })
})
