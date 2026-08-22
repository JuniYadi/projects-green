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
