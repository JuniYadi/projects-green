import { describe, expect, it } from "bun:test"
import { DailyDeviceDigestEmail } from "./daily-device-digest"

describe("DailyDeviceDigestEmail", () => {
  it("renders correctly with device list and stats", () => {
    const email = DailyDeviceDigestEmail({
      devices: [
        {
          id: "dev-1",
          phoneNumber: "+6281234567890",
          displayName: "Acme Support",
          orgName: "org-1",
          nameStatus: "APPROVED",
          qualityRating: "GREEN",
          status: "ACTIVE",
        },
      ],
      generatedAt: "Senin, 31 Agustus 2026",
      stats: {
        total: 1,
        approved: 1,
        pending: 0,
        declinedOrExpired: 0,
        active: 1,
      },
    })

    expect(email).toBeDefined()
  })
})
