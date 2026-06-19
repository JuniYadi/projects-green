import { z } from "zod"

export const adminCreateOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters.")
    .max(80, "Organization name must be at most 80 characters."),
  domains: z
    .array(z.string().trim().min(1, "Domain cannot be empty."))
    .max(10, "Maximum 10 domains allowed.")
    .optional(),
  externalId: z
    .string()
    .trim()
    .max(256, "External ID must be at most 256 characters.")
    .optional(),
})

export const adminSendInvitationSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  organizationId: z.string().trim().min(1, "organizationId is required."),
  roleSlug: z
    .string()
    .trim()
    .min(1, "roleSlug is required.")
    .default("user_member"),
  expiresInDays: z.number().int().positive().optional(),
})

export const listOrganizationsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  before: z.string().optional(),
  after: z.string().optional(),
  search: z.string().optional(),
})

export type ListOrganizationsQuery = z.infer<
  typeof listOrganizationsQuerySchema
>

export type AdminCreateOrganizationInput = z.infer<
  typeof adminCreateOrganizationSchema
>
export type AdminSendInvitationInput = z.infer<typeof adminSendInvitationSchema>
