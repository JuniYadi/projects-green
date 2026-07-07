import { describe, expect, it, mock } from "bun:test"

const mockFetch = mock(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve({
        ok: true,
        data: [
          {
            id: "log_1",
            action: "MESSAGE_SENT",
            status: "OK",
            message: "Message sent to +6281234567890",
            adminId: "admin_1",
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: { page: 1, total: 1, totalPages: 1 },
      }),
  })
)

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappAuditLog: {
      findMany: mock(() => []),
      count: mock(() => 0),
    },
    whatsappDevice: {
      findUnique: mock(() => null),
    },
  },
}))

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mock(() => {}),
    replace: mock(() => {}),
  }),
  useParams: () => ({ lang: "en" }),
  useSearchParams: () => new URLSearchParams(),
}))

// eslint-disable-next-line no-global-assign
globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch

import { render } from "@testing-library/react"
import ConsoleWhatsAppAuditLogsPage from "./page"

describe("ConsoleWhatsAppAuditLogsPage", () => {
  it("renders the page heading", async () => {
    const view = render(<ConsoleWhatsAppAuditLogsPage />)

    expect(view.getByText("WhatsApp Audit Logs")).toBeInTheDocument()
  })

  it("renders filter controls", async () => {
    const view = render(<ConsoleWhatsAppAuditLogsPage />)

    // Verify label elements exist (may appear in header and table)
    expect(view.getAllByText("Action").length).toBeGreaterThanOrEqual(1)
    expect(view.getAllByText("Status").length).toBeGreaterThanOrEqual(1)
    // Verify buttons exist
    expect(view.getByRole("button", { name: "Apply" })).toBeInTheDocument()
    expect(view.getByRole("button", { name: "Reset" })).toBeInTheDocument()
  })
  it("requests page limit of 20", async () => {
    const view = render(<ConsoleWhatsAppAuditLogsPage />)

    // Wait for fetch to resolve and check URL param
    await new Promise((r) => setTimeout(r, 100))
    const call = mockFetch.mock.calls[0]
    expect(call).toBeDefined()
    const url = call?.[0] as string | undefined
    expect(url).toBeTruthy()
    expect(url).toContain("limit=20")

    view.unmount()
  })
})
