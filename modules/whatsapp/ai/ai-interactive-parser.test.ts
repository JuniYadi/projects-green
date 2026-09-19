import { describe, expect, it } from "bun:test"
import {
  buildInteractivePayload,
  parseInteractiveButtons,
  truncateButtonTitle,
  MAX_BUTTONS,
  MAX_BUTTON_TITLE_LENGTH,
} from "./ai-interactive-parser"

describe("ai-interactive-parser", () => {
  describe("truncateButtonTitle", () => {
    it("preserves titles within maximum length", () => {
      expect(truncateButtonTitle("Hubungi Kami")).toBe("Hubungi Kami")
    })

    it("clips titles exceeding 20 characters gracefully", () => {
      const longTitle = "Konsultasi Dokter Spesialis Paru"
      const clipped = truncateButtonTitle(longTitle, MAX_BUTTON_TITLE_LENGTH)
      expect(clipped.length).toBeLessThanOrEqual(MAX_BUTTON_TITLE_LENGTH)
      expect(clipped).toBe("Konsultasi Dokter Sp")
    })

    it("trims whitespace from input and clipped output", () => {
      expect(truncateButtonTitle("   Beli Sekarang   ")).toBe("Beli Sekarang")
    })
  })

  describe("parseInteractiveButtons", () => {
    it("returns cleanText and empty buttons when text has no tags", () => {
      const input = "Halo kak, ada yang bisa kami bantu?"
      const result = parseInteractiveButtons(input)
      expect(result.cleanText).toBe(input)
      expect(result.buttons).toEqual([])
    })

    it("handles empty or null string gracefully", () => {
      expect(parseInteractiveButtons("")).toEqual({
        cleanText: "",
        buttons: [],
      })
      // @ts-expect-error test invalid parameter type
      expect(parseInteractiveButtons(null)).toEqual({
        cleanText: "",
        buttons: [],
      })
    })

    it("parses single [BUTTON: label] tag and strips from clean text", () => {
      const input =
        "Pilihan paket tersedia.\n[BUTTON: Pilih Paket Basic]"
      const result = parseInteractiveButtons(input)

      expect(result.cleanText).toBe("Pilihan paket tersedia.")
      expect(result.buttons).toHaveLength(1)
      expect(result.buttons[0]).toEqual({
        type: "reply",
        id: "btn_1",
        title: "Pilih Paket Basic",
      })
    })

    it("parses multiple [BUTTON: ...] tags up to 3 buttons", () => {
      const input = `Silakan pilih salah satu menu berikut:
[BUTTON: Konsultasi]
[BUTTON: Cek Status]
[BUTTON: Hubungi CS]`

      const result = parseInteractiveButtons(input)

      expect(result.cleanText).toBe("Silakan pilih salah satu menu berikut:")
      expect(result.buttons).toHaveLength(3)
      expect(result.buttons[0].title).toBe("Konsultasi")
      expect(result.buttons[1].title).toBe("Cek Status")
      expect(result.buttons[2].title).toBe("Hubungi CS")
    })

    it("parses CTA [URL: label | url] buttons with valid URLs", () => {
      const input = `Kunjungi website kami untuk informasi lebih lanjut:
[URL: Lihat Katalog | https://example.com/katalog]`

      const result = parseInteractiveButtons(input)

      expect(result.cleanText).toBe(
        "Kunjungi website kami untuk informasi lebih lanjut:"
      )
      expect(result.buttons).toHaveLength(1)
      expect(result.buttons[0]).toEqual({
        type: "url",
        id: "url_1",
        title: "Lihat Katalog",
        url: "https://example.com/katalog",
      })
    })

    it("truncates button titles to 20 characters automatically", () => {
      const input = `Info produk:
[BUTTON: Informasi Detail Produk Elektronik Pilihan]
[URL: Kunjungi Website Resmi Perusahaan | https://pfnapp.com]`

      const result = parseInteractiveButtons(input)

      expect(result.buttons).toHaveLength(2)
      expect(result.buttons[0].title.length).toBeLessThanOrEqual(20)
      expect(result.buttons[0].title).toBe("Informasi Detail Pro")
      expect(result.buttons[1].title.length).toBeLessThanOrEqual(20)
      expect(result.buttons[1].title).toBe("Kunjungi Website Res")
    })

    it("caps maximum buttons to 3 and ignores extra tags", () => {
      const input = `Silakan tentukan pilihan Anda:
[BUTTON: Opsi 1]
[BUTTON: Opsi 2]
[BUTTON: Opsi 3]
[BUTTON: Opsi 4]
[URL: Opsi Web | https://example.com]`

      const result = parseInteractiveButtons(input)

      expect(result.cleanText).toBe("Silakan tentukan pilihan Anda:")
      expect(result.buttons).toHaveLength(MAX_BUTTONS)
      expect(result.buttons.map((b) => b.title)).toEqual([
        "Opsi 1",
        "Opsi 2",
        "Opsi 3",
      ])
    })

    it("handles mixed BUTTON and URL tags correctly", () => {
      const input = `Halo! Kami siap melayani.
[BUTTON: Chat Dokter]
[URL: Buka Web | https://health.example.com]
[BUTTON: Jadwal Operasional]`

      const result = parseInteractiveButtons(input)

      expect(result.cleanText).toBe("Halo! Kami siap melayani.")
      expect(result.buttons).toHaveLength(3)
      expect(result.buttons[0].type).toBe("reply")
      expect(result.buttons[1].type).toBe("url")
      expect(result.buttons[2].type).toBe("reply")
    })

    it("handles malformed tags safely without throwing errors", () => {
      const input = `Teks pesan normal.
[BUTTON: ]
[BUTTON:]
[URL: ]
[URL: Label Tanpa Tautan]
[URL: Label | ftp://invalid-protocol.com]
[URL: Label | not-a-valid-url]
[BUTTON: Opsi Valid]`

      const result = parseInteractiveButtons(input)

      expect(result.cleanText).toBe("Teks pesan normal.")
      expect(result.buttons).toHaveLength(1)
      expect(result.buttons[0].title).toBe("Opsi Valid")
    })

    it("strips tags embedded in middle of body text", () => {
      const input =
        "Halo kak! [BUTTON: Tombol A] Selamat datang di toko kami."
      const result = parseInteractiveButtons(input)

      expect(result.cleanText).toBe(
        "Halo kak!  Selamat datang di toko kami."
      )
      expect(result.buttons).toHaveLength(1)
      expect(result.buttons[0].title).toBe("Tombol A")
    })

    it("is case-insensitive for tag names", () => {
      const input = `Balasan:
[button: Tombol Kecil]
[url: Tautan Web | https://example.org]`

      const result = parseInteractiveButtons(input)

      expect(result.buttons).toHaveLength(2)
      expect(result.buttons[0].title).toBe("Tombol Kecil")
      expect(result.buttons[1].title).toBe("Tautan Web")
    })
  })

  describe("buildInteractivePayload", () => {
    it("builds valid Meta button payload for reply buttons", () => {
      const buttons = [
        { type: "reply" as const, id: "btn_1", title: "Pesan Sekarang" },
        { type: "reply" as const, id: "btn_2", title: "Cek Status" },
      ]
      const payload = buildInteractivePayload("Pilih layanan:", buttons)

      expect(payload).toEqual({
        type: "button",
        body: {
          text: "Pilih layanan:",
        },
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: "btn_1",
                title: "Pesan Sekarang",
              },
            },
            {
              type: "reply",
              reply: {
                id: "btn_2",
                title: "Cek Status",
              },
            },
          ],
        },
      })
    })

    it("builds valid Meta button payload for CTA URL button", () => {
      const buttons = [
        {
          type: "url" as const,
          id: "url_1",
          title: "Buka Portal",
          url: "https://portal.green.test",
        },
      ]
      const payload = buildInteractivePayload("Silakan klik:", buttons)

      expect(payload).toEqual({
        type: "button",
        body: {
          text: "Silakan klik:",
        },
        action: {
          buttons: [
            {
              type: "cta_url",
              cta_url: {
                id: "url_1",
                display_text: "Buka Portal",
                url: "https://portal.green.test",
              },
            },
          ],
        },
      })
    })

    it("provides fallback body text when cleanText is empty", () => {
      const buttons = [
        { type: "reply" as const, id: "btn_1", title: "Ya" },
      ]
      const payload = buildInteractivePayload("", buttons)

      expect(payload.body.text).toBe("Silakan pilih opsi berikut:")
      expect(payload.action.buttons).toHaveLength(1)
    })

    it("strictly limits buttons in payload to 3", () => {
      const buttons = [
        { type: "reply" as const, id: "btn_1", title: "1" },
        { type: "reply" as const, id: "btn_2", title: "2" },
        { type: "reply" as const, id: "btn_3", title: "3" },
        { type: "reply" as const, id: "btn_4", title: "4" },
      ]
      const payload = buildInteractivePayload("Test:", buttons)
      expect(payload.action.buttons).toHaveLength(3)
    })
  })
})
