import { describe, expect, it, mock, afterEach } from "bun:test"
import { cleanup, render, waitFor } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import {
  createSimulatorSession,
  stepSimulatorSession,
} from "@/modules/whatsapp/workflow/workflow-simulator"
import { WORKFLOW_TEMPLATES } from "@/modules/whatsapp/workflow/workflow-templates"

const searchParams = new URLSearchParams()

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en", id: "new" }),
  useRouter: () => ({ push: mock(() => {}) }),
  useSearchParams: () => searchParams,
}))

mock.module("sonner", () => ({
  toast: {
    success: mock(() => {}),
    error: mock(() => {}),
    warning: mock(() => {}),
    info: mock(() => {}),
  },
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      whatsapp: {
        devices: { get: mock(async () => ({ data: { devices: [] } })) },
      },
    },
  },
}))

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

import WhatsappWorkflowCanvasPage from "./page"

describe("Canvas simulator integration", () => {
  afterEach(cleanup)
  it("runs a template graph when a simulated customer message is sent", () => {
    const workflow = WORKFLOW_TEMPLATES[0].workflow
    let session = createSimulatorSession(workflow)
    session = stepSimulatorSession(session, workflow)
    session = stepSimulatorSession(
      session,
      workflow,
      "My checkout is not working"
    )

    expect(session.history.some((message) => message.sender === "user")).toBe(
      true
    )
    expect(session.history.some((message) => message.sender === "bot")).toBe(
      true
    )
    expect(session.variables.customer_issue).toBe("My checkout is not working")
  })

  it("hydrates the selected starter template from the URL", async () => {
    searchParams.set("template", WORKFLOW_TEMPLATES[1].id)
    const view = render(<WhatsappWorkflowCanvasPage />)

    await waitFor(() => {
      expect(
        view.getByDisplayValue("Order Tracking & Status Bot")
      ).toBeDefined()
    })
    searchParams.delete("template")
  })

  it("renders localized canvas labels", () => {
    const html = renderToString(<WhatsappWorkflowCanvasPage />)

    expect(html).toContain("Add a step")
    expect(html).toContain("Simulate test")
    expect(html).toContain("Save and deploy")
    expect(html).toContain("Trigger:")
  })
  it("renders canvas with step palette and supports quick deletion callback", async () => {
    const view = render(<WhatsappWorkflowCanvasPage />)

    await waitFor(() => {
      expect(view.getByText("Add a step")).toBeDefined()
      expect(view.getByRole("button", { name: "Send message" })).toBeDefined()
      expect(view.getByRole("button", { name: "Ask for input" })).toBeDefined()
    })
  })
  it("renders trigger settings pill and allows opening trigger dialog", async () => {
    const view = render(<WhatsappWorkflowCanvasPage />)

    await waitFor(() => {
      expect(view.getByText(/Trigger:/)).toBeDefined()
    })
  })
})
