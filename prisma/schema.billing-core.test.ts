import { describe, expect, it } from "bun:test"

describe("billing core prisma models", () => {
  it("defines billing account, catalog, usage, invoicing, and ops models", async () => {
    const schema = await Bun.file("prisma/schema.prisma").text()

    expect(schema).toContain("model BillingAccount {")
    expect(schema).toContain("model BillingSubscription {")
    expect(schema).toContain("model ServiceSubscriptionVersion {")
    expect(schema).toContain("model BillingPlan {")
    expect(schema).toContain("model BillingPlanTier {")
    expect(schema).toContain("model BillingMeter {")
    expect(schema).toContain("model BillingMeterPrice {")

    expect(schema).toContain("model BillingUsageEvent {")
    expect(schema).toContain("@@unique([billingAccountId, idempotencyKey])")
    expect(schema).toContain("model BillingRatedUsage {")

    expect(schema).toContain("model BillingInvoice {")
    expect(schema).toContain(
      "@@unique([billingAccountId, periodStart, periodEnd])"
    )
    expect(schema).toContain("model BillingInvoiceLine {")
    expect(schema).toContain("model BillingInvoiceLineSource {")
    expect(schema).toContain("model BillingAdjustment {")

    expect(schema).toContain("model BillingRun {")
    expect(schema).toContain("model BillingAuditLog {")
  })
})

describe("subscription lifecycle migration", () => {
  it("contains only the lifecycle enum and cancellation column changes", async () => {
    const migration = await Bun.file(
      "prisma/migrations/20260806120000_subscription_lifecycle/migration.sql"
    ).text()

    expect(migration).toContain(
      "ALTER TYPE \"BillingAuditAction\" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_REINSTATED'"
    )
    expect(migration).toContain(
      'ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false'
    )
    expect(migration.match(/ADD COLUMN/g)).toHaveLength(1)
  })
})

describe("unified billing catalog schema", () => {
  it("defines recurring pricing snapshots and order bridges", async () => {
    const schema = await Bun.file("prisma/schema.prisma").text()

    expect(schema).toContain("QUARTERLY")
    expect(schema).toContain("SEMI_ANNUAL")
    expect(schema).toContain("ANNUAL")
    expect(schema).toContain("enum BillingChargeUnit {")
    expect(schema).toMatch(
      /model ServicePricing \{[\s\S]*billingPeriod\s+BillingPeriod\?/
    )
    expect(schema).toMatch(
      /model ServicePricing \{[\s\S]*currency\s+String\s+@default\("IDR"\)/
    )
    expect(schema).toMatch(
      /model ServicePricing \{[\s\S]*periodPrice\s+Decimal\?\s+@db\.Decimal\(18, 2\)/
    )
    expect(schema).toMatch(
      /model ServicePricing \{[\s\S]*effectiveFrom\s+DateTime\s+@default\(now\(\)\)/
    )
    expect(schema).toMatch(
      /model ServicePricing \{[\s\S]*effectiveTo\s+DateTime\?/
    )
    expect(schema).toMatch(
      /model ServicePricing \{[\s\S]*chargeUnit\s+BillingChargeUnit\s+@default\(SUBSCRIPTION\)/
    )
    expect(schema).toContain(
      "@@unique([planId, regionId, type, billingMode, billingPeriod, currency, effectiveFrom])"
    )

    expect(schema).toContain("enum BillingOrderStatus {")
    expect(schema).toContain("model BillingOrder {")
    expect(schema).toContain("model BillingOrderLine {")
    expect(schema).toMatch(
      /model BillingOrder \{[\s\S]*idempotencyKey\s+String\s+@unique/
    )
    expect(schema).toMatch(
      /model VpnSubscription \{[\s\S]*serviceSubscriptionId\s+String\?\s+@unique/
    )
    expect(schema).toMatch(
      /model VpnPackage \{[\s\S]*servicePlanId\s+String\s+@unique[\s\S]*servicePlan\s+ServicePlan/
    )
    expect(schema).toMatch(
      /model BillingOrderLine \{[\s\S]*packageCode\s+ServiceType[\s\S]*billingPeriod\s+BillingPeriod[\s\S]*chargeUnit\s+BillingChargeUnit[\s\S]*periodStart\s+DateTime[\s\S]*periodEnd\s+DateTime[\s\S]*metadataJson\s+Json\?/
    )
    expect(schema).toMatch(
      /enum BillingOrderStatus \{[\s\S]*PENDING[\s\S]*CHARGED[\s\S]*FULFILLED[\s\S]*FAILED[\s\S]*CANCELLED/
    )
    expect(schema).toMatch(
      /enum BillingChargeUnit \{[\s\S]*SUBSCRIPTION[\s\S]*DEVICE/
    )
    expect(schema).toMatch(
      /model BillingInvoice \{[\s\S]*orders\s+BillingOrder\[\]/
    )
    expect(schema).toMatch(
      /model ServiceSubscription \{[\s\S]*orders\s+BillingOrder\[\]/
    )
    const migration = await Bun.file(
      "prisma/migrations/20260805000000_unified_billing_catalog/migration.sql"
    ).text()
    expect(migration).toContain('UPDATE "Pricing"')
    expect(migration).toContain('UPDATE "Subscription"')
    expect(migration).toContain('CREATE TABLE "BillingOrder"')
    expect(migration).toContain('CREATE TABLE "BillingOrderLine"')
    expect(migration).toContain(
      'DROP INDEX IF EXISTS "Pricing_planId_regionId_type_billingMode_key"'
    )
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "Pricing_payg_identity_key"'
    )
    expect(migration).toContain('WHERE "billingPeriod" IS NULL')
    expect(migration).toContain("Pricing_recurring_fields_check")
    expect(migration).toContain('"periodPrice" IS NULL')
    expect(migration).toContain('SET "isActive" = false')
    expect(migration).toContain("DISTINCT ON")
    expect(migration).toContain('"serviceSubscriptionId" = s."id"')
    expect(migration).toContain('v."id" = b."vpnSubscriptionId"')
    expect(migration).toContain("TASK1_UNMAPPED_DUPLICATE_VPN_SUBSCRIPTION")
  })

  it("passes Prisma schema validation without a live database", () => {
    const result = Bun.spawnSync([
      "bun",
      "--bun",
      "prisma",
      "validate",
      "--schema",
      "prisma/schema.prisma",
    ])

    expect(result.exitCode).toBe(0)
  })
})
