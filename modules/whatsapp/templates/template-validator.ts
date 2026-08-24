/**
 * WhatsApp Template Variable & Boundary Validator
 *
 * Implements strict Meta Cloud API template rules:
 * 1. Variable extraction: finds all {{1}}, {{2}}, etc.
 * 2. Sequential placeholder checking: {{1}}, {{2}}, ... without missing numbers.
 * 3. Boundary validation: Meta restricts variables at the exact start or exact end of body text,
 *    and prevents consecutive variables (e.g. {{1}}{{2}}).
 * 4. Slug formatting: lowercase letters, numbers, and underscores only.
 */

export type ContentRuleWarning = {
  ruleId: string
  title: string
  message: string
  suggestedCategory?: "UTILITY" | "AUTHENTICATION" | "MARKETING"
}

export type VariableValidationResult = {
  isValid: boolean
  indexes: number[]
  errors: string[]
  warnings: string[]
  ruleWarnings: ContentRuleWarning[]
}

/**
 * Modular content classification & anti-rejection rules
 */
export interface TemplateContentRule {
  id: string
  name: string
  appliesToCategory?: Array<"UTILITY" | "AUTHENTICATION" | "MARKETING" | string>
  pattern: RegExp
  suggestedCategory?: "UTILITY" | "AUTHENTICATION" | "MARKETING"
  title: {
    id: string
    en: string
  }
  message: {
    id: string
    en: string
  }
}

export const TEMPLATE_CONTENT_RULES: TemplateContentRule[] = [
  // 1. Detect OTP / Verification keywords in non-AUTHENTICATION templates
  {
    id: "RULE_OTP_NON_AUTH",
    name: "OTP / Authentication Content in Non-Auth Category",
    appliesToCategory: ["UTILITY", "MARKETING"],
    pattern:
      /\b(otp|kode verifikasi|kode rahasia|verification code|one-time password|kode keamanan|security code|passcode|token verifikasi|login verification|auth code)\b/i,
    suggestedCategory: "AUTHENTICATION",
    title: {
      id: "Terdeteksi Kode OTP / Verifikasi",
      en: "OTP / Verification Content Detected",
    },
    message: {
      id: "Meta mewajibkan pesan berisi OTP/verifikasi login menggunakan kategori AUTHENTICATION dengan format preset resmi Meta. Penggunaan kategori Utility/Marketing berisiko ditolak (INCORRECT_CATEGORY).",
      en: "Meta mandates all OTP and login verification messages use the AUTHENTICATION category with standardized preset formats. Submitting under Utility/Marketing risks rejection (INCORRECT_CATEGORY).",
    },
  },
  // 2. Detect Promotional & Call-to-Action / Urgency keywords in UTILITY templates
  {
    id: "RULE_PROMO_IN_UTILITY",
    name: "Promotional & Call-to-Action Keywords in Utility Category",
    appliesToCategory: ["UTILITY"],
    pattern:
      /\b(promo|promosi|diskon|discount|cashback|voucher|potongan harga|sale|cuci gudang|spesial offer|special offer|penawaran terbatas|limited offer|limited time|buy 1 get 1|bogo|flash sale|gratis ongkir|free shipping|ayo|yuk|mari|segera|buruan|jangan lewatkan|dapatkan|nikmati|raih|menangkan|belanja sekarang|shop now|pesan sekarang|order now|beli sekarang|buy now|daftar sekarang|register now|sign up now|coba sekarang|try now|klaim sekarang|claim now|klaim kupon|claim coupon|klik tautan|click here|kunjungi kami|visit us|act now|hurry|grab yours|don't miss out)\b/i,
    suggestedCategory: "MARKETING",
    title: {
      id: "Terdeteksi Kata Promosi / Ajakan (Call to Action) di Kategori Utility",
      en: "Promotional or Call-to-Action Keywords Detected in Utility Category",
    },
    message: {
      id: "Template Utility ditujukan murni untuk pemberitahuan faktual/transaksional. Kata-kata ajakan (seperti 'ayo', 'segera', 'dapatkan', 'pesan sekarang') atau diskon/promo akan dideteksi Meta sebagai pesan MARKETING dan berisiko ditolak.",
      en: "Utility templates must be strictly informational. Call-to-action words (such as 'hurry', 'act now', 'order now', 'segera', 'ayo') or promotional offers are classified by Meta as MARKETING and will trigger rejection or re-classification.",
    },
  },
]

/**
 * Extracts sequential placeholder indexes from text (e.g. "{{1}} and {{2}}" -> [1, 2]).
 */
export function extractTemplateVariables(text?: string | null): number[] {
  if (!text) return []
  const matches = text.match(/{{\s*(\d+)\s*}}/g)
  if (!matches) return []
  const indexes = new Set<number>()
  for (const match of matches) {
    const num = parseInt(match.replace(/[{}]/g, "").trim(), 10)
    if (!isNaN(num) && num > 0) indexes.add(num)
  }
  return Array.from(indexes).sort((a, b) => a - b)
}

/**
 * Validates body text against Meta WhatsApp template requirements:
 * - Placeholders must be 1-indexed and sequential (no skipping numbers).
 * - Variable cannot be at the very end of the body text (Meta rejection prevention).
 * - Variable cannot be directly adjacent to another variable without space/text ({{1}}{{2}}).
 */
export function validateTemplateBodyRules(
  body?: string | null,
  category?: string | null,
  locale: "id" | "en" = "en"
): VariableValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const ruleWarnings: ContentRuleWarning[] = []
  const trimmed = (body ?? "").trim()

  if (!trimmed) {
    return {
      isValid: false,
      indexes: [],
      errors: ["Body text is required."],
      warnings: [],
      ruleWarnings: [],
    }
  }
  const indexes = extractTemplateVariables(trimmed)

  // 1. Check sequential indexing
  for (let i = 0; i < indexes.length; i++) {
    const expected = i + 1
    if (indexes[i] !== expected) {
      errors.push(
        `Variables must be sequential starting at {{1}}. Found {{${indexes[i]}}} instead of {{${expected}}}.`
      )
      break
    }
  }

  // 2. Check consecutive variables {{1}}{{2}}
  if (/{{(\d+)}}\s*{{(\d+)}}/.test(trimmed)) {
    errors.push(
      "Consecutive variables (e.g. {{1}}{{2}}) are not allowed by WhatsApp."
    )
  }

  // 3. Check variable at end of body
  if (/{{(\d+)}}\s*[.!?]?$/.test(trimmed)) {
    warnings.push(
      "WhatsApp restricts placing variables at the end of the message. Add closing text or punctuation after the variable to prevent template rejection."
    )
  }

  // 4. Max variables constraint (Meta limit is 25 per template)
  if (indexes.length > 25) {
    errors.push("Template exceeds maximum of 25 variables.")
  }

  // 5. Smart Content Rules (Category mismatch & OTP detection)
  const currentCategory = (category || "UTILITY").toUpperCase()
  for (const rule of TEMPLATE_CONTENT_RULES) {
    if (
      !rule.appliesToCategory ||
      rule.appliesToCategory.includes(currentCategory)
    ) {
      if (rule.pattern.test(trimmed)) {
        const title = rule.title[locale] || rule.title.en
        const message = rule.message[locale] || rule.message.en
        warnings.push(`${title}: ${message}`)
        ruleWarnings.push({
          ruleId: rule.id,
          title,
          message,
          suggestedCategory: rule.suggestedCategory,
        })
      }
    }
  }

  return {
    isValid: errors.length === 0,
    indexes,
    errors,
    warnings,
    ruleWarnings,
  }
}

/**
 * Formats a raw template name into a valid WhatsApp slug.
 * Meta requirement: lowercase alphanumeric characters and underscores only.
 */
export function formatTemplateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 100)
}

export type BuildMetaComponentsInput = {
  category?: string | null
  headerType?: string | null
  headerText?: string | null
  headerUrl?: string | null
  body?: string | null
  footer?: string | null
  buttons?: unknown
  parameters?: unknown
  addSecurityRecommendation?: boolean
  codeExpirationMinutes?: number
}

/**
 * Converts template language input to Meta Cloud API components structure.
 */
export function buildMetaTemplateComponents(
  input: BuildMetaComponentsInput
): Array<Record<string, unknown>> {
  const isAuth = input.category?.toUpperCase() === "AUTHENTICATION"
  const components: Array<Record<string, unknown>> = []

  // Special Meta Cloud API requirements for AUTHENTICATION category:
  // - BODY component with optional `add_security_recommendation` (boolean, default true).
  // - FOOTER component with optional `code_expiration_minutes` (number 1-90).
  // - BUTTONS component with OTP `COPY_CODE` button and custom button text (default "Copy Code" / "Salin Kode").
  if (isAuth) {
    // 1. Auth BODY
    const bodyComp: Record<string, unknown> = {
      type: "BODY",
    }
    if (input.addSecurityRecommendation !== false) {
      bodyComp.add_security_recommendation = true
    }
    components.push(bodyComp)

    // 2. Auth FOOTER (code expiration)
    const expiration =
      typeof input.codeExpirationMinutes === "number" &&
      input.codeExpirationMinutes >= 1 &&
      input.codeExpirationMinutes <= 90
        ? input.codeExpirationMinutes
        : 5

    components.push({
      type: "FOOTER",
      code_expiration_minutes: expiration,
    })

    // 3. Auth BUTTONS (OTP copy_code)
    let otpButtonText = "Copy Code"
    if (Array.isArray(input.buttons) && input.buttons.length > 0) {
      const firstOtp = (input.buttons as Array<Record<string, any>>).find(
        (b) => b.type === "OTP"
      )
      if (firstOtp?.text?.trim()) {
        otpButtonText = firstOtp.text.trim()
      }
    }

    components.push({
      type: "BUTTONS",
      buttons: [
        {
          type: "OTP",
          otp_type: "COPY_CODE",
          text: otpButtonText,
        },
      ],
    })

    return components
  }

  // 1. HEADER
  const headerType = input.headerType?.toUpperCase()
  if (headerType && headerType !== "NONE") {
    if (headerType === "TEXT" && input.headerText?.trim()) {
      const headerVars = extractTemplateVariables(input.headerText)
      const headerComp: Record<string, unknown> = {
        type: "HEADER",
        format: "TEXT",
        text: input.headerText.trim(),
      }
      if (headerVars.length > 0) {
        headerComp.example = {
          header_text: headerVars.map((v) => `Sample ${v}`),
        }
      }
      components.push(headerComp)
    } else if (
      headerType === "IMAGE" ||
      headerType === "VIDEO" ||
      headerType === "DOCUMENT"
    ) {
      const headerComp: Record<string, unknown> = {
        type: "HEADER",
        format: headerType,
      }
      if (input.headerUrl?.trim()) {
        headerComp.example = {
          header_handle: [input.headerUrl.trim()],
        }
      }
      components.push(headerComp)
    }
  }

  // 2. BODY
  if (input.body?.trim()) {
    const bodyVars = extractTemplateVariables(input.body)
    const bodyComp: Record<string, unknown> = {
      type: "BODY",
      text: input.body.trim(),
    }

    if (bodyVars.length > 0) {
      // Extract custom sample values from parameters if available
      const paramList = Array.isArray(input.parameters)
        ? (input.parameters as Array<{ type?: string; text?: string }>)
        : []
      const sampleTexts = bodyVars.map((v, i) => {
        const customParam = paramList.find(
          (p) => p.type === "BODY" && p.text?.trim()
        )
        return paramList[i]?.text?.trim() || `Sample ${v}`
      })
      bodyComp.example = {
        body_text: [sampleTexts],
      }
    }
    components.push(bodyComp)
  }

  // 3. FOOTER
  if (input.footer?.trim()) {
    components.push({
      type: "FOOTER",
      text: input.footer.trim(),
    })
  }

  // 4. BUTTONS
  if (Array.isArray(input.buttons) && input.buttons.length > 0) {
    const metaButtons: Array<Record<string, unknown>> = []
    for (const b of input.buttons as Array<Record<string, any>>) {
      if (b.type === "QUICK_REPLY" && b.text?.trim()) {
        metaButtons.push({
          type: "QUICK_REPLY",
          text: b.text.trim(),
        })
      } else if (b.type === "URL" && b.text?.trim() && b.url?.trim()) {
        const urlVars = extractTemplateVariables(b.url)
        const btnObj: Record<string, unknown> = {
          type: "URL",
          text: b.text.trim(),
          url: b.url.trim(),
        }
        if (urlVars.length > 0) {
          btnObj.example = Array.isArray(b.example)
            ? b.example
            : urlVars.map((v) => `param_${v}`)
        }
        metaButtons.push(btnObj)
      } else if (
        b.type === "PHONE_NUMBER" &&
        b.text?.trim() &&
        b.phoneNumber?.trim()
      ) {
        metaButtons.push({
          type: "PHONE_NUMBER",
          text: b.text.trim(),
          phone_number: b.phoneNumber.trim(),
        })
      } else if (b.type === "OTP") {
        metaButtons.push({
          type: "OTP",
          otp_type: "COPY_CODE",
          text: b.text?.trim() || "Copy Code",
        })
      }
    }

    if (metaButtons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: metaButtons,
      })
    }
  }

  return components
}
