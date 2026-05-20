import { describe, expect, it } from "bun:test"

import { getMessages, getMessagesForMaybeLocale } from "@/lib/i18n/messages"

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
})
