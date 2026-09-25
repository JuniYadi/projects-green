import { afterEach, describe, expect, it } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import { TemplateAccessCard } from "./template-access-card"
import type { StackSummaryDTO } from "../deploy-monitor.dto"

afterEach(cleanup)

const stack: StackSummaryDTO = {
  id: "stack-1",
  name: "9router",
  slug: "9router-prod",
  status: "running",
  framework: null,
  branchName: "main",
  subdomain: "router.example.test",
  customDomain: null,
  resourcePlanId: null,
  billingMode: null,
  billingState: "ACTIVE",
  lastDeployedAt: null,
  latestDeploymentId: null,
  currentStepLabel: null,
  currentStepIndex: null,
  currentStepStartedAt: null,
  access: {
    mode: "password-only",
    title: "Mulai menggunakan 9router",
    loginPath: "/login",
    fields: [
      {
        id: "password",
        label: "Password awal",
        source: "env",
        key: "INITIAL_PASSWORD",
        secret: true,
      },
    ],
    steps: [
      {
        text: "Lihat password",
        action: { type: "reveal-field", fieldId: "password" },
      },
      { text: "Buka web", action: { type: "open-app" } },
    ],
  },
}

describe("TemplateAccessCard", () => {
  it("keeps reveal disabled until the env is stored", () => {
    const view = render(<TemplateAccessCard stack={stack} locale="id" />)
    expect(view.getByText(/Akses belum siap/)).toBeDefined()
    expect(
      view.getByRole("button", { name: "Lihat" }).hasAttribute("disabled")
    ).toBe(true)
    expect(view.queryByText("123456")).toBeNull()
  })

  it("shows ordered steps and the login link without returning the secret", () => {
    const view = render(
      <TemplateAccessCard
        stack={{ ...stack, accessReadyKeys: ["INITIAL_PASSWORD"] }}
        locale="id"
      />
    )
    expect(view.container.querySelectorAll("ol li")).toHaveLength(2)
    expect(
      view.getByRole("button", { name: "Lihat" }).hasAttribute("disabled")
    ).toBe(false)
    expect(
      view.getByRole("link", { name: "Buka aplikasi" }).getAttribute("href")
    ).toBe("https://router.example.test/login")
    expect(view.queryByText("123456")).toBeNull()
  })
})
