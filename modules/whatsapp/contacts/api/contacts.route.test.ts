import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import {
  setMockAuthContext,
  mockAuthContext,
} from "@/lib/whatsapp/__tests__/auth-mock"
import { workosNodeMock } from "../../../../test/workos-node-mock"

// ─── Prisma mock ────────────────────────────────────────────────────────────

const mockGroupFindFirst = mock(async (): Promise<any> => null)
const mockGroupCreate = mock(async (): Promise<any> => ({
  id: "group_default",
  organizationId: "org_1",
  name: "Ungrouped",
}))
const mockContactFindFirst = mock(async (): Promise<any> => null)
const mockContactCreate = mock(async (args: any): Promise<any> => ({
  id: "contact_1",
  ...args.data,
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappContactGroup: {
      findFirst: mockGroupFindFirst,
      create: mockGroupCreate,
    },
    whatsappContact: {
      findFirst: mockContactFindFirst,
      create: mockContactCreate,
    },
  },
}))

mock.module("@workos-inc/node", () => workosNodeMock)

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

const { contactsRoutes } = await import("./contacts.route")

function createTestApp() {
  return new Elysia().use(contactsRoutes)
}

function postContact(body: Record<string, unknown>) {
  return new Request("http://localhost/contacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("contacts routes — create", () => {
  beforeEach(() => {
    mockGroupFindFirst.mockClear()
    mockGroupCreate.mockClear()
    mockContactFindFirst.mockClear()
    mockContactCreate.mockClear()
    mockGroupFindFirst.mockImplementation(async () => null)
    mockGroupCreate.mockImplementation(async () => ({
      id: "group_default",
      organizationId: "org_1",
      name: "Ungrouped",
    }))
    mockContactFindFirst.mockImplementation(async () => null)
    mockContactCreate.mockImplementation(async (args: any) => ({
      id: "contact_1",
      ...args.data,
    }))
    setMockAuthContext({
      type: "workos",
      userId: "user_1",
      email: "admin@example.com",
      organizationId: "org_1",
      orgRole: "admin",
      platformRole: "none",
    })
  })

  it("auto-assigns a default audience when no group is provided", async () => {
    const app = createTestApp()

    const response = await app.handle(
      postContact({
        phoneNumber: "+62811111111",
        name: "John Doe",
        email: "john@example.com",
      }),
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      ok: boolean
      contact: { contactGroupId: string }
    }
    expect(payload.ok).toBe(true)
    expect(payload.contact.contactGroupId).toBe("group_default")
    // Default group was created because none existed yet.
    expect(mockGroupCreate).toHaveBeenCalledTimes(1)
  })

  it("reuses an existing default audience group instead of recreating it", async () => {
    mockGroupFindFirst.mockImplementation(async () => ({
      id: "group_existing_default",
      organizationId: "org_1",
      name: "Ungrouped",
    }))

    const app = createTestApp()

    const response = await app.handle(
      postContact({
        phoneNumber: "+62822222222",
        name: "Jane Doe",
        email: "jane@example.com",
      }),
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      contact: { contactGroupId: string }
    }
    expect(payload.contact.contactGroupId).toBe("group_existing_default")
    expect(mockGroupCreate).not.toHaveBeenCalled()
  })

  it("uses the provided group when it belongs to the organization", async () => {
    mockGroupFindFirst.mockImplementation(async () => ({
      id: "group_provided",
      organizationId: "org_1",
      name: "VIP",
    }))

    const app = createTestApp()

    const response = await app.handle(
      postContact({
        phoneNumber: "+62833333333",
        name: "VIP Contact",
        email: "vip@example.com",
        contactGroupId: "group_provided",
      }),
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      contact: { contactGroupId: string }
    }
    expect(payload.contact.contactGroupId).toBe("group_provided")
    expect(mockGroupCreate).not.toHaveBeenCalled()
  })

  it("rejects a provided group that does not belong to the organization", async () => {
    mockGroupFindFirst.mockImplementation(async () => null)

    const app = createTestApp()

    const response = await app.handle(
      postContact({
        phoneNumber: "+62844444444",
        name: "Bad Group",
        email: "bad@example.com",
        contactGroupId: "group_other_org",
      }),
    )

    expect(response.status).toBe(400)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toBe("BAD_REQUEST")
    expect(mockContactCreate).not.toHaveBeenCalled()
  })
})
