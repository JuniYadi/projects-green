import { z } from "zod"

/** Meta v23.0 vertical enum — 21 values */
export const VERTICALS = [
  "OTHER",
  "AUTO",
  "BEAUTY",
  "APPAREL",
  "EDU",
  "ENTERTAIN",
  "EVENT_PLAN",
  "FINANCE",
  "GROCERY",
  "GOVT",
  "HOTEL",
  "HEALTH",
  "NONPROFIT",
  "PROF_SERVICES",
  "RETAIL",
  "TRAVEL",
  "RESTAURANT",
  "ALCOHOL",
  "ONLINE_GAMBLING",
  "PHYSICAL_GAMBLING",
  "OTC_DRUGS",
] as const
export type Vertical = (typeof VERTICALS)[number]

/** Fields that can appear in a Meta business profile. */
export const businessProfileFieldsSchema = z.object({
  about: z.string().max(139).optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  email: z.string().email().optional(),
  profile_picture_url: z.string().url().optional(),
  websites: z.array(z.string().url()).max(2).optional(),
  vertical: z.enum(VERTICALS).optional(),
})
export type BusinessProfileFields = z.infer<typeof businessProfileFieldsSchema>

/** Full profile as returned by Meta (messaging_product is informational). */
export const whatsappBusinessProfileSchema = businessProfileFieldsSchema.extend(
  {
    messaging_product: z.literal("whatsapp").optional(),
    profile_picture_handle: z.string().optional(),
  }
)
export type WhatsAppBusinessProfile = z.infer<
  typeof whatsappBusinessProfileSchema
>

/** Meta GET response shape: { data: [{ business_profile: { ... } }] } */
export const metaGetBusinessProfileResponseSchema = z.object({
  data: z.array(
    z.object({
      business_profile: whatsappBusinessProfileSchema,
    })
  ),
})

/** Body sent to Meta POST /whatsapp_business_profile */
export const updateBusinessProfileSchema = businessProfileFieldsSchema.extend({
  messaging_product: z.literal("whatsapp").default("whatsapp"),
  profile_picture_handle: z.string().optional(),
})
export type UpdateBusinessProfileInput = z.infer<
  typeof updateBusinessProfileSchema
>

/** Meta POST update response */
export const metaUpdateBusinessProfileResponseSchema = z.object({
  success: z.boolean(),
})
