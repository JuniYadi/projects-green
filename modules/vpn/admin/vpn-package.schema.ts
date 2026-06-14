import { z } from "zod"

export const SUPPORTED_CURRENCIES = ["IDR", "USD"] as const

const serverIdsSchema = z
  .array(z.string().trim().min(1, "Server id is required."))
  .min(1, "At least one server is required.")
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Duplicate servers are not allowed in the same package."
  )

export const createVpnPackageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Package name must be at least 2 characters.")
    .max(80, "Package name must be at most 80 characters."),
  description: z
    .string()
    .trim()
    .max(280, "Description must be at most 280 characters.")
    .optional(),
  price: z
    .number({ message: "Price is required." })
    .positive("Price must be greater than 0."),
  currency: z.enum(SUPPORTED_CURRENCIES, {
    message: "Currency must be IDR or USD.",
  }),
  isActive: z.boolean().optional().default(true),
  serverIds: serverIdsSchema,
})

export const updateVpnPackageSchema = createVpnPackageSchema.partial()

export type CreateVpnPackageInput = z.input<typeof createVpnPackageSchema>
export type UpdateVpnPackageInput = z.input<typeof updateVpnPackageSchema>
