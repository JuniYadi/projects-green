import { describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"
import { getMessages } from "@/lib/i18n/messages"

const mockAuditGet = mock(() =>
  Promise.resolve({
    status: 200,
    data: {
      ok: true,
      data: [
        {
          id: "log_platform_1",
          action: "TEMPLATE_SYNC_REQUESTED",
          status: "OK",
          message: "Bulk template sync requested",
          actorName: "Platform Support",
          actorEmail: null,
          isPlatformAdmin: true,
          deviceId: "dev_1",
          deviceLabel: "+6281234567890",
          createdAt: new Date("2026-09-09T00:11:28.000Z").toISOString(),
        },
        {
          id: "log_user_2",
          action: "MESSAGE_SENT",
          status: "OK",
          message: "Message sent",
          actorName: "Tenant User",
          actorEmail: "tenant@example.com",
          isPlatformAdmin: false,
          deviceId: "dev_1",
          deviceLabel: "+6281234567890",
          createdAt: new Date("2026-09-09T01:00:00.000Z").toISOString(),
        },
      ],
    },
  })
)

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      whatsapp: {
        audit: {
          get: mockAuditGet,
        },
      },
    },
  },
}))

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: mock(() => {}), replace: mock(() => {}) }),
  usePathname: () => "/en/console/whatsapp/logs",
  useParams: () => ({ lang: "en" }),
  useSearchParams: () => new URLSearchParams(),
}))

import { AuditLogsTabContent } from "./audit-logs-tab-content"

describe("AuditLogsTabContent", () => {
  it("renders audit logs and shows Platform Support badge for platform admin actions", async () => {
    const messages = getMessages("en")
    const view = render(<AuditLogsTabContent locale="en" messages={messages} />)

    await waitFor(() => {
      expect(view.getByText("Tenant User")).toBeInTheDocument()
      expect(view.getByText("tenant@example.com")).toBeInTheDocument()
    })

    const badges = view.getAllByText("Platform Support")
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })
})
