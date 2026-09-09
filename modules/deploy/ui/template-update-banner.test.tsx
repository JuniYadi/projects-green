import "@/test/register"
import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TemplateUpdateBanner } from "./template-update-banner"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"

const baseStack: StackSummaryDTO = {
  id: "stack-1",
  name: "9router Gateway",
  slug: "9router-daring-pulsar",
  status: "running",
  framework: null,
  branchName: "main",
  subdomain: "9router-daring",
  customDomain: null,
  resourcePlanId: "payg",
  billingMode: "PAYG",
  billingState: "ACTIVE",
  sourceType: "TEMPLATE",
  templateId: "tmpl-9router",
  templateName: "9router",
  templateUpdate: {
    installedVersion: "1.0.0",
    latestVersion: "1.2.0",
    hasUpdate: true,
  },
  lastDeployedAt: "2026-09-01T00:00:00Z",
  latestDeploymentId: null,
  currentStepLabel: null,
  currentStepIndex: null,
  currentStepStartedAt: null,
}

describe("TemplateUpdateBanner", () => {
  beforeEach(() => {
    cleanup()
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes("/upgrade-template")) {
        return new Response(
          JSON.stringify({
            ok: true,
            commitSha: "sha-new",
            message: "Template updated successfully",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      return new Response("Not found", { status: 404 })
    }) as unknown as typeof fetch
  })

  it("does not render when hasUpdate is false", () => {
    const noUpdateStack = {
      ...baseStack,
      templateUpdate: {
        installedVersion: "1.0.0",
        latestVersion: "1.0.0",
        hasUpdate: false,
      },
    }

    const { queryByText } = render(
      <TemplateUpdateBanner stack={noUpdateStack} />
    )
    expect(queryByText(/Template Update Available/i)).toBeNull()
  })

  it("renders update banner with version tags when update is available", () => {
    const { getByText } = render(<TemplateUpdateBanner stack={baseStack} />)

    expect(getByText("Template Update Available")).toBeTruthy()
    expect(getByText("v1.0.0")).toBeTruthy()
    expect(getByText("v1.2.0")).toBeTruthy()
    expect(getByText(/Update to v1.2.0/i)).toBeTruthy()
  })

  it("opens confirmation dialog with safe merge explanation and triggers upgrade", async () => {
    const user = userEvent.setup()
    const onUpdated = mock()

    const { getByRole, getByText } = render(
      <TemplateUpdateBanner stack={baseStack} onUpdated={onUpdated} />
    )

    const updateBtn = getByRole("button", { name: /Update to v1.2.0/i })
    await user.click(updateBtn)

    await waitFor(() => {
      expect(getByText(/Safe Merge Protections:/i)).toBeTruthy()
      expect(getByText(/Custom sizing preserved:/i)).toBeTruthy()
      expect(getByText(/Existing envs preserved:/i)).toBeTruthy()
    })

    const confirmBtn = getByRole("button", { name: /Confirm & Update/i })
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalled()
    })
  })
})
