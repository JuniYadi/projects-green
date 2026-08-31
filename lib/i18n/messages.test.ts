import { describe, expect, it } from "bun:test"

import { getMessages, getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { enMessages } from "@/lib/i18n/messages/en"
import { idMessages } from "@/lib/i18n/messages/id"

describe("i18n messages", () => {
  it("returns locale messages for explicit locale", () => {
    const idMessages = getMessages("id")

    expect(idMessages.navUser.languages.id).toBe("Indonesia")
  })

  it("falls back to default locale when locale is missing or unknown", () => {
    const fromNull = getMessagesForMaybeLocale(null)
    const fromUnknown = getMessagesForMaybeLocale("fr")

    expect(fromNull.navUser.languages.en).toBe("English")
    expect(fromUnknown.navOrganization.label).toBe("Organization menu")
  })

  it("keeps dashboard and balance-gate locale keys in parity", () => {
    expect(Object.keys(idMessages.console.overview).sort()).toEqual(
      Object.keys(enMessages.console.overview).sort()
    )
    expect(Object.keys(idMessages.console.billing.balanceGate).sort()).toEqual(
      Object.keys(enMessages.console.billing.balanceGate).sort()
    )
    expect(Object.keys(idMessages.indonesianLocale).sort()).toEqual(
      Object.keys(enMessages.indonesianLocale).sort()
    )
  })
  it("contains matching WhatsApp workflow dictionary structure", () => {
    expect(enMessages.console.whatsappWorkflows).toBeDefined()
    expect(idMessages.console.whatsappWorkflows).toBeDefined()
    expect(enMessages.console.whatsappWorkflows.title).toBe(
      "AI & Bot Workflows"
    )
    expect(idMessages.console.whatsappWorkflows.title).toBe(
      "Alur Bot & AI WhatsApp"
    )
    expect(enMessages.console.whatsappWorkflows.simulator.title).toBe(
      "WhatsApp Bot Simulator"
    )
    expect(idMessages.console.whatsappWorkflows.simulator.title).toBe(
      "Simulator Bot WhatsApp"
    )
    expect(
      enMessages.console.whatsappWorkflows.templates.customerSupportTitle
    ).toBe("Customer Support Bot")
    expect(Object.keys(idMessages.console.whatsappWorkflows).sort()).toEqual(
      Object.keys(enMessages.console.whatsappWorkflows).sort()
    )
  })
})
