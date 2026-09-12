import { describe, expect, it, mock } from "bun:test"
import RedirectToAuditLogsTab from "./page"

const mockRedirect = mock((_url: string) => {})

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
}))

describe("RedirectToAuditLogsTab", () => {
  it("redirects to the unified logs page with audit tab query", async () => {
    await RedirectToAuditLogsTab({ params: Promise.resolve({ lang: "en" }) })
    expect(mockRedirect).toHaveBeenCalledWith(
      "/en/console/whatsapp/logs?tab=audit"
    )
  })
})
