import { z } from "zod"

// Matches a single Unicode emoji (incl. regional-indicator flag pairs).
const emojiRegex = /^(\p{Extended_Pictographic}|\p{Regional_Indicator}{2})$/u

export const createVpnRegionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Region name must be at least 2 characters.")
    .max(60, "Region name must be at most 60 characters."),
  flagEmoji: z
    .string()
    .trim()
    .min(1, "Flag emoji is required.")
    .refine((value) => emojiRegex.test(value), {
      message: "Flag must be a single emoji.",
    }),
  isActive: z.boolean().optional().default(true),
})

export const updateVpnRegionSchema = createVpnRegionSchema.partial()

export type CreateVpnRegionInput = z.infer<typeof createVpnRegionSchema>
export type UpdateVpnRegionInput = z.infer<typeof updateVpnRegionSchema>

/**
 * Generate a URL-safe slug from a region name: lowercase, spaces and
 * non-alphanumeric characters collapsed to single hyphens, trimmed.
 */
export function slugifyRegionName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
