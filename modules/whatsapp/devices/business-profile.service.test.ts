import "@/test/register"
import { beforeEach, describe, expect, it, mock } from "bun:test"
import {
  getProfile,
  syncTemplatesFromMeta,
  updateProfile,
  uploadProfilePicture,
  DeviceNoPhoneIdError,
  DeviceNoMetaAppIdError,
  ProfileNotFoundError,
} from "./business-profile.service"
import { DeviceNotFoundError, DeviceNotOwnedError } from "./devices.schemas"

const mockFindUnique = mock(async (_args?: unknown): Promise<unknown> => null)
const mockUpdate = mock(async (_args?: unknown): Promise<unknown> => null)
const mockTemplateFindFirst = mock(
  async (_args?: unknown): Promise<unknown> => null
)
const mockTemplateCreate = mock(
  async (_args?: unknown): Promise<unknown> => ({
    id: "template-created",
    languages: [],
  })
)
const mockTemplateLanguageCreate = mock(async (_args?: unknown) => ({}))
const mockTemplateUpdate = mock(
  async (_args?: unknown): Promise<unknown> => null
)
const mockTemplateLanguageUpdate = mock(async (_args?: unknown) => ({}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    whatsappTemplate: {
      findFirst: mockTemplateFindFirst,
      create: mockTemplateCreate,
      update: mockTemplateUpdate,
    },
    whatsappTemplateLanguage: {
      create: mockTemplateLanguageCreate,
      update: mockTemplateLanguageUpdate,
    },
  },
}))

const mockGetBusinessProfile = mock(
  async (): Promise<Record<string, unknown> | null> => null
)
const mockUpdateBusinessProfile = mock(
  async (_data?: unknown): Promise<{ success: boolean }> => ({
    success: true,
  })
)
const mockUploadProfilePicture = mock(
  async (_file?: unknown): Promise<{ handle: string }> => ({ handle: "h-123" })
)

mock.module("@/lib/whatsapp/meta-cloud/device-client", () => {
  class MockClient {
    getBusinessProfile = mockGetBusinessProfile
    updateBusinessProfile = mockUpdateBusinessProfile
    uploadProfilePicture = mockUploadProfilePicture
    static fromDevice = mock(async () => new MockClient())
  }
  return { WhatsAppDeviceClient: MockClient }
})

mock.module("@/lib/whatsapp/crypto", () => ({
  decryptWhatsAppToken: async (t: string) => t,
}))

describe("business-profile.service", () => {
  beforeEach(() => {
    mockFindUnique.mockClear()
    mockUpdate.mockClear()
    mockTemplateFindFirst.mockClear()
    mockTemplateCreate.mockClear()
    mockTemplateLanguageCreate.mockClear()
    mockTemplateUpdate.mockClear()
    mockTemplateLanguageUpdate.mockClear()
    mockGetBusinessProfile.mockClear()
    mockUpdateBusinessProfile.mockClear()
    mockUploadProfilePicture.mockClear()
  })

  it("throws error instances correctly", () => {
    expect(new DeviceNoPhoneIdError().code).toBe("DEVICE_NO_PHONE_ID")
    expect(new DeviceNoMetaAppIdError().code).toBe("DEVICE_NO_META_APP_ID")
    expect(new ProfileNotFoundError("d-1").code).toBe("PROFILE_NOT_FOUND")
  })

  it("getProfile throws DeviceNotFoundError when device does not exist", async () => {
    mockFindUnique.mockImplementationOnce(async () => null)
    await expect(getProfile("d-1", "org-1")).rejects.toThrow(
      DeviceNotFoundError
    )
  })

  it("getProfile throws DeviceNotOwnedError when org does not match", async () => {
    mockFindUnique.mockImplementationOnce(async () => ({
      id: "d-1",
      organizationId: "other-org",
      accessToken: "token",
      whatsappPhoneId: "phone-1",
      whatsappBusinessAccountId: "waba-1",
      whatsappProfile: null,
      whatsappMetaApp: { metaAppId: "app-1" },
    }))
    await expect(getProfile("d-1", "org-1")).rejects.toThrow(
      DeviceNotOwnedError
    )
  })

  it("getProfile throws DeviceNoPhoneIdError when phone id is missing", async () => {
    mockFindUnique.mockImplementationOnce(async () => ({
      id: "d-1",
      organizationId: "org-1",
      accessToken: "token",
      whatsappPhoneId: null,
      whatsappBusinessAccountId: "waba-1",
      whatsappProfile: null,
      whatsappMetaApp: { metaAppId: "app-1" },
    }))
    await expect(getProfile("d-1", "org-1")).rejects.toThrow(
      DeviceNoPhoneIdError
    )
  })

  it("getProfile throws ProfileNotFoundError when meta returns null", async () => {
    mockFindUnique.mockImplementationOnce(async () => ({
      id: "d-1",
      organizationId: "org-1",
      accessToken: "token",
      whatsappPhoneId: "phone-1",
      whatsappBusinessAccountId: "waba-1",
      whatsappProfile: null,
      whatsappMetaApp: { metaAppId: "app-1" },
    }))
    mockGetBusinessProfile.mockImplementationOnce(async () => null)
    await expect(getProfile("d-1", "org-1")).rejects.toThrow(
      ProfileNotFoundError
    )
  })

  it("getProfile updates database and returns profile on success", async () => {
    mockFindUnique.mockImplementationOnce(async () => ({
      id: "d-1",
      organizationId: "org-1",
      accessToken: "token",
      whatsappPhoneId: "phone-1",
      whatsappBusinessAccountId: "waba-1",
      whatsappProfile: { about: "Old about" },
      whatsappMetaApp: { metaAppId: "app-1" },
    }))
    mockGetBusinessProfile.mockImplementationOnce(async () => ({
      about: "New about",
      email: "contact@example.com",
    }))
    mockUpdate.mockImplementationOnce(async (args) => args)

    const res = await getProfile("d-1", "org-1")
    expect(res.about).toBe("New about")
    expect(mockUpdate).toHaveBeenCalled()
  })

  it("updateProfile throws DeviceNoPhoneIdError when phone id missing", async () => {
    mockFindUnique.mockImplementationOnce(async () => ({
      id: "d-1",
      organizationId: "org-1",
      accessToken: "token",
      whatsappPhoneId: null,
      whatsappBusinessAccountId: "waba-1",
      whatsappProfile: null,
      whatsappMetaApp: { metaAppId: "app-1" },
    }))
    await expect(
      updateProfile(
        "d-1",
        { messaging_product: "whatsapp", about: "Hello" },
        "org-1"
      )
    ).rejects.toThrow(DeviceNoPhoneIdError)
  })

  it("updateProfile sends update and persists merged profile", async () => {
    mockFindUnique.mockImplementationOnce(async () => ({
      id: "d-1",
      organizationId: "org-1",
      accessToken: "token",
      whatsappPhoneId: "phone-1",
      whatsappBusinessAccountId: "waba-1",
      whatsappProfile: { email: "prev@example.com" },
      whatsappMetaApp: { metaAppId: "app-1" },
    }))
    mockUpdateBusinessProfile.mockImplementationOnce(async () => ({
      success: true,
    }))
    mockGetBusinessProfile.mockImplementationOnce(async () => ({
      about: "Updated",
      email: "prev@example.com",
    }))
    mockUpdate.mockImplementationOnce(async (args) => args)

    const res = await updateProfile(
      "d-1",
      { messaging_product: "whatsapp", about: "Updated" },
      "org-1"
    )
    expect(res.about).toBe("Updated")
    expect(res.email).toBe("prev@example.com")
  })

  it("uploadProfilePicture throws DeviceNoMetaAppIdError when metaAppId is missing", async () => {
    mockFindUnique.mockImplementationOnce(async () => ({
      id: "d-1",
      organizationId: "org-1",
      accessToken: "token",
      whatsappPhoneId: "phone-1",
      whatsappBusinessAccountId: "waba-1",
      whatsappProfile: null,
      whatsappMetaApp: null,
    }))
    await expect(
      uploadProfilePicture(
        "d-1",
        {
          data: new ArrayBuffer(8),
          mimeType: "image/png",
          fileName: "avatar.png",
        },
        "org-1"
      )
    ).rejects.toThrow(DeviceNoMetaAppIdError)
  })

  it("uploadProfilePicture uploads picture, updates profile, and returns refreshed profile", async () => {
    mockFindUnique
      .mockImplementationOnce(async () => ({
        id: "d-1",
        organizationId: "org-1",
        accessToken: "token",
        whatsappPhoneId: "phone-1",
        whatsappBusinessAccountId: "waba-1",
        whatsappProfile: null,
        whatsappMetaApp: { metaAppId: "app-1" },
      }))
      .mockImplementationOnce(async () => ({
        id: "d-1",
        organizationId: "org-1",
        accessToken: "token",
        whatsappPhoneId: "phone-1",
        whatsappBusinessAccountId: "waba-1",
        whatsappProfile: null,
        whatsappMetaApp: { metaAppId: "app-1" },
      }))

    mockUploadProfilePicture.mockImplementationOnce(async () => ({
      handle: "handle-123",
    }))
    mockUpdateBusinessProfile.mockImplementationOnce(async () => ({
      success: true,
    }))
    mockGetBusinessProfile.mockImplementationOnce(async () => ({
      about: "Refreshed about",
      profile_picture_url: "https://example.com/new.png",
    }))
    mockUpdate.mockImplementation(async (args) => args)

    const res = await uploadProfilePicture(
      "d-1",
      {
        data: new ArrayBuffer(8),
        mimeType: "image/png",
        fileName: "avatar.png",
      },
      "org-1"
    )

    expect(res.profile_picture_url).toBe("https://example.com/new.png")
    expect(mockUploadProfilePicture).toHaveBeenCalled()
    expect(mockUpdateBusinessProfile).toHaveBeenCalledWith({
      messaging_product: "whatsapp",
      profile_picture_handle: "handle-123",
    })
  })
  it("syncTemplatesFromMeta syncs templates across cursor pages", async () => {
    mockFindUnique.mockImplementationOnce(async () => ({
      id: "d-1",
      organizationId: "org-1",
      token: "token",
      tokenEncrypted: null,
      tokenIv: null,
      whatsappPhoneId: "phone-1",
      whatsappBusinessAccountId: "waba-1",
      whatsappVersion: "v22.0",
      whatsappMetaApp: { metaAppId: "app-1" },
    }))

    const requestedUrls: URL[] = []
    const originalFetch = globalThis.fetch
    const mockFetch = mock(async (input: string | URL | Request) => {
      const pageUrl = new URL(input.toString())
      requestedUrls.push(pageUrl)

      if (requestedUrls.length === 1) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "meta-1",
                name: "first_template",
                language: "en_US",
                status: "APPROVED",
                category: "UTILITY",
                components: [{ type: "BODY", text: "First" }],
              },
            ],
            paging: {
              cursors: { after: "cursor-page-2" },
              next: "https://graph.facebook.com/v22.0/next",
            },
          })
        )
      }

      return new Response(
        JSON.stringify({
          data: [
            {
              id: "meta-2",
              name: "second_template",
              language: "id",
              status: "PENDING",
              category: "MARKETING",
              components: [{ type: "BODY", text: "Second" }],
            },
          ],
        })
      )
    })
    const fetchMock = mockFetch as unknown as typeof fetch
    globalThis.fetch = fetchMock

    try {
      const result = await syncTemplatesFromMeta("d-1", "org-1")

      expect(result).toEqual({ syncedCount: 2, totalMetaCount: 2 })
      expect(mockTemplateCreate).toHaveBeenCalledTimes(2)
      expect(mockTemplateCreate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({ slug: "first_template" }),
        })
      )
      expect(mockTemplateCreate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({ slug: "second_template" }),
        })
      )
      expect(requestedUrls).toHaveLength(2)
      expect(requestedUrls[0].searchParams.get("after")).toBeNull()
      expect(requestedUrls[1].searchParams.get("after")).toBe("cursor-page-2")
      expect(requestedUrls[0].searchParams.get("limit")).toBe("100")
      expect(requestedUrls[0].searchParams.get("fields")).toBe(
        "name,language,status,category,components,rejected_reason"
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
