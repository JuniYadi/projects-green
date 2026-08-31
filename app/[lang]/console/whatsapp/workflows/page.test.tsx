import "@/test/register"
import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor } from "@testing-library/react"

const mockGetWorkflows = mock(() =>
  Promise.resolve({
    data: {
      data: [],
    },
  })
)

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
}))

mock.module("@/lib/i18n/pathname", () => ({
  resolveLocaleOrDefault: (lang?: string) => lang || "en",
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      whatsapp: {
        workflows: {
          get: mockGetWorkflows,
        },
      },
    },
  },
}))

import WhatsappWorkflowsPage from "./page"

describe("WhatsappWorkflowsPage UI", () => {
  beforeEach(() => {
    mockGetWorkflows.mockResolvedValue({ data: { data: [] } })
  })

  it("renders localized header and create button", async () => {
    const view = render(<WhatsappWorkflowsPage />)
    expect(
      view.getByRole("heading", { level: 1, name: "AI & Bot Workflows" })
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        view.getByRole("heading", {
          name: "Automate your WhatsApp conversations",
        })
      ).toBeInTheDocument()
    )
    expect(view.getByRole("link", { name: "Create workflow" })).toHaveAttribute(
      "href",
      "/en/console/whatsapp/workflows/new/canvas"
    )
  })

  it("renders onboarding guide and starter template links when empty", async () => {
    const view = render(<WhatsappWorkflowsPage />)

    await waitFor(() =>
      expect(
        view.getByRole("heading", {
          name: "Automate your WhatsApp conversations",
        })
      ).toBeInTheDocument()
    )

    expect(view.getByText("Choose a trigger")).toBeInTheDocument()
    expect(view.getByText("Build your flow")).toBeInTheDocument()
    expect(view.getByText("Test and deploy")).toBeInTheDocument()
    expect(
      view.getByRole("heading", { name: "Start with a template" })
    ).toBeInTheDocument()

    for (const [id, title] of [
      ["template_customer_support", "Customer Support Bot"],
      ["template_order_tracking", "Order Tracking Bot"],
      ["template_lead_qualification", "Lead Qualification Bot"],
    ]) {
      const link = view.getByRole("link", { name: new RegExp(title) })
      expect(link).toHaveAttribute(
        "href",
        `/en/console/whatsapp/workflows/new/canvas?template=${id}`
      )
    }
  })

  it("renders active workflow cards with localized badges and actions", async () => {
    mockGetWorkflows.mockResolvedValue({
      data: {
        ok: true,
        data: [
          {
            id: "wf-1",
            name: "Support flow",
            description: "Answers customer questions",
            isActive: true,
            isDefault: true,
            trigger: {
              id: "trig-1",
              type: "keyword_match",
              keywords: ["help"],
            },
            nodes: [
              { id: "one", name: "One", type: "send_message" },
              { id: "two", name: "Two", type: "send_message" },
            ],
            edges: [],
            device: {
              id: "device-1",
              name: "Support number",
              phoneNumber: "+628123456789",
            },
          },
          {
            id: "wf-2",
            name: "Inactive flow",
            description: "",
            isActive: false,
            isDefault: false,
            trigger: { id: "trig-2", type: "whatsapp_inbound", keywords: [] },
            nodes: [],
            edges: [],
          },
        ],
      },
    } as never)
    const view = render(<WhatsappWorkflowsPage />)

    await waitFor(() =>
      expect(view.getByText("Support flow")).toBeInTheDocument()
    )

    expect(view.getByText("Default")).toBeInTheDocument()
    expect(view.getByText("Active")).toBeInTheDocument()
    expect(view.getByText("Inactive")).toBeInTheDocument()
    expect(view.getByText("2 nodes")).toBeInTheDocument()
    expect(view.getByText("Trigger: keyword_match")).toBeInTheDocument()
    expect(view.getByText("Trigger: whatsapp_inbound")).toBeInTheDocument()
    expect(view.getByText("Support number")).toBeInTheDocument()
    expect(
      view.getAllByRole("link", { name: "Open canvas" })[0]
    ).toHaveAttribute("href", "/en/console/whatsapp/workflows/wf-1/canvas")
  })
})
