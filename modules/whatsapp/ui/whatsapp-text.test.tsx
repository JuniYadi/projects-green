import "@/test/register"
import { afterEach, expect, mock, test } from "bun:test"
import { render } from "@testing-library/react"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
}))

import {
  formatWhatsAppText,
  getWhatsAppText,
  WhatsAppText,
} from "./whatsapp-text"

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

test("uses the supplied route locale instead of a stale document locale", () => {
  document.documentElement.lang = "en"

  const indonesian = render(<WhatsAppText id="s309" locale="id" />)
  const english = render(<WhatsAppText id="s309" locale="en" />)

  expect(indonesian.getByText("Broadcast Baru")).toBeTruthy()
  expect(english.getByText("New Broadcast")).toBeTruthy()
})

test("formats a complete localized pagination sentence", () => {
  expect(
    formatWhatsAppText("s296", { page: 2, totalPages: 7, total: 63 }, "id")
  ).toBe("Halaman 2 dari 7 (63 entri)")
  expect(
    formatWhatsAppText("s296", { page: 2, totalPages: 7, total: 63 }, "en")
  ).toBe("Page 2 of 7 (63 entries)")
})
