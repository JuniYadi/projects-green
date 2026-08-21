import { describe, expect, it } from "bun:test"
import React from "react"
import { renderToString } from "react-dom/server"

import { AuditLogTable, type AuditLogDTO } from "./whatsapp-audit-table"

const mockLog: AuditLogDTO = {
  id: "log-1",
  organizationId: "org-1",
  deviceId: "device-1",
  adminId: "admin-1",
  correlationId: "corr-1",
  action: "WEBHOOK_REJECTED",
  status: "FAILED",
  message: "Incoming Meta WhatsApp webhook rejected: UNKNOWN_DEVICE",
  errorMessage: "UNKNOWN_DEVICE",
  details: {
    webhookKey: "key-1",
    metaAppId: "waba-1",
    phoneIds: ["276117585593429"],
    rawPayload: { object: "whatsapp_business_account" },
  },
  durationMs: 12,
  ip: "127.0.0.1",
  userAgent: "facebookplatform/1.0",
  createdAt: new Date().toISOString(),
}

describe("AuditLogTable", () => {
  it("renders audit log table without crashing", () => {
    const html = renderToString(
      <AuditLogTable logs={[mockLog]} isLoading={false} />
    )

    expect(html).toContain("WEBHOOK_REJECTED")
    expect(html).toContain("FAILED")
    expect(html).toContain("Incoming Meta WhatsApp webhook rejected")
  })

  it("renders loading state", () => {
    const html = renderToString(<AuditLogTable logs={[]} isLoading={true} />)
    expect(html).toBeDefined()
  })

  it("renders empty state", () => {
    const html = renderToString(<AuditLogTable logs={[]} isLoading={false} />)
    expect(html).toContain("No audit logs found")
  })
  it("uses the portal message journey path when provided", () => {
    const html = renderToString(
      <AuditLogTable
        logs={[{ ...mockLog, details: { waMessageId: "wamid.123" } }]}
        isLoading={false}
        messageJourneyBasePath="/portal/whatsapp/messages"
      />
    )

    expect(html).toContain('href="/portal/whatsapp/messages/wamid.123"')
  })
})
