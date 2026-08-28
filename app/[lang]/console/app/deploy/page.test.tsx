import { describe, expect, it, mock } from "bun:test"
import { act, fireEvent, render } from "@testing-library/react"

const capturedBody: { current: Record<string, unknown> | null } = {
  current: null,
}

const mockPost = mock(async (body: unknown) => {
  capturedBody.current = body as Record<string, unknown>
  return { data: { ok: true, data: { stackId: "stack-1" } } }
})

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      deploy: {
        submit: { post: mockPost },
        apps: {
          get: mock(async () => ({ data: { ok: true, data: [] } })),
        },
      },
    },
  },
}))
mock.module("@/lib/billing-client", () => ({
  getCatalogProduct: mock(async () => ({
    ok: true,
    product: {
      code: "APP_HOSTING",
      name: "App Hosting",
      plans: [
        {
          id: "plan_starter",
          code: "STARTER",
          name: "Starter",
          offers: [
            {
              id: "off_1",
              billingPeriod: "MONTHLY",
              periodPrice: "15000",
              currency: "IDR",
            },
          ],
        },
      ],
    },
  })),
}))

describe("DeployPage", () => {
  it("renders AI deployment assistant feed", async () => {
    const deployPageModule =
      // dynamic import required: module must load after mock.module()
      await import("@/app/[lang]/console/app/deploy/page")
    const view = render(<deployPageModule.default />)

    expect(view.getByText("AI deployment assistant")).toBeTruthy()
    expect(
      view.getByPlaceholderText("Paste a GitHub repository URL to deploy…")
    ).toBeTruthy()
    expect(view.getByText("Or launch a ready-made app")).toBeTruthy()
  })

  it("submits a ready-made app with package settings", async () => {
    capturedBody.current = null
    mockPost.mockClear()

    const deployPageModule =
      // dynamic import required: module must load after mock.module()
      await import("@/app/[lang]/console/app/deploy/page")
    const view = render(<deployPageModule.default />)

    await act(async () => {
      fireEvent.click(view.getAllByRole("button", { name: "Deploy" })[0]!)
    })

    await act(async () => {
      fireEvent.click(
        view.getByRole("button", { name: "Launch to Kubernetes" })
      )
    })

    expect(capturedBody.current).toMatchObject({
      sourceType: "MANAGED_TEMPLATE",
      templateId: "n8n",
      billingMode: "PACKAGE",
      resourcePlanId: "starter",
    })
    expect(
      String(
        (capturedBody.current as Record<string, unknown> | null)?.subdomain ??
          ""
      )
    ).toMatch(/^n8n-/)
    expect(
      view.queryByRole("button", { name: "Launch to Kubernetes" })
    ).toBeNull()
  })
})
