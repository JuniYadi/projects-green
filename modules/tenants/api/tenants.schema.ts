import { z } from "zod"

export const tenantRoleSchema = z.enum(["owner", "admin", "member"])

export const invitationPayloadSchema = z.object({
  email: z.email("Please enter a valid email address."),
  targetRole: tenantRoleSchema.default("member"),
})

export const promotePayloadSchema = z.object({
  targetRole: z.enum(["admin", "owner"]).default("admin"),
})

export const transferOwnershipPayloadSchema = z.object({
  newOwnerMembershipId: z
    .string()
    .trim()
    .min(1, "newOwnerMembershipId is required."),
})

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Organization name must be at least 2 characters.")
  .max(80, "Organization name must be at most 80 characters.")

export const billingCurrencySchema = z.enum(["IDR", "USD"]).default("IDR")

export const bootstrapCreatePayloadSchema = z.object({
  name: nameSchema,
  currency: billingCurrencySchema,
})

export const organizationUpdatePayloadSchema = z
  .object({
    name: nameSchema.optional(),
    metadata: z.record(z.string(), z.string()).optional(),
  })
  .refine(
    (payload) => payload.name !== undefined || payload.metadata !== undefined,
    {
      message: "Provide at least one organization field to update.",
      path: ["name"],
    }
  )

export const organizationDeletePayloadSchema = z.object({
  confirmDeletion: z.literal(true),
  confirmOrganizationId: z
    .string()
    .trim()
    .min(1, "Please provide the organization id to confirm deletion."),
  confirmOrganizationName: z
    .string()
    .trim()
    .min(1, "Please enter the organization name to confirm deletion."),
})
