import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import type {
  AdminActorContext,
  AdminApiError,
  RouteSet,
} from "@/modules/admin/api/admin.guards"
import type { WhatsappOrganizationApiKeysService } from "../organization-api-keys.service"

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

const { createAdminWhatsappOrganizationApiKeyRoutes } =
  await import("./organization-api-keys.route")
const {
  WhatsappOrganizationApiKeyAlreadyActiveError,
  WhatsappOrganizationApiKeyNotFoundError,
} = await import("../organization-api-keys.service")

const admin = {
  ok: true as const,
  userId: "admin-1",
  platformRole: "super_admin" as const,
}

type AdminGuard = (set: RouteSet) => Promise<AdminActorContext | AdminApiError>

const unauthorized = async (set: RouteSet): Promise<AdminApiError> => {
  set.status = 401
  return {
    ok: false,
    error: "UNAUTHORIZED",
    message: "You must be signed in.",
  }
}

const forbidden = async (set: RouteSet): Promise<AdminApiError> => {
  set.status = 403
  return {
    ok: false,
    error: "FORBIDDEN",
    message: "Super admin required.",
  }
}

const mockListInventory = mock(async () => ({
  data: [
    {
      organizationId: "org-1",
      organizationName: "Org One",
      status: "ACTIVE" as const,
      keyId: "key-1",
      fingerprint: "fingerprint-1",
      generatedKeyCount: 1,
      createdAt: "2026-08-14T10:00:00.000Z",
      rotatedAt: null,
      revokedAt: null,
      lastUsedAt: null,
    },
  ],
  summary: {
    generatedKeyTotal: 1,
    organizationsWithActiveKey: 1,
    organizationsWithoutActiveKey: 0,
  },
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
}))
const mockGenerate = mock(async () => ({
  key: {
    id: "key-1",
    organizationId: "org-1",
    fingerprint: "fingerprint-1",
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
    id: "key-0",
    organizationId: "org-1",
    fingerprint: "fingerprint-0",
    status: "REVOKED" as const,
    createdAt: "2026-08-01T10:00:00.000Z",
    rotatedAt: "2026-08-14T10:00:00.000Z",
    revokedAt: "2026-08-14T10:00:00.000Z",
    lastUsedAt: null,
  },
  key: {
    id: "key-2",
    organizationId: "org-1",
    fingerprint: "fingerprint-2",
    status: "ACTIVE" as const,
    createdAt: "2026-08-14T10:00:00.000Z",
    rotatedAt: null,
    revokedAt: null,
    lastUsedAt: null,
  },
  secret: "wa_live_rotated-secret",
}))
const mockRevoke = mock(async () => ({
  id: "key-1",
  organizationId: "org-1",
  fingerprint: "fingerprint-1",
  status: "REVOKED" as const,
  createdAt: "2026-08-14T10:00:00.000Z",
  rotatedAt: null,
  revokedAt: "2026-08-14T10:00:00.000Z",
  lastUsedAt: null,
}))

const service = {
  listInventory: mockListInventory,
  generate: mockGenerate,
  rotate: mockRotate,
  revoke: mockRevoke,
}

function createApp(requireSuperAdmin: AdminGuard = async () => admin) {
  return new Elysia().use(
    createAdminWhatsappOrganizationApiKeyRoutes({
      requireSuperAdmin,
      service: service as unknown as WhatsappOrganizationApiKeysService,
    })
  )
}

const BASE = "http://localhost/admin/whatsapp/organization-api-keys"

beforeEach(() => {
  mockListInventory.mockClear()
  mockGenerate.mockClear()
  mockRotate.mockClear()
  mockRevoke.mockClear()
  mockListInventory.mockImplementation(async () => ({
    data: [],
    summary: {
      generatedKeyTotal: 0,
      organizationsWithActiveKey: 0,
      organizationsWithoutActiveKey: 0,
    },
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  }))
  mockGenerate.mockImplementation(async () => ({
    key: {
      id: "key-1",
      organizationId: "org-1",
      fingerprint: "fingerprint-1",
      status: "ACTIVE" as const,
      createdAt: "2026-08-14T10:00:00.000Z",
      rotatedAt: null,
      revokedAt: null,
      lastUsedAt: null,
    },
    secret: "wa_live_one-time-secret",
  }))
  mockRotate.mockImplementation(async () => ({
    previousKey: {
      id: "key-0",
      organizationId: "org-1",
      fingerprint: "fingerprint-0",
      status: "REVOKED" as const,
      createdAt: "2026-08-01T10:00:00.000Z",
      rotatedAt: "2026-08-14T10:00:00.000Z",
      revokedAt: "2026-08-14T10:00:00.000Z",
      lastUsedAt: null,
    },
    key: {
      id: "key-2",
      organizationId: "org-1",
      fingerprint: "fingerprint-2",
      status: "ACTIVE" as const,
      createdAt: "2026-08-14T10:00:00.000Z",
      rotatedAt: null,
      revokedAt: null,
      lastUsedAt: null,
    },
    secret: "wa_live_rotated-secret",
  }))
  mockRevoke.mockImplementation(async () => ({
    id: "key-1",
    organizationId: "org-1",
    fingerprint: "fingerprint-1",
    status: "REVOKED" as const,
    createdAt: "2026-08-14T10:00:00.000Z",
    rotatedAt: null,
    revokedAt: "2026-08-14T10:00:00.000Z",
    lastUsedAt: null,
  }))
})

describe("admin WhatsApp organization API-key routes", () => {
  it("requires super-admin access before listing inventory", async () => {
    const response = await createApp(unauthorized).handle(
      new Request(`${BASE}/`)
    )
    expect(response.status).toBe(401)
    expect((await response.json()).error).toBe("UNAUTHORIZED")
    expect(mockListInventory).not.toHaveBeenCalled()
  })

  it("returns a paginated redacted inventory to super admins", async () => {
    mockListInventory.mockImplementationOnce(async () => ({
      data: [
        {
          organizationId: "org-1",
          organizationName: "Org One",
          status: "ACTIVE" as const,
          keyId: "key-1",
          fingerprint: "fingerprint-1",
          generatedKeyCount: 1,
          createdAt: "2026-08-14T10:00:00.000Z",
          rotatedAt: null,
          revokedAt: null,
          lastUsedAt: null,
        },
      ],
      summary: {
        generatedKeyTotal: 1,
        organizationsWithActiveKey: 1,
        organizationsWithoutActiveKey: 1,
      },
      pagination: { page: 2, limit: 1, total: 2, totalPages: 2 },
    }))
    const response = await createApp().handle(
      new Request(`${BASE}/?page=2&limit=1&status=ACTIVE`)
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.data[0].organizationId).toBe("org-1")
    expect(body.summary.organizationsWithoutActiveKey).toBe(1)
    expect(JSON.stringify(body)).not.toContain("keyHash")
    expect(JSON.stringify(body)).not.toContain("wa_live_")
    expect(mockListInventory).toHaveBeenCalledWith({
      page: 2,
      limit: 1,
      q: undefined,
      status: "ACTIVE",
    })
  })

  it("returns the one-time secret only from generation and supports lifecycle actions", async () => {
    const generated = await createApp().handle(
      new Request(`${BASE}/org-1`, { method: "POST" })
    )
    const generatedBody = await generated.json()
    expect(generated.status).toBe(201)
    expect(generatedBody.data.secret).toBe("wa_live_one-time-secret")
    expect(generatedBody.data.key).not.toHaveProperty("keyHash")
    expect(mockGenerate).toHaveBeenCalledWith({
      organizationId: "org-1",
      actorId: "admin-1",
    })

    const rotated = await createApp().handle(
      new Request(`${BASE}/org-1/rotate`, { method: "POST" })
    )
    expect(rotated.status).toBe(200)
    expect((await rotated.json()).data.secret).toBe("wa_live_rotated-secret")

    const revoked = await createApp().handle(
      new Request(`${BASE}/org-1/revoke`, { method: "POST" })
    )
    expect(revoked.status).toBe(200)
    expect((await revoked.json()).data.key.status).toBe("REVOKED")
  })

  it("maps lifecycle conflicts and missing active keys without leaking details", async () => {
    mockGenerate.mockImplementationOnce(async () => {
      throw new WhatsappOrganizationApiKeyAlreadyActiveError()
    })
    let response = await createApp().handle(
      new Request(`${BASE}/org-1`, { method: "POST" })
    )
    expect(response.status).toBe(409)
    expect((await response.json()).error).toBe("CONFLICT")

    mockRevoke.mockImplementationOnce(async () => {
      throw new WhatsappOrganizationApiKeyNotFoundError()
    })
    response = await createApp().handle(
      new Request(`${BASE}/org-1/revoke`, { method: "POST" })
    )
    expect(response.status).toBe(404)
    expect((await response.json()).error).toBe("NOT_FOUND")
  })

  it("rejects authenticated non-super-admins", async () => {
    const response = await createApp(forbidden).handle(new Request(`${BASE}/`))
    expect(response.status).toBe(403)
    expect((await response.json()).error).toBe("FORBIDDEN")
  })
})
