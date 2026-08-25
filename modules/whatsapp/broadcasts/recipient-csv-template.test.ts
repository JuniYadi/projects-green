import { describe, expect, it } from "bun:test"
import { parseCsvRecipients } from "@/lib/whatsapp-phone-sanitizer"
import { buildRecipientCsvTemplate } from "./recipient-csv-template"

describe("buildRecipientCsvTemplate", () => {
  it("uses parser-recognized headers and template body variable order", () => {
    const csv = buildRecipientCsvTemplate(
      "Halo {{2}}, pesanan untuk {{1}} sudah diproses."
    )

    expect(csv.split("\r\n")[0]).toBe("Nomor WhatsApp,Nama,{{1}},{{2}}")
    expect(parseCsvRecipients(csv)).toEqual([
      {
        phoneNumber: "6280000000000",
        name: "Contoh Penerima",
        dynamicValues: {
          "{{1}}": "Contoh nilai 1",
          "{{2}}": "Contoh nilai 2",
        },
        isValid: true,
      },
    ])
  })

  it("still provides a parser-valid template when a body has no variables", () => {
    expect(buildRecipientCsvTemplate("Pesan tanpa variabel.")).toBe(
      "Nomor WhatsApp,Nama\r\n+6280000000000,Contoh Penerima"
    )
  })
})
