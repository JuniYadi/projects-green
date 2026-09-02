import { z } from "zod"
import type { AgentPTool } from "../../types"

const inputSchema = z.object({
  phoneNumber: z.string().min(3).max(30),
  defaultCountryCode: z
    .string()
    .regex(/^\d{1,3}$/)
    .default("62"),
})
const outputSchema = z.object({
  input: z.string(),
  normalized: z.string(),
  isValid: z.boolean(),
})

export const contactNormalizeTool: AgentPTool<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "whatsapp.contact.normalize",
  description: "Normalize a contact phone number to E.164 format",
  inputSchema,
  outputSchema,
  execute(input) {
    const raw = input.phoneNumber.trim()
    const digits = raw.replace(/[^\d+]/g, "")
    let normalized = digits
    if (digits.startsWith("+")) {
      normalized = `+${digits.slice(1).replace(/\D/g, "")}`
    } else {
      const stripped = digits.replace(/^0+/, "")
      if (stripped.startsWith(input.defaultCountryCode)) {
        normalized = `+${stripped}`
      } else {
        normalized = `+${input.defaultCountryCode}${stripped}`
      }
    }
    const isValid = /^\+[1-9]\d{6,14}$/.test(normalized)
    return { input: raw, normalized, isValid }
  },
}
