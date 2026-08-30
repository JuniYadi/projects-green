import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"

const mockReplace = mock(() => {})

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mock(() => {}),
    replace: mockReplace,
  }),
  usePathname: () => "/en/console/whatsapp/logs",
  useParams: () => ({ lang: "en" }),
  useSearchParams: () => new URLSearchParams(),
}))

mock.module("@/modules/whatsapp/onboarding/use-whatsapp-onboarding", () => ({
  useWhatsAppOnboarding: () => ({
    isFeatureLocked: () => false,
    getFeatureUnlockLevel: () => 0,
    isGraduated: true,
    progressPercent: 100,
    activeMission: {
      title: "Done",
      subtitle: "Done",
      description: "Done",
      actionLabel: "Done",
      completed: true,
    },
    graduateNow: () => {},
    resetOnboarding: () => {},
  }),
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      whatsapp: {
        devices: {
          get: mock(() =>
            Promise.resolve({
              status: 200,
              data: { data: [{ id: "dev-1", phoneNumber: "+6281234567890" }] },
            })
          ),
        },
        webhooks: {
          events: {
            get: mock(() =>
              Promise.resolve({
                status: 200,
                data: {
                  data: [
                    {
                      id: "evt_1",
                      eventType: "status_update",
                      processingStatus: "SUCCESS",
                      phoneNumber: "+6281234567890",
                      createdAt: new Date().toISOString(),
                    },
                  ],
                  meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
                },
              })
            ),
          },
        },
        audit: {
          get: mock(() =>
            Promise.resolve({
              status: 200,
              data: {
                ok: true,
                data: [
                  {
                    id: "log_1",
                    action: "MESSAGE_SENT",
                    status: "OK",
                    message: "Message sent",
                    createdAt: new Date().toISOString(),
                  },
                ],
                pagination: { total: 1, page: 1, limit: 15, totalPages: 1 },
              },
            })
          ),
        },
      },
    },
  },
}))

import ConsoleWhatsAppLogsPage from "./page"

describe("ConsoleWhatsAppLogsPage", () => {
  it("renders page heading and tabs", async () => {
    const view = render(<ConsoleWhatsAppLogsPage />)
    expect(view.getByText("Logs & Activity Trail")).toBeInTheDocument()
    expect(view.getByRole("tab", { name: "Message Logs" })).toBeInTheDocument()
    expect(view.getByRole("tab", { name: "Activity Logs" })).toBeInTheDocument()
  })

  it("renders message logs tab content by default", async () => {
    const view = render(<ConsoleWhatsAppLogsPage />)
    expect(
      view.getAllByText("Message Logs & Delivery Status").length
    ).toBeGreaterThanOrEqual(1)
  })
})
