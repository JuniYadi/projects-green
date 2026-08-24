import { describe, expect, it, mock } from "bun:test"
import { act, fireEvent, render } from "@testing-library/react"

import { MANAGED_APP_TEMPLATES } from "@/modules/deploy/managed-app-templates"
import { QuickDeployDialog, TemplateCatalog } from "./template-catalog"

describe("TemplateCatalog", () => {
  it("renders all managed app templates and selects one", () => {
    const onSelect = mock(() => {})
    const view = render(<TemplateCatalog onSelect={onSelect} />)

    expect(view.getByText("Or launch a ready-made app")).toBeTruthy()
    expect(view.getByText("n8n")).toBeTruthy()
    expect(view.getByText("Hermes")).toBeTruthy()
    expect(view.getByText("9router")).toBeTruthy()
    expect(view.getByText("Umami")).toBeTruthy()
    expect(view.getByText("Workflow Automation")).toBeTruthy()

    const deployButtons = view.getAllByRole("button", { name: "Deploy" })
    expect(deployButtons).toHaveLength(MANAGED_APP_TEMPLATES.length)

    fireEvent.click(deployButtons[0]!)
    expect(onSelect).toHaveBeenCalledWith(MANAGED_APP_TEMPLATES[0])
  })

  it("confirms a template with a generated subdomain", async () => {
    const onConfirm = mock(() => {})
    const template = MANAGED_APP_TEMPLATES[0]
    const view = render(
      <QuickDeployDialog
        template={template}
        open
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    )
    const warning =
      `A managed ${template.engineType} database slot will be allocated ` +
      "automatically."
    expect(view.getByText(warning)).toBeTruthy()
    const input = view.getByLabelText("Subdomain") as HTMLInputElement
    expect(input.value).toMatch(new RegExp(`^${template.defaultSubdomain}-`))

    await act(async () => {
      fireEvent.click(
        view.getByRole("button", { name: "Launch to Kubernetes" })
      )
    })
    expect(onConfirm).toHaveBeenCalledWith(input.value)
  })
})
