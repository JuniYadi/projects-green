import { describe, expect, it } from "bun:test"

import {
  parseCsvRecipients,
  parseManualRecipients,
  sanitizePhoneNumber,
} from "@/lib/whatsapp-phone-sanitizer"

describe("sanitizePhoneNumber", () => {
  it("normalizes local 08 numbers to the 62 country code", () => {
    expect(sanitizePhoneNumber("081234567890")).toBe("6281234567890")
    expect(sanitizePhoneNumber("089812345678")).toBe("6289812345678")
  })

  it("normalizes bare 8-prefixed numbers to the 62 country code", () => {
    expect(sanitizePhoneNumber("81234567890")).toBe("6281234567890")
  })

  it("keeps already-normalized 62 numbers intact", () => {
    expect(sanitizePhoneNumber("6281234567890")).toBe("6281234567890")
    expect(sanitizePhoneNumber("+6281234567890")).toBe("6281234567890")
  })

  it("strips formatting characters from pasted numbers", () => {
    expect(sanitizePhoneNumber("0898-1234-5678")).toBe("6289812345678")
    expect(sanitizePhoneNumber("0812 3456 7890")).toBe("6281234567890")
    expect(sanitizePhoneNumber("0812.345.678.90")).toBe("6281234567890")
    expect(sanitizePhoneNumber("(+62) 812-3456-7890")).toBe("6281234567890")
    expect(sanitizePhoneNumber("  081234567890\t")).toBe("6281234567890")
  })

  it("accepts E.164-like lengths between 9 and 15 digits", () => {
    expect(sanitizePhoneNumber("628123456")).toBe("628123456")
    expect(sanitizePhoneNumber("628123456789012")).toBe("628123456789012")
  })

  it("rejects strings outside the valid length range", () => {
    expect(sanitizePhoneNumber("62812345")).toBeNull()
    expect(sanitizePhoneNumber("12345")).toBeNull()
    expect(sanitizePhoneNumber("6281234567890123")).toBeNull()
  })

  it("rejects non-digit input", () => {
    expect(sanitizePhoneNumber("")).toBeNull()
    expect(sanitizePhoneNumber("   ")).toBeNull()
    expect(sanitizePhoneNumber("not-a-phone")).toBeNull()
    expect(sanitizePhoneNumber("08123456789a")).toBeNull()
  })
})

describe("parseManualRecipients", () => {
  it("parses newline-separated entries with validity flags", () => {
    const recipients = parseManualRecipients(
      "081234567890\n+628987654321\nnot-a-phone"
    )

    expect(recipients).toEqual([
      {
        raw: "081234567890",
        phoneNumber: "6281234567890",
        isValid: true,
      },
      {
        raw: "+628987654321",
        phoneNumber: "628987654321",
        isValid: true,
      },
      { raw: "not-a-phone", phoneNumber: "", isValid: false },
    ])
  })

  it("splits on both newlines and commas", () => {
    const recipients = parseManualRecipients(
      "081234567890, 0898-1234-5678\ninvalid,,628123456789"
    )

    expect(recipients.map((entry) => entry.phoneNumber)).toEqual([
      "6281234567890",
      "6289812345678",
      "",
      "628123456789",
    ])
    expect(recipients.filter((entry) => entry.isValid)).toHaveLength(3)
    expect(recipients[2]).toEqual({
      raw: "invalid",
      phoneNumber: "",
      isValid: false,
    })
  })

  it("drops blank entries instead of reporting them", () => {
    expect(parseManualRecipients("\n  \n,,")).toEqual([])
  })
})

describe("parseCsvRecipients", () => {
  it("auto-detects phone/name columns and maps named dynamic values", () => {
    const csv = [
      "Nama,Kota,Nomor WhatsApp",
      "Budi,Surabaya,081234567890",
      "Siti,Bandung,+628987654321",
    ].join("\n")

    expect(parseCsvRecipients(csv)).toEqual([
      {
        phoneNumber: "6281234567890",
        name: "Budi",
        dynamicValues: { Kota: "Surabaya" },
        isValid: true,
      },
      {
        phoneNumber: "628987654321",
        name: "Siti",
        dynamicValues: { Kota: "Bandung" },
        isValid: true,
      },
    ])
  })

  it("detects phone columns across common Indonesian headers", () => {
    for (const header of [
      "phone",
      "Phone Number",
      "No HP",
      "Nomor Telepon",
      "Mobile",
      "nomor wa",
    ]) {
      const [recipient] = parseCsvRecipients(`${header},Extra\n081234567890,x`)

      expect(recipient?.isValid).toBe(true)
      expect(recipient?.phoneNumber).toBe("6281234567890")
      expect(recipient?.dynamicValues).toEqual({ Extra: "x" })
    }
  })

  it("maps unnamed extra columns to 1-based index keys", () => {
    const csv = [
      "Phone,City,,Full Name",
      "081234567890,Tangerang,mystery,Alex",
    ].join("\n")

    const [recipient] = parseCsvRecipients(csv)

    expect(recipient?.name).toBe("Alex")
    expect(recipient?.dynamicValues).toEqual({
      City: "Tangerang",
      "3": "mystery",
    })
  })

  it("handles quoted cells with commas and escaped quotes", () => {
    const csv = [
      '"Full Name",Phone,City',
      '"Doe, John",081234567890,"Jakarta Selatan"',
      '"Say ""hi""",0898-1234-5678,Bandung',
    ].join("\n")

    const recipients = parseCsvRecipients(csv)

    expect(recipients[0]?.name).toBe("Doe, John")
    expect(recipients[0]?.dynamicValues.City).toBe("Jakarta Selatan")
    expect(recipients[1]?.name).toBe('Say "hi"')
    expect(recipients[1]?.phoneNumber).toBe("6289812345678")
  })

  it("flags rows with unusable phone values without dropping them", () => {
    const csv = [
      "Name,Phone",
      "Ann,081234567890",
      "Bob,bad-number",
      "Cy,",
    ].join("\n")

    expect(parseCsvRecipients(csv)).toEqual([
      {
        phoneNumber: "6281234567890",
        name: "Ann",
        dynamicValues: {},
        isValid: true,
      },
      {
        phoneNumber: "",
        name: "Bob",
        dynamicValues: {},
        isValid: false,
      },
      {
        phoneNumber: "",
        name: "Cy",
        dynamicValues: {},
        isValid: false,
      },
    ])
  })

  it("returns invalid rows when no phone column is detected", () => {
    const csv = ["Nama,Kota", "Budi,Surabaya"].join("\n")

    expect(parseCsvRecipients(csv)).toEqual([
      {
        phoneNumber: "",
        name: "Budi",
        dynamicValues: { Kota: "Surabaya" },
        isValid: false,
      },
    ])
  })

  it("returns an empty list for empty or header-only content", () => {
    expect(parseCsvRecipients("")).toEqual([])
    expect(parseCsvRecipients("Name,Phone\n")).toEqual([])
  })
})
