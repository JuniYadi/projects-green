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

export const bootstrapCreatePayloadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters.")
    .max(80, "Organization name must be at most 80 characters."),
})
