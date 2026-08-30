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
  ).toBe("Halaman 2 dari 7 (63 data)")
  expect(
    formatWhatsAppText("s296", { page: 2, totalPages: 7, total: 63 }, "en")
  ).toBe("Page 2 of 7 (63 entries)")
})

test("formats localized WhatsApp console copy without composing literals", () => {
  expect(formatWhatsAppText("s378", { count: 1 }, "en")).toBe(
    "Preview (1 contact)"
  )
  expect(formatWhatsAppText("s379", { count: 2 }, "en")).toBe(
    "Preview (2 contacts)"
  )
  expect(formatWhatsAppText("s378", { count: 2 }, "id")).toBe(
    "Pratinjau (2 kontak)"
  )
  expect(formatWhatsAppText("s390", { count: 2 }, "id")).toBe("Impor 2 Kontak")
  expect(
    formatWhatsAppText("s381", { first: "{{1}}", second: "{{2}}" }, "id")
  ).toBe(
    "Unduh file template yang sesuai dengan bahasa pilihan. Kolom Nomor WhatsApp dan Nama akan otomatis terdeteksi; variabel pesan menggunakan urutan {{1}}, {{2}}, dst."
  )
  expect(getWhatsAppText("s380", "id")).toBe("Mengirim...")
  expect(getWhatsAppText("s382", "en")).toBe("Recent Deductions")
  expect(getWhatsAppText("s383", "id")).toBe(
    "5 riwayat pemotongan kuota atau saldo terbaru"
  )
})
