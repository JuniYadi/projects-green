import { describe, expect, it } from "bun:test"
import { DeviceStateChangeEmail } from "./device-state-change"

describe("DeviceStateChangeEmail", () => {
  it("renders correctly with diffs", () => {
    const email = DeviceStateChangeEmail({
      deviceName: "Acme Support",
      phoneNumber: "+6281234567890",
      orgName: "Acme Corporation",
      changes: [
        {
          field: "Meta Name Status",
          oldValue: "PENDING_REVIEW",
          newValue: "APPROVED",
        },
      ],
      changedAt: "Senin, 31 Agustus 2026",
    })

    expect(email).toBeDefined()
  })
})
