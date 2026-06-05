import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import { SettingsHeader } from "./settings-header"

describe("SettingsHeader", () => {
  it("renders title and description", () => {
    const view = render(
      <SettingsHeader title="Profile" description="Manage your profile." />
    )

    expect(view.getByText("Profile")).toBeInTheDocument()
    expect(view.getByText("Manage your profile.")).toBeInTheDocument()
  })

  it("renders organization name when provided", () => {
    const view = render(
      <SettingsHeader
        title="Organization"
        description="Settings"
        organizationName="Acme Corp"
      />
    )

    expect(view.getByText("Organization")).toBeInTheDocument()
    expect(
      view.getByText(/for/)
    ).toBeInTheDocument()
    expect(view.getByText("Acme Corp")).toBeInTheDocument()
    expect(view.getByText(/Settings/)).toBeInTheDocument()
  })

  it("does not render 'for' span when organizationName is empty", () => {
    const view = render(
      <SettingsHeader
        title="Billing"
        description="Billing details"
        organizationName=""
      />
    )

    expect(view.getByText("Billing details")).toBeInTheDocument()
    expect(view.queryByText("for")).toBeNull()
  })

  it("does not render 'for' span when organizationName is undefined", () => {
    const view = render(
      <SettingsHeader title="Security" description="Security settings" />
    )

    expect(view.getByText("Security settings")).toBeInTheDocument()
    expect(view.queryByText("for")).toBeNull()
  })

  it("renders Card with correct className", () => {
    const view = render(
      <SettingsHeader title="API" description="API Keys" organizationName="Org" />
    )

    const card = view.container.querySelector(".rounded-none")
    expect(card).toBeTruthy()
    expect(card?.classList.contains("border-0")).toBe(true)
    expect(card?.classList.contains("border-b")).toBe(true)
  })
})
