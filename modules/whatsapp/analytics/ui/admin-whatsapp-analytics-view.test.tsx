import { describe, it, expect } from "bun:test"
import { AdminWhatsappAnalyticsView } from "./admin-whatsapp-analytics-view"

describe("AdminWhatsappAnalyticsView component", () => {
  it("exports AdminWhatsappAnalyticsView function component", () => {
    expect(typeof AdminWhatsappAnalyticsView).toBe("function")
  })
})
