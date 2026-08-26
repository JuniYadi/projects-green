import { z } from "zod"

export const CATALOG_SCHEMA_VERSION = "2026-08.1"

export const catalogMigrationOfferSchema = z.object({
  billingPeriod: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]),
  chargeUnit: z.enum(["SUBSCRIPTION", "DEVICE"]).default("SUBSCRIPTION"),
  periodPrice: z.number().nonnegative(),
  currency: z.string().min(1).default("IDR"),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
})

export type CatalogMigrationOffer = z.infer<typeof catalogMigrationOfferSchema>

export const catalogMigrationAddonPriceSchema = z.object({
  billingPeriod: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]),
  amount: z.number().nonnegative(),
  currency: z.string().min(1).default("IDR"),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
})

export const catalogMigrationPlanAttachmentSchema = z.object({
  planCode: z.string().min(1),
  label: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  isRequired: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
  enabledTerms: z.array(z.string()).nullable().optional(),
  isActive: z.boolean().default(true),
})

export const catalogMigrationAddonSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  billingMode: z.enum(["RECURRING", "ONE_TIME", "USAGE"]).default("RECURRING"),
  isActive: z.boolean().default(true),
  prices: z.array(catalogMigrationAddonPriceSchema).default([]),
  planAttachments: z
    .array(catalogMigrationPlanAttachmentSchema)
    .optional()
    .default([]),
})

export type CatalogMigrationAddon = z.infer<typeof catalogMigrationAddonSchema>

export const catalogMigrationProductSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  resources: z.record(z.unknown()).default({}),
  billingStrategy: z.enum(["PRO_RATA", "FIXED_CYCLE"]).default("FIXED_CYCLE"),
  stockControl: z.enum(["UNLIMITED", "TRACKED"]).default("UNLIMITED"),
  stockCount: z.number().int().nullable().optional(),
  allowBackorder: z.boolean().default(false),
  isActive: z.boolean().default(true),
  offers: z.array(catalogMigrationOfferSchema).default([]),
})

export type CatalogMigrationProduct = z.infer<
  typeof catalogMigrationProductSchema
>

export const catalogExportPayloadSchema = z.object({
  schemaVersion: z.string().default(CATALOG_SCHEMA_VERSION),
  catalogCode: z.string().min(1),
  catalogName: z.string().min(1),
  description: z.string().nullable().optional(),
  exportedAt: z.string(),
  sourceEnv: z.string().default("development"),
  products: z.array(catalogMigrationProductSchema).default([]),
  addons: z.array(catalogMigrationAddonSchema).optional().default([]),
})

export type CatalogExportPayload = z.infer<typeof catalogExportPayloadSchema>

export const catalogImportOptionsSchema = z.object({
  dryRun: z.boolean().default(false),
  overrideCatalogCode: z.string().optional(),
})

export type CatalogImportOptions = z.infer<typeof catalogImportOptionsSchema>

export interface CatalogImportDiffItem {
  code: string
  name: string
  action: "create" | "update" | "unchanged"
  details: string[]
}

export interface CatalogImportResult {
  ok: boolean
  catalogCode: string
  dryRun: boolean
  summary: {
    productsToCreate: number
    productsToUpdate: number
    productsUnchanged: number
    addonsToCreate: number
    addonsToUpdate: number
    addonsUnchanged: number
    totalProcessed: number
  }
  diffs: {
    products: CatalogImportDiffItem[]
    addons: CatalogImportDiffItem[]
  }
  warnings: string[]
  appliedAt?: string
}
