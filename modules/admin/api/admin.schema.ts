export { INTEGRATION_TYPES } from "@/modules/deploy/cluster-integration.schema"
export {
  integrationMetaJsonSchemas,
  integrationSecretSchemas,
  integrationSecretPatchSchemas,
} from "@/modules/deploy/cluster-integration.schema"

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
// ── App Hosting Cluster Management ───────────────────

const clusterStatusEnum = z.enum(["PLANNED", "ACTIVE", "DEPRECATED"])

export const listClustersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const createClusterBodySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required.")
    .max(64, "Code must be at most 64 characters."),
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(128, "Name must be at most 128 characters."),
  region: z
    .string()
    .trim()
    .min(1, "Region is required.")
    .max(64, "Region must be at most 64 characters."),
  metadataJson: z.record(z.string(), z.unknown()).optional(),
  status: clusterStatusEnum.optional(),
  isDefault: z.boolean().optional(),
})

export const updateClusterBodySchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  region: z.string().trim().min(1).max(64).optional(),
  metadataJson: z.record(z.string(), z.unknown()).optional(),
})

export const updateClusterStatusBodySchema = z.object({
  status: clusterStatusEnum,
  isDefault: z.boolean().optional(),
})

// ── App Hosting integration transport ─────────────────

// The route type is carried in the URL. Keep body transport JSON-compatible;
// the service validates it against the URL-selected integration schema.
export const upsertIntegrationBodySchema = z.strictObject({
  metaJson: z.record(z.string(), z.unknown()).optional(),
  secrets: z.record(z.string(), z.unknown()).optional(),
})

export const updateIntegrationBodySchema = z.strictObject({
  metaJson: z.record(z.string(), z.unknown()).optional(),
  secrets: z.record(z.string(), z.unknown()).optional(),
})

export type UpsertIntegrationBody = z.infer<typeof upsertIntegrationBodySchema>
export type UpdateIntegrationBody = z.infer<typeof updateIntegrationBodySchema>

export const updateIntegrationStatusBodySchema = z.object({
  isActive: z.boolean(),
})

export type ListClustersQuery = z.infer<typeof listClustersQuerySchema>
export type CreateClusterBody = z.infer<typeof createClusterBodySchema>
export type UpdateClusterBody = z.infer<typeof updateClusterBodySchema>
export type UpdateClusterStatusBody = z.infer<
  typeof updateClusterStatusBodySchema
>
export type UpdateIntegrationStatusBody = z.infer<
  typeof updateIntegrationStatusBodySchema
>

const endpointHostnameSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .regex(
    /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/,
    "Enter a valid hostname."
  )
  .transform((value) => value.replace(/\.$/, "").toLowerCase())

const endpointIpSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      z.ipv4().safeParse(value).success || z.ipv6().safeParse(value).success,
    "Enter a valid IPv4 or IPv6 address."
  )

export const upsertClusterEndpointBodySchema = z.object({
  managedBaseDomain: endpointHostnameSchema,
  cnameTarget: endpointHostnameSchema,
  ipv4Addresses: z.array(endpointIpSchema).default([]),
  ipv6Addresses: z.array(endpointIpSchema).default([]),
  isActive: z.boolean().default(true),
})

export type UpsertClusterEndpointBody = z.infer<
  typeof upsertClusterEndpointBodySchema
>
