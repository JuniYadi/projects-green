import { z } from "zod"

export const inventoryStatusSchema = z.enum([
  "ACTIVE",
  "REVOKED",
  "NOT_GENERATED",
])

export const inventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(),
  status: inventoryStatusSchema.optional(),
})

export type InventoryQuery = z.infer<typeof inventoryQuerySchema>
