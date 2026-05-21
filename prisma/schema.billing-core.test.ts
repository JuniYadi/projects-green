import { describe, expect, it } from "bun:test"

describe("billing core prisma models", () => {
  it("defines billing account, catalog, usage, invoicing, and ops models", async () => {
    const schema = await Bun.file("prisma/schema.prisma").text()

    expect(schema).toContain("model BillingAccount {")
    expect(schema).toContain("model BillingSubscription {")
    expect(schema).toContain("model SubscriptionVersion {")
    expect(schema).toContain("model Plan {")
    expect(schema).toContain("model PlanVersion {")
    expect(schema).toContain("model Meter {")
    expect(schema).toContain("model MeterPrice {")

    expect(schema).toContain("model UsageEvent {")
    expect(schema).toContain("@@unique([billingAccountId, idempotencyKey])")
    expect(schema).toContain("model RatedUsage {")

    expect(schema).toContain("model Invoice {")
    expect(schema).toContain("@@unique([billingAccountId, periodStart, periodEnd])")
    expect(schema).toContain("model InvoiceLine {")
    expect(schema).toContain("model InvoiceLineSource {")
    expect(schema).toContain("model BillingAdjustment {")

    expect(schema).toContain("model BillingRun {")
    expect(schema).toContain("model BillingAuditLog {")
  })
})
