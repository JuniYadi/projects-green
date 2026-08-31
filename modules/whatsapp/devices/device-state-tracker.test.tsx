import { beforeEach, describe, expect, it, mock } from "bun:test"

type DeviceRecord = {
  id: string
  phoneNumber: string
  organizationId: string
  status: string
  whatsappProfile: Record<string, unknown>
}

const mockFindManyDevices = mock(async () => [] as DeviceRecord[])
const mockRedisGet = mock(async (_key: string) => null as string | null)
const mockRedisSet = mock(async () => "OK")
const mockSendEmail = mock(async () => "log-1")
const mockGetPlatformSuperAdminEmails = mock(async () => [
  "superadmin@example.com",
])

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: { findMany: mockFindManyDevices },
  },
}))

mock.module("@/lib/redis", () => ({
  redis: {
    get: mockRedisGet,
    set: mockRedisSet,
  },
}))

mock.module("@/lib/queue/email", () => ({
  sendEmail: mockSendEmail,
}))

mock.module("@/lib/platform-admin-emails", () => ({
  getPlatformSuperAdminEmails: mockGetPlatformSuperAdminEmails,
}))
mock.module("@/lib/workos-directory", () => ({
  getCachedOrganizations: mock(async (ids: string[]) => {
    const map = new Map()
    for (const id of ids) {
      map.set(id, { id, name: `Org Name for ${id}` })
    }
    return map
  }),
  getCachedOrganization: mock(async (id: string) => ({
    id,
    name: `Org Name for ${id}`,
  })),
}))

mock.module("@react-email/components", () => ({
  render: mock(async () => "<html>Mock Email</html>"),
  Body: ({ children }: { children: React.ReactNode }) => children,
  Container: ({ children }: { children: React.ReactNode }) => children,
  Head: () => null,
  Heading: ({ children }: { children: React.ReactNode }) => children,
  Hr: () => null,
  Html: ({ children }: { children: React.ReactNode }) => children,
  Preview: () => null,
  Section: ({ children }: { children: React.ReactNode }) => children,
  Text: ({ children }: { children: React.ReactNode }) => children,
}))

const {
  trackAndNotifyDeviceStateChange,
  sendDailyDeviceDigest,
  deviceStateKey,
} = await import("./device-state-tracker")

describe("device-state-tracker", () => {
  beforeEach(() => {
    mockFindManyDevices.mockClear()
    mockRedisGet.mockClear()
    mockRedisSet.mockClear()
    mockSendEmail.mockClear()
    mockGetPlatformSuperAdminEmails.mockClear()
    mockGetPlatformSuperAdminEmails.mockResolvedValue([
      "superadmin@example.com",
    ])
    mockRedisSet.mockResolvedValue("OK")
  })

  describe("trackAndNotifyDeviceStateChange", () => {
    it("stores initial state in redis without notifying if no previous state exists", async () => {
      mockRedisGet.mockResolvedValueOnce(null)

      const res = await trackAndNotifyDeviceStateChange({
        deviceId: "dev-1",
        phoneNumber: "+6281234567890",
        orgName: "Acme Org",
        currentState: {
          nameStatus: "PENDING_REVIEW",
          verifiedName: "Acme Support",
          qualityRating: "GREEN",
          status: "ACTIVE",
        },
      })

      expect(res.changed).toBe(false)
      expect(res.diffs).toHaveLength(0)
      expect(mockRedisSet).toHaveBeenCalledWith(
        deviceStateKey("dev-1"),
        expect.any(String),
        "EX",
        expect.any(Number)
      )
      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it("detects state change and sends admin email when nameStatus changes to APPROVED", async () => {
      mockRedisGet.mockResolvedValueOnce(
        JSON.stringify({
          nameStatus: "PENDING_REVIEW",
          verifiedName: "Acme Support",
          qualityRating: "GREEN",
          status: "ACTIVE",
        })
      )

      const res = await trackAndNotifyDeviceStateChange({
        deviceId: "dev-1",
        phoneNumber: "+6281234567890",
        orgName: "Acme Org",
        currentState: {
          nameStatus: "APPROVED",
          verifiedName: "Acme Official",
          qualityRating: "GREEN",
          status: "ACTIVE",
        },
      })

      expect(res.changed).toBe(true)
      expect(res.diffs).toHaveLength(2)
      expect(res.diffs[0].field).toBe("Meta Name Status")
      expect(res.diffs[0].oldValue).toBe("PENDING_REVIEW")
      expect(res.diffs[0].newValue).toBe("APPROVED")
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "superadmin@example.com",
          subject: expect.stringContaining("Status Changed"),
        })
      )
    })
  })

  describe("sendDailyDeviceDigest", () => {
    it("aggregates device statuses and sends summary email to super admins", async () => {
      mockFindManyDevices.mockResolvedValueOnce([
        {
          id: "dev-1",
          phoneNumber: "+6281234567890",
          organizationId: "org-1",
          status: "ACTIVE",
          whatsappProfile: {
            name_status: "APPROVED",
            verified_name: "Acme Corp",
            quality_rating: "GREEN",
          },
        },
        {
          id: "dev-2",
          phoneNumber: "+6289876543210",
          organizationId: "org-2",
          status: "ACTIVE",
          whatsappProfile: {
            name_status: "PENDING_REVIEW",
            verified_name: "Beta Store",
            quality_rating: "YELLOW",
          },
        },
      ])

      await sendDailyDeviceDigest()

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "superadmin@example.com",
          subject: expect.stringContaining(
            "2 Devices Summary (1 Approved, 1 Pending)"
          ),
        })
      )
    })
  })
})
