import { afterEach, expect, test } from "bun:test"
import { getWhatsAppText } from "./whatsapp-text"

const originalLanguage = document.documentElement.lang

afterEach(() => {
  document.documentElement.lang = originalLanguage
})

test("selects Indonesian static WhatsApp UI copy for Indonesian documents", () => {
  document.documentElement.lang = "id"

  expect(getWhatsAppText("s0")).toBe("Impor CSV")
})

test("preserves English static WhatsApp UI copy for English documents", () => {
  document.documentElement.lang = "en"

  expect(getWhatsAppText("s0")).toBe("Import CSV")
})
