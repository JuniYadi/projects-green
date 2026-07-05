import { describe, it, expect, beforeEach, mock } from "bun:test"

const mockFetch = mock()
globalThis.fetch = mockFetch as typeof fetch

import { getAdminAuditLogs } from "./billing-client"

describe("getAdminAuditLogs", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("calls the correct endpoint with default params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, logs: [], total: 0 }),
    } as Response)

    const result = await getAdminAuditLogs()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain("/api/billing/admin/billing-audit/logs")
    expect(result.ok).toBe(true)
  })

  it("passes query params correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, logs: [], total: 0 }),
    } as Response)

    await getAdminAuditLogs({
      page: 2,
      limit: 10,
      entityType: "ServiceSubscription",
      entityId: "sub-123",
      billingAccountId: "ba-456",
    })

    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain("page=2")
    expect(url).toContain("limit=10")
    expect(url).toContain("entityType=ServiceSubscription")
    expect(url).toContain("entityId=sub-123")
    expect(url).toContain("billingAccountId=ba-456")
  })

  it("omits undefined params from the URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, logs: [], total: 0 }),
    } as Response)

    await getAdminAuditLogs({ limit: 5 })

    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain("limit=5")
    expect(url).not.toContain("page")
    expect(url).not.toContain("entityType")
    expect(url).not.toContain("entityId")
    expect(url).not.toContain("billingAccountId")
  })

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, message: "Internal error" }),
    } as Response)

    await expect(getAdminAuditLogs()).rejects.toThrow()
  })

  it("throws when response ok is false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, message: "Forbidden" }),
    } as Response)

    await expect(getAdminAuditLogs()).rejects.toThrow()
  })
})
