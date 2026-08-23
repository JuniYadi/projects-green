/**
 * Normalizes Indonesian-flavored WhatsApp recipient numbers and parses
 * pasted/uploaded recipient lists into structured rows.
 */

import { e164PhoneRegex } from "@/modules/whatsapp/messages/phone-number"

export function sanitizePhoneNumber(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Disallow letters or non-phone noise characters (e.g. 0812a)
  if (/[^\d\s\-().+]/.test(trimmed)) return null

  // Strip noise
  let digits = trimmed.replace(/[\s\-().]/g, "")
  if (digits.startsWith("+")) {
    digits = digits.slice(1)
  }
  if (digits.startsWith("08")) {
    digits = `62${digits.slice(1)}`
  } else if (digits.startsWith("8")) {
    digits = `62${digits}`
  }

  // E.164 standard: max 15 digits including country code, min 9 digits (e.g. 628123456)
  if (digits.length < 9 || digits.length > 15) {
    return null
  }

  const candidate = `+${digits}`
  return e164PhoneRegex.test(candidate) ? digits : null
}

export type ManualRecipient = {
  phoneNumber: string
  raw: string
  isValid: boolean
}

export function parseManualRecipients(text: string): ManualRecipient[] {
  return text
    .split(/[\n\r,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((raw) => {
      const phoneNumber = sanitizePhoneNumber(raw)
      return {
        raw,
        phoneNumber: phoneNumber ?? "",
        isValid: phoneNumber !== null,
      }
    })
}

export type CsvRecipient = {
  phoneNumber: string
  name?: string
  dynamicValues: Record<string, string>
  isValid: boolean
}

const PHONE_COLUMN_PATTERN = /phone|telepon|hp|nomor|wa|mobile/i
const NAME_COLUMN_PATTERN = /name|nama/i

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"' && current === "") {
      inQuotes = true
    } else if (char === ",") {
      cells.push(current)
      current = ""
    } else {
      current += char
    }
  }

  cells.push(current)
  return cells
}

export function parseCsvRecipients(csvContent: string): CsvRecipient[] {
  const lines = csvContent
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    return []
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim())
  const phoneIndex = headers.findIndex((header) =>
    PHONE_COLUMN_PATTERN.test(header)
  )
  const nameIndex = headers.findIndex(
    (header, index) => index !== phoneIndex && NAME_COLUMN_PATTERN.test(header)
  )

  const dynamicColumns = headers
    .map((header, index) => ({ header, index }))
    .filter(({ index }) => index !== phoneIndex && index !== nameIndex)

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)

    const dynamicValues: Record<string, string> = {}
    for (const { header, index } of dynamicColumns) {
      // Unnamed columns fall back to their 1-based position so they map onto
      // WhatsApp template placeholders such as {{1}} and {{2}}.
      dynamicValues[header || String(index + 1)] = (cells[index] ?? "").trim()
    }

    const rawPhone = phoneIndex >= 0 ? (cells[phoneIndex] ?? "").trim() : ""
    const phoneNumber = sanitizePhoneNumber(rawPhone)
    const name = nameIndex >= 0 ? (cells[nameIndex] ?? "").trim() : ""

    const recipient: CsvRecipient = {
      phoneNumber: phoneNumber ?? "",
      dynamicValues,
      isValid: phoneNumber !== null,
    }
    if (name) {
      recipient.name = name
    }
    return recipient
  })
}
