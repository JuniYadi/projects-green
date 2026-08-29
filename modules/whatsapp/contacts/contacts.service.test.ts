import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockFindDefaultGroup = mock((_args?: unknown) => Promise.resolve(null))
const mockCreateGroup = mock((_args?: unknown) =>
  Promise.resolve({ id: "created-group-id" })
)
const mockFindRequestedGroup = mock((_args?: unknown) => Promise.resolve(null))
const mockUpsertContact = mock((_args?: unknown) =>
  Promise.resolve({ id: "contact-id" })
)

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappContactGroup: {
      findFirst: (args: {
        where: { id?: string; name?: string; organizationId: string }
      }) => {
        if (args.where.id) {
          return mockFindRequestedGroup(args)
        }
        return mockFindDefaultGroup(args)
      },
      create: mockCreateGroup,
    },
    whatsappContact: {
      upsert: mockUpsertContact,
    },
  },
}))

import {
  DEFAULT_CONTACT_GROUP_NAME,
  resolveWhatsappContactGroupId,
  upsertWhatsappContactFromMessage,
} from "./contacts.service"

describe("resolveWhatsappContactGroupId", () => {
  beforeEach(() => {
    mockFindDefaultGroup.mockClear()
    mockCreateGroup.mockClear()
    mockFindRequestedGroup.mockClear()
    mockUpsertContact.mockClear()
  })

  it("returns requested group id when it exists for organization", async () => {
    mockFindRequestedGroup.mockResolvedValueOnce({
      id: "grp-custom",
      organizationId: "org-1",
      name: "VIPs",
    } as never)

    const result = await resolveWhatsappContactGroupId("org-1", "grp-custom")

    expect(result).toEqual({ ok: true, id: "grp-custom" })
  })

  it("returns error when requested group id does not exist", async () => {
    mockFindRequestedGroup.mockResolvedValueOnce(null)

    const result = await resolveWhatsappContactGroupId(
      "org-1",
      "grp-nonexistent"
    )

    expect(result).toEqual({
      ok: false,
      message: "Contact group not found or access denied.",
    })
  })

  it("returns existing default group when requested group is not provided", async () => {
    mockFindDefaultGroup.mockResolvedValueOnce({
      id: "grp-default",
      organizationId: "org-1",
      name: DEFAULT_CONTACT_GROUP_NAME,
    } as never)

    const result = await resolveWhatsappContactGroupId("org-1")

    expect(result).toEqual({ ok: true, id: "grp-default" })
  })

  it("lazily creates default group when none exists for organization", async () => {
    mockFindDefaultGroup.mockResolvedValueOnce(null)
    mockCreateGroup.mockResolvedValueOnce({
      id: "grp-lazy-created",
      organizationId: "org-1",
      name: DEFAULT_CONTACT_GROUP_NAME,
      description: "Default audience for ungrouped contacts.",
    } as never)

    const result = await resolveWhatsappContactGroupId("org-1")

    expect(mockCreateGroup).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        name: DEFAULT_CONTACT_GROUP_NAME,
        description: "Default audience for ungrouped contacts.",
      },
    })
    expect(result).toEqual({ ok: true, id: "grp-lazy-created" })
  })
})

describe("upsertWhatsappContactFromMessage", () => {
  beforeEach(() => {
    mockFindDefaultGroup.mockClear()
    mockCreateGroup.mockClear()
    mockFindRequestedGroup.mockClear()
    mockUpsertContact.mockClear()
  })

  it("upserts contact with standard fields and fallback group", async () => {
    mockFindDefaultGroup.mockResolvedValueOnce({
      id: "grp-default-1",
      organizationId: "org-1",
      name: DEFAULT_CONTACT_GROUP_NAME,
    } as never)

    const fixedDate = new Date("2026-08-28T12:00:00Z")

    await upsertWhatsappContactFromMessage({
      organizationId: "org-1",
      phoneNumber: "628123456789",
      messageAt: fixedDate,
    })

    expect(mockUpsertContact).toHaveBeenCalledWith({
      where: {
        organizationId_phoneNumber: {
          organizationId: "org-1",
          phoneNumber: "628123456789",
        },
      },
      create: {
        organizationId: "org-1",
        phoneNumber: "628123456789",
        name: "628123456789",
        email: "",
        status: "ACTIVE",
        contactGroupId: "grp-default-1",
        lastContactedAt: fixedDate,
        whatsappDeviceId: undefined,
        isWhatsapp: false,
        waId: null,
        lastCheckedAt: null,
      },
      update: {
        lastContactedAt: fixedDate,
        status: "ACTIVE",
      },
    })
  })

  it("updates whatsappDeviceId, isWhatsapp, waId, and markChecked fields", async () => {
    mockFindDefaultGroup.mockResolvedValueOnce({
      id: "grp-default-1",
      organizationId: "org-1",
      name: DEFAULT_CONTACT_GROUP_NAME,
    } as never)

    const fixedDate = new Date("2026-08-28T14:00:00Z")

    await upsertWhatsappContactFromMessage({
      organizationId: "org-1",
      phoneNumber: "628987654321",
      whatsappDeviceId: "dev-123",
      messageAt: fixedDate,
      isWhatsapp: true,
      waId: "wa-id-456",
      markChecked: true,
    })

    expect(mockUpsertContact).toHaveBeenCalledWith({
      where: {
        organizationId_phoneNumber: {
          organizationId: "org-1",
          phoneNumber: "628987654321",
        },
      },
      create: {
        organizationId: "org-1",
        phoneNumber: "628987654321",
        name: "628987654321",
        email: "",
        status: "ACTIVE",
        contactGroupId: "grp-default-1",
        lastContactedAt: fixedDate,
        whatsappDeviceId: "dev-123",
        isWhatsapp: true,
        waId: "wa-id-456",
        lastCheckedAt: fixedDate,
      },
      update: {
        lastContactedAt: fixedDate,
        status: "ACTIVE",
        whatsappDeviceId: "dev-123",
        isWhatsapp: true,
        waId: "wa-id-456",
        lastCheckedAt: fixedDate,
      },
    })
  })

  it("does not include isWhatsapp in updateData when isWhatsapp is false", async () => {
    mockFindDefaultGroup.mockResolvedValueOnce({
      id: "grp-default-1",
    } as never)

    await upsertWhatsappContactFromMessage({
      organizationId: "org-1",
      phoneNumber: "628999",
      isWhatsapp: false,
    })

    const updateCall = mockUpsertContact.mock.calls[0]?.[0] as {
      create: { isWhatsapp?: boolean }
      update: { isWhatsapp?: boolean }
    }
    expect(updateCall.update.isWhatsapp).toBeUndefined()
    expect(updateCall.create.isWhatsapp).toBe(false)
  })

  it("upserts contact with sender profile name when provided", async () => {
    mockFindDefaultGroup.mockResolvedValueOnce({
      id: "grp-default-1",
      organizationId: "org-1",
      name: DEFAULT_CONTACT_GROUP_NAME,
    } as never)

    const fixedDate = new Date("2026-08-28T16:00:00Z")

    await upsertWhatsappContactFromMessage({
      organizationId: "org-1",
      phoneNumber: "628111222333",
      name: "John Doe",
      messageAt: fixedDate,
      isWhatsapp: true,
      waId: "628111222333",
    })

    expect(mockUpsertContact).toHaveBeenCalledWith({
      where: {
        organizationId_phoneNumber: {
          organizationId: "org-1",
          phoneNumber: "628111222333",
        },
      },
      create: {
        organizationId: "org-1",
        phoneNumber: "628111222333",
        name: "John Doe",
        email: "",
        status: "ACTIVE",
        contactGroupId: "grp-default-1",
        lastContactedAt: fixedDate,
        whatsappDeviceId: undefined,
        isWhatsapp: true,
        waId: "628111222333",
        lastCheckedAt: null,
      },
      update: {
        lastContactedAt: fixedDate,
        status: "ACTIVE",
        name: "John Doe",
        isWhatsapp: true,
        waId: "628111222333",
      },
    })
  })
})
