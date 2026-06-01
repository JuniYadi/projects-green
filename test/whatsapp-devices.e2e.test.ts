import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { whatsappAuthMock, setMockAuthContext } from "@/lib/whatsapp/__tests__/auth-mock"
import { workosNodeMock } from "./workos-node-mock"

// ─── Prisma mock ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindUnique = mock(async () => null as any)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindMany = mock(async () => [] as any)
const mockDelete = mock(async () => ({}))
const mockCreate = mock(async () => ({
  id: "dev_new",
  organizationId: "org-1",
  name: "New Device",
  phoneNumber: "+6281111111111",
  status: "ACTIVE",
  businessId: "bid_1",
  accessToken: "token_1",
  environment: "LIVE",
} as any))
const mockUpdate = mock(async () => ({
  id: "dev_1",
  organizationId: "org-1",
  name: "Updated Device",
  phoneNumber: "+6281111111111",
  status: "ACTIVE",
} as any))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}))

// ─── Auth mock ─────────────────────────────────────────────────────────────────

mock.module("@/lib/whatsapp/auth", () => whatsappAuthMock)

mock.module("@workos-inc/node", () => workosNodeMock)

const { devicesRoutes } = await import("@/modules/whatsapp/devices/api/devices.route")

function createTestApp() {
  return new Elysia()
    .use(whatsappAuthMock.whatsappAuthPlugin)
    .use(devicesRoutes)
}

// ─── Tests ─────────────────────────────────────────────────────────────────────────

describe("WhatsApp Devices E2E", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFindUnique.mockImplementation(async () => null as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFindMany.mockImplementation(async () => [] as any)

    // Reset auth to default admin
    setMockAuthContext({
      type: "workos",
      userId: "user-1",
      email: "admin@example.com",
      organizationId: "org-1",
      orgRole: "admin",
      platformRole: "none",
    })
  })

  // ── Create Device ─────────────────────────────────────────────────────────────

  it("creates a device and verifies it appears in list", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createdDevice = {
      id: "dev_new",
      organizationId: "org-1",
      name: "Test Device",
      phoneNumber: "+6281111111111",
      status: "ACTIVE",
      businessId: "bid_1",
      accessToken: "token_1",
    } as any

    mockCreate.mockImplementationOnce(async () => createdDevice)
    mockFindMany.mockImplementationOnce(async () => [createdDevice])

    setMockAuthContext({
      platformRole: "super_admin",
      organizationId: "org-1",
    })

    const app = createTestApp()

    const createResponse = await app.handle(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test Device",
          phoneNumber: "+6281111111111",
          businessId: "bid_1",
          accessToken: "token_1",
          environment: "LIVE",
        }),
      })
    )

    expect(createResponse.status).toBe(200)
    const createPayload = await createResponse.json() as { ok: boolean; device?: unknown }
    expect(createPayload.ok).toBe(true)
    expect(createPayload.device).toBeDefined()

    // Verify it appears in list
    const listResponse = await app.handle(new Request("http://localhost/"))
    expect(listResponse.status).toBe(200)
    const listPayload = await listResponse.json() as { ok: boolean; devices: unknown[] }
    expect(listPayload.ok).toBe(true)
    expect(listPayload.devices).toHaveLength(1)
    expect((listPayload.devices[0] as any).id).toBe("dev_new")
  })

  // ── GET Device ────────────────────────────────────────────────────────────────

  it("returns device data for valid ID", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deviceData = {
      id: "dev_get",
      organizationId: "org-1",
      name: "Get Test Device",
      phoneNumber: "+6282222222222",
      status: "ACTIVE",
    } as any

    mockFindUnique.mockImplementationOnce(async () => deviceData)

    setMockAuthContext({
      orgRole: "admin",
      organizationId: "org-1",
    })

    const app = createTestApp()

    const response = await app.handle(new Request("http://localhost/dev_get"))
    expect(response.status).toBe(200)
    const payload = await response.json() as { ok: boolean; device?: unknown }
    expect(payload.ok).toBe(true)
    expect((payload.device as any).id).toBe("dev_get")
    expect((payload.device as any).phoneNumber).toBe("+6282222222222")
  })

  it("returns 404 for non-existent device", async () => {
    setMockAuthContext({
      orgRole: "admin",
      organizationId: "org-1",
    })

    const app = createTestApp()

    const response = await app.handle(new Request("http://localhost/dev_missing"))
    expect(response.status).toBe(404)
    const payload = await response.json() as { ok: boolean; error: string }
    expect(payload.error).toBe("NOT_FOUND")
  })

  // ── PATCH Device ─────────────────────────────────────────────────────────────

  it("updates device and verifies the change", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalDevice = {
      id: "dev_patch",
      organizationId: "org-1",
      name: "Original Name",
      phoneNumber: "+6283333333333",
      status: "ACTIVE",
    } as any

    const updatedDevice = {
      ...originalDevice,
      name: "Updated Name",
    }

    mockFindUnique.mockImplementationOnce(async () => originalDevice)
    mockUpdate.mockImplementationOnce(async () => updatedDevice)

    setMockAuthContext({
      orgRole: "admin",
      organizationId: "org-1",
    })

    const app = createTestApp()

    // Update the device
    const patchResponse = await app.handle(
      new Request("http://localhost/dev_patch", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      })
    )

    expect(patchResponse.status).toBe(200)
    const patchPayload = await patchResponse.json() as { ok: boolean; device?: unknown }
    expect(patchPayload.ok).toBe(true)
    expect((patchPayload.device as any).name).toBe("Updated Name")

    // Verify the change by fetching the device
    mockFindUnique.mockImplementationOnce(async () => updatedDevice)

    const getResponse = await app.handle(new Request("http://localhost/dev_patch"))
    expect(getResponse.status).toBe(200)
    const getPayload = await getResponse.json() as { ok: boolean; device?: unknown }
    expect((getPayload.device as any).name).toBe("Updated Name")
  })

  // ── DELETE Device ────────────────────────────────────────────────────────────

  it("deletes device and verifies removal from list", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deviceToDelete = {
      id: "dev_del",
      organizationId: "org-1",
      name: "Device To Delete",
      phoneNumber: "+6284444444444",
      status: "ACTIVE",
    } as any

    mockFindMany.mockImplementationOnce(async () => [deviceToDelete])
    mockDelete.mockImplementationOnce(async () => ({}))

    setMockAuthContext({
      platformRole: "super_admin",
    })

    const app = createTestApp()

    // Verify device exists in list
    const listBeforeResponse = await app.handle(new Request("http://localhost/"))
    expect(listBeforeResponse.status).toBe(200)
    const listBeforePayload = await listBeforeResponse.json() as { ok: boolean; devices: unknown[] }
    expect(listBeforePayload.devices).toHaveLength(1)

    // Delete the device
    const deleteResponse = await app.handle(
      new Request("http://localhost/dev_del", {
        method: "DELETE",
      })
    )

    expect(deleteResponse.status).toBe(200)
    const deletePayload = await deleteResponse.json() as { ok: boolean; message: string }
    expect(deletePayload.ok).toBe(true)
    expect(deletePayload.message).toBe("Device deleted.")

    // Verify device no longer in list
    mockFindMany.mockImplementationOnce(async () => [])

    const listAfterResponse = await app.handle(new Request("http://localhost/"))
    expect(listAfterResponse.status).toBe(200)
    const listAfterPayload = await listAfterResponse.json() as { ok: boolean; devices: unknown[] }
    expect(listAfterPayload.devices).toHaveLength(0)
  })

  // ── Authorization ────────────────────────────────────────────────────────────

  it("returns 403 when non-admin tries to create device", async () => {
    setMockAuthContext({
      platformRole: "none",
      orgRole: "member",
    })

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Unauthorized Device",
          phoneNumber: "+6285555555555",
          businessId: "bid_1",
          accessToken: "token_1",
          environment: "LIVE",
        }),
      })
    )

    expect(response.status).toBe(403)
  })

  it("returns 403 when updating device from different organization", async () => {
    mockFindUnique.mockImplementationOnce(async () => ({
      id: "dev_other_org",
      organizationId: "org-other",
      name: "Other Org Device",
      phoneNumber: "+6286666666666",
      status: "ACTIVE",
    }))

    setMockAuthContext({
      organizationId: "org-1",
      orgRole: "admin",
    })

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/dev_other_org", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Hacked" }),
      })
    )

    expect(response.status).toBe(403)
  })
})

