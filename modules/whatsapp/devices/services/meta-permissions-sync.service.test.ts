import { beforeEach, describe, expect, it, mock } from "bun:test"
import { syncMetaDevicePermissions } from "./meta-permissions-sync.service"

const mockDeviceFindUnique = mock()
const mockDeviceUpdate = mock()
const mockLogWhatsappAuditEvent = mock()

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findUnique: mockDeviceFindUnique,
      update: mockDeviceUpdate,
    },
  },
}))

mock.module(
  "@/modules/whatsapp/meta-apps/services/meta-credentials-resolver.service",
  () => ({
    resolveDecryptedDeviceMetaToken: mock(async () => ({
      token: "mock-decrypted-token",
      version: "v24.0",
      tokenSource: "DEVICE_OVERRIDE",
    })),
  })
)

mock.module("@/modules/whatsapp/audit/whatsapp-audit.service", () => ({
  logWhatsappAuditEvent: mockLogWhatsappAuditEvent,
}))

const defaultDevice = {
  id: "device-1",
  phoneNumber: "+628123456789",
  organizationId: "org-1",
  whatsappBusinessAccountId: "waba-123",
  whatsappVersion: "v24.0",
  tokenEncrypted: "enc-token",
  features: null,
  whatsappMetaApp: {
    metaAppId: "meta-app-1",
    name: "PFNApp",
    systemTokenEncrypted: null,
    defaultVersion: "v24.0",
  },
}

describe("syncMetaDevicePermissions", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    mockDeviceFindUnique.mockReset()
    mockDeviceUpdate.mockReset()
    mockLogWhatsappAuditEvent.mockReset()
    mockDeviceFindUnique.mockResolvedValue(defaultDevice)
    mockDeviceUpdate.mockResolvedValue({})
    mockLogWhatsappAuditEvent.mockResolvedValue(undefined)
  })

  it("throws an error when device is not found", async () => {
    mockDeviceFindUnique.mockResolvedValueOnce(null)

    await expect(syncMetaDevicePermissions("missing")).rejects.toThrow(
      "Device not found: missing"
    )
  })

  it("returns NO_WABA_CONFIGURED when device has no whatsappBusinessAccountId", async () => {
    mockDeviceFindUnique.mockResolvedValueOnce({
      ...defaultDevice,
      whatsappBusinessAccountId: null,
    })

    const res = await syncMetaDevicePermissions("device-1")
    expect(res.status).toBe("NO_WABA_CONFIGURED")
    expect(res.canManageTemplates).toBe(false)
    expect(mockDeviceUpdate).toHaveBeenCalled()
  })

  it("marks GRANTED when system user has MANAGE task on WABA", async () => {
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes("debug_token")) {
        return new Response(
          JSON.stringify({
            data: {
              user_id: "sys-user-1",
              scopes: ["whatsapp_business_management"],
            },
          }),
          { status: 200 }
        )
      }
      if (urlStr.includes("fields=id,name,owner_business_info")) {
        return new Response(
          JSON.stringify({
            id: "waba-123",
            name: "Test WABA",
            owner_business_info: { id: "biz-123", name: "My Business" },
          }),
          { status: 200 }
        )
      }
      if (urlStr.includes("assigned_users")) {
        return new Response(
          JSON.stringify({
            data: [
              { id: "sys-user-1", name: "krmpesan-su", tasks: ["MANAGE"] },
              { id: "admin-1", name: "Admin", tasks: ["MANAGE"] },
            ],
          }),
          { status: 200 }
        )
      }
      return new Response("{}", { status: 404 })
    }) as unknown as typeof fetch

    try {
      const res = await syncMetaDevicePermissions("device-1")
      expect(res.status).toBe("GRANTED")
      expect(res.canManageTemplates).toBe(true)
      expect(res.systemUserId).toBe("sys-user-1")
      expect(res.systemUserName).toBe("krmpesan-su")
      expect(res.businessId).toBe("biz-123")
      expect(res.warning).toBeNull()
      expect(mockLogWhatsappAuditEvent).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("marks NOT_ASSIGNED and audits warning when system user is missing from assigned_users", async () => {
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes("debug_token")) {
        return new Response(
          JSON.stringify({
            data: {
              user_id: "sys-user-unassigned",
              scopes: ["whatsapp_business_management"],
            },
          }),
          { status: 200 }
        )
      }
      if (urlStr.includes("fields=id,name,owner_business_info")) {
        return new Response(
          JSON.stringify({
            id: "waba-123",
            owner_business_info: { id: "biz-123", name: "My Business" },
          }),
          { status: 200 }
        )
      }
      if (urlStr.includes("assigned_users")) {
        return new Response(
          JSON.stringify({
            data: [{ id: "admin-1", name: "Admin", tasks: ["MANAGE"] }],
          }),
          { status: 200 }
        )
      }
      return new Response("{}", { status: 404 })
    }) as unknown as typeof fetch

    try {
      const res = await syncMetaDevicePermissions("device-1")
      expect(res.status).toBe("NOT_ASSIGNED")
      expect(res.canManageTemplates).toBe(false)
      expect(res.warning).toContain("System User token is not assigned")
      expect(mockLogWhatsappAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "DEVICE_META_PERMISSION_MISSING",
          status: "WARNING",
        })
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("marks MISSING_MANAGE_TASK when system user is assigned but lacks MANAGE task", async () => {
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes("debug_token")) {
        return new Response(
          JSON.stringify({
            data: {
              user_id: "sys-user-read-only",
              scopes: ["whatsapp_business_management"],
            },
          }),
          { status: 200 }
        )
      }
      if (urlStr.includes("fields=id,name,owner_business_info")) {
        return new Response(
          JSON.stringify({
            id: "waba-123",
            owner_business_info: { id: "biz-123", name: "My Business" },
          }),
          { status: 200 }
        )
      }
      if (urlStr.includes("assigned_users")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "sys-user-read-only",
                name: "Agent",
                tasks: ["DEVELOP"],
              },
            ],
          }),
          { status: 200 }
        )
      }
      return new Response("{}", { status: 404 })
    }) as unknown as typeof fetch

    try {
      const res = await syncMetaDevicePermissions("device-1")
      expect(res.status).toBe("MISSING_MANAGE_TASK")
      expect(res.canManageTemplates).toBe(false)
      expect(res.warning).toContain("lacks the MANAGE task")
      expect(mockLogWhatsappAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "DEVICE_META_PERMISSION_MISSING",
          status: "WARNING",
        })
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
