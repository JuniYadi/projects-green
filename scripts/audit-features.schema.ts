import { z } from "zod"

export const ModuleCategorySchema = z.enum([
  "admin",
  "auth",
  "billing",
  "credentials",
  "deploy",
  "docs",
  "email-templates",
  "framework-detection",
  "github",
  "gitops",
  "health",
  "infra",
  "invoices",
  "jenkins",
  "opensearch",
  "other",
  "payment",
  "support-tickets",
  "tenant",
  "users",
  "vouchers",
  "vpn",
  "whatsapp",
  "wireguard",
  "workos-directory",
])

export const FeatureStatusSchema = z.enum(["implemented", "partial", "missing"])

export const FeatureEntrySchema = z.object({
  id: z.string(),
  label: z.string(),
  codeStatus: FeatureStatusSchema,
  evidence: z.array(z.string()),
  lastVerified: z.string(),
  userReady: z.boolean().optional(),
})

export const AuditReportSchema = z.object({
  generatedAt: z.string(),
  module: z.string(),
  category: ModuleCategorySchema.optional(),
  features: z.array(FeatureEntrySchema),
  summary: z.object({
    total: z.number().int(),
    implemented: z.number().int(),
    partial: z.number().int(),
    missing: z.number().int(),
  }),
})

export type ModuleCategory = z.infer<typeof ModuleCategorySchema>
export type FeatureStatus = z.infer<typeof FeatureStatusSchema>
export type FeatureEntry = z.infer<typeof FeatureEntrySchema>
export type AuditReport = z.infer<typeof AuditReportSchema>
