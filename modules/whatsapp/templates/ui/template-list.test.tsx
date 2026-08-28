import "@/test/register"
import { describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { TemplateList } from "./template-list"
import type { WhatsAppTemplate } from "@/lib/api/whatsapp-client"

const baseTemplate: WhatsAppTemplate = {
  id: "tpl-1",
  slug: "welcome_message",
  name: "Welcome Message",
  organizationId: "org-1",
  whatsappDeviceId: "dev-1",
  syncStatus: "SYNCED",
  metaStatus: "APPROVED",
  category: "MARKETING",
  languages: [],
  device: {
    id: "dev-1",
    phoneNumber: "+628123456789",
    status: "ACTIVE",
  },
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
}

describe("TemplateList", () => {
  it("renders template items with device phone number and slug", () => {
    const onSelectTemplate = mock()
    const view = render(
      <TemplateList
        templates={[baseTemplate]}
        loading={false}
        error={null}
        onRetry={mock()}
        onSelectTemplate={onSelectTemplate}
      />
    )

    expect(view.getByText("Welcome Message")).toBeInTheDocument()
    expect(view.getByText("welcome_message")).toBeInTheDocument()
    expect(view.getByText("📱 +628123456789")).toBeInTheDocument()
    expect(view.getByText("MARKETING")).toBeInTheDocument()
    expect(view.getByText("Synced")).toBeInTheDocument()
    expect(view.getByText("Approved")).toBeInTheDocument()

    fireEvent.click(view.getByRole("button", { name: "Welcome Message" }))
    expect(onSelectTemplate).toHaveBeenCalledWith(baseTemplate)
    cleanup()
  })

  it("renders fallback device label when template has whatsappDeviceId without full device object", () => {
    const view = render(
      <TemplateList
        templates={[{ ...baseTemplate, id: "tpl-2", device: null }]}
        loading={false}
        error={null}
        onRetry={mock()}
      />
    )

    expect(view.getByText("📱 Device: dev-1")).toBeInTheDocument()
    cleanup()
  })

  it("renders skeleton loader when loading", () => {
    const { container } = render(
      <TemplateList
        templates={[]}
        loading={true}
        error={null}
        onRetry={mock()}
      />
    )

    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
    cleanup()
  })
  it("renders error state with retry button", () => {
    const onRetry = mock()
    const view = render(
      <TemplateList
        templates={[]}
        loading={false}
        error="Failed to fetch templates"
        onRetry={onRetry}
      />
    )

    expect(view.getByRole("alert")).toHaveTextContent(
      "Failed to fetch templates"
    )
    fireEvent.click(view.getByRole("button"))
    expect(onRetry).toHaveBeenCalled()
    cleanup()
  })

  it("renders empty state with create button", () => {
    const onCreate = mock()
    const view = render(
      <TemplateList
        templates={[]}
        loading={false}
        error={null}
        onRetry={mock()}
        onCreate={onCreate}
      />
    )

    expect(view.getByText("No templates configured yet")).toBeInTheDocument()
    const createButton = view.getByRole("button", { name: "Create Template" })
    fireEvent.click(createButton)
    expect(onCreate).toHaveBeenCalled()
    cleanup()
  })

  it("triggers onSelect callback when clicking on template name if onSelectTemplate is not provided", () => {
    const onSelect = mock()
    const view = render(
      <TemplateList
        templates={[baseTemplate]}
        loading={false}
        error={null}
        onRetry={mock()}
        onSelect={onSelect}
      />
    )

    fireEvent.click(view.getByRole("button", { name: "Welcome Message" }))
    expect(onSelect).toHaveBeenCalledWith("tpl-1")
    cleanup()
  })
})
