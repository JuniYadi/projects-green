import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

import type {
  ProductPlanEditorForm,
  SupportedCurrency,
} from "@/components/billing/admin/catalog/catalog-editor.types"

const mockBillingPeriodLabel = mock((period: string) => period)

mock.module("@/lib/billing-client", () => ({
  billingPeriodLabel: mockBillingPeriodLabel,
}))

const { CatalogPlansTab } = await import("./catalog-plans-tab")

const currencies: SupportedCurrency[] = ["IDR"]

function createPlan(
  overrides: Partial<ProductPlanEditorForm> = {}
): ProductPlanEditorForm {
  return {
    id: "plan-1",
    code: "STANDARD",
    name: "Standard",
    resources: {},
    isActive: true,
    enabledTerms: ["MONTHLY"],
    offers: [],
    ...overrides,
  }
}

function PlansHarness({
  initialPlans,
}: Readonly<{ initialPlans: ProductPlanEditorForm[] }>) {
  const [plans, setPlans] = useState(initialPlans)

  return (
    <CatalogPlansTab
      plans={plans}
      currencies={currencies}
      onChange={setPlans}
    />
  )
}

describe("CatalogPlansTab", () => {
  it("adds plans with editable identity fields and unique default codes", async () => {
    const view = render(<PlansHarness initialPlans={[]} />)
    const user = userEvent.setup()

    await user.click(view.getByRole("button", { name: "Add plan" }))
    await user.click(view.getByRole("button", { name: "Add plan" }))

    const names = view.getAllByLabelText("Name *")
    const codes = view.getAllByLabelText("Code *")
    expect(names).toHaveLength(2)
    expect(codes.map((input) => (input as HTMLInputElement).value)).toEqual([
      "NEW_PLAN_1",
      "NEW_PLAN_2",
    ])

    await user.type(names[0], "Private")
    await user.clear(view.getAllByLabelText("Code *")[0])
    await user.type(view.getAllByLabelText("Code *")[0], "PRIVATE")

    expect(view.getAllByLabelText("Name *")[0]).toHaveValue("Private")
    expect(view.getAllByLabelText("Code *")[0]).toHaveValue("PRIVATE")
    expect(view.getByText("Private")).toBeInTheDocument()
  })

  it("shows an inline error when plan codes are duplicated", async () => {
    const view = render(
      <PlansHarness
        initialPlans={[
          createPlan({ id: "plan-1", code: "STANDARD" }),
          createPlan({
            id: "plan-2",
            code: "PRIVATE",
            name: "Private",
          }),
        ]}
      />
    )
    const user = userEvent.setup()

    const names = view.getAllByLabelText("Name *")
    const codes = view.getAllByLabelText("Code *")
    await user.clear(names[0])
    await user.type(names[0], " ")
    await user.clear(view.getAllByLabelText("Code *")[1])
    await user.type(view.getAllByLabelText("Code *")[1], "STANDARD")

    expect(view.getByText("Name is required.")).toBeInTheDocument()
    expect(
      view.getAllByText("Code must be unique within this product.")
    ).toHaveLength(2)
    expect(codes[0]).toHaveAttribute("aria-invalid", "true")
    expect(codes[1]).toHaveAttribute("aria-invalid", "true")
  })

  it("shows inline errors when plan name and code are empty", () => {
    const view = render(
      <PlansHarness initialPlans={[createPlan({ name: "", code: "" })]} />
    )

    expect(view.getByText("Name is required.")).toBeInTheDocument()
    expect(view.getByText("Code is required.")).toBeInTheDocument()
  })
})
