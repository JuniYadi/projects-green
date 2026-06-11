import { describe, expect, it } from "bun:test"

describe("billing core prisma models", () => {
  it("defines billing account, catalog, usage, invoicing, and ops models", async () => {
    const schema = await Bun.file("prisma/schema.prisma").text()

    expect(schema).toContain("model BillingAccount {")
    expect(schema).toContain("model BillingSubscription {")
    expect(schema).toContain("model SubscriptionVersion {")
    expect(schema).toContain("model Plan {")
    expect(schema).toContain("model PlanVersion {")
    expect(schema).toContain("model BillingMeter {")
    expect(schema).toContain("model BillingMeterPrice {")

    expect(schema).toContain("model BillingUsageEvent {")
    expect(schema).toContain("@@unique([billingAccountId, idempotencyKey])")
    expect(schema).toContain("model BillingRatedUsage {")

    expect(schema).toContain("model BillingInvoice {")
    expect(schema).toContain("@@unique([billingAccountId, periodStart, periodEnd])")
    expect(schema).toContain("model BillingInvoiceLine {")
    expect(schema).toContain("model BillingInvoiceLineSource {")
    expect(schema).toContain("model BillingAdjustment {")

    expect(schema).toContain("model BillingRun {")
    expect(schema).toContain("model BillingAuditLog {")
  })
})
