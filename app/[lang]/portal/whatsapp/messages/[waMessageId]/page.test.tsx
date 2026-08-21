import { describe, expect, it } from "bun:test"

import PortalWhatsAppMessageJourneyPage from "./page"

describe("portal WhatsApp message journey route", () => {
  it("exports a journey page for portal message IDs", () => {
    expect(PortalWhatsAppMessageJourneyPage).toBeFunction()
  })
})
