import { z } from "zod"

export const createVpnRegionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Region name must be at least 2 characters.")
    .max(60, "Region name must be at most 60 characters."),
  countryCode: z
    .string()
    .trim()
    .min(2, "Country code is required.")
    .max(8, "Country code must be at most 8 characters.")
    .regex(/^[A-Za-z]{2,8}$/, "Country code must be letters only, e.g. id.")
    .transform((value) => value.toLowerCase()),
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
