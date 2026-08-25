import {
  RECIPIENT_CSV_NAME_HEADER,
  RECIPIENT_CSV_PHONE_HEADER,
} from "@/lib/whatsapp-phone-sanitizer"
import { extractTemplateVariables } from "@/modules/whatsapp/templates/template-validator"

const EXAMPLE_PHONE_NUMBER = "+6280000000000"
const EXAMPLE_RECIPIENT_NAME = "Contoh Penerima"

function escapeCsvValue(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/**
 * Produces a parser-valid upload template for the selected template language.
 */
export function buildRecipientCsvTemplate(body?: string | null): string {
  const variables = extractTemplateVariables(body)
  const headers = [
    RECIPIENT_CSV_PHONE_HEADER,
    RECIPIENT_CSV_NAME_HEADER,
    ...variables.map((variable) => `{{${variable}}}`),
  ]
  const example = [
    EXAMPLE_PHONE_NUMBER,
    EXAMPLE_RECIPIENT_NAME,
    ...variables.map((variable) => `Contoh nilai ${variable}`),
  ]

  return [headers, example]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n")
}
