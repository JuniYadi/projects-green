import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { ReinstallTemplateDialog } from "./reinstall-template-dialog"
import type { StackSummaryDTO } from "../deploy-monitor.dto"

afterEach(cleanup)

const sampleStack: StackSummaryDTO = {
  id: "stack-1",
  name: "Hermes Agent",
  slug: "hermes-agent",
  status: "running",
  framework: null,
  sourceType: "TEMPLATE",
  templateName: "Hermes Agent",
  dockerVersion: "v2026.8.18",
  branchName: "main",
  subdomain: "hermes-agent.sg.pfnapp.dev",
  customDomain: null,
  resourcePlanId: "small",
  billingMode: "PACKAGE",
  billingState: "ACTIVE",
  lastDeployedAt: new Date().toISOString(),
  latestDeploymentId: "dep-1",
  currentStepLabel: "Running",
  currentStepIndex: 12,
  currentStepStartedAt: new Date().toISOString(),
  cluster: null,
}

describe("ReinstallTemplateDialog", () => {
  beforeEach(() => {
    // Mock global fetch
    globalThis.fetch = mock(async (url: string | Request | URL) => {
      const urlStr = String(url)

      if (
        urlStr.includes("/api/deploy/marketplace/templates") ||
        urlStr.includes("/api/templates")
      ) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "tmpl-wp",
                slug: "wordpress",
                name: "WordPress",
                version: "6.5-apache",
                description: "Publish blogs and websites",
                category: "CMS",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (urlStr.includes("/reinstall/preflight")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              canProceed: true,
              currentTemplate: {
                id: "tmpl-hermes",
                slug: "hermes",
                name: "Hermes Agent",
                version: "1.0.0",
                storagePath: "/opt/data",
              },
              targetTemplate: {
                id: "tmpl-wp",
                slug: "wordpress",
                name: "WordPress",
                version: "6.5-apache",
                storagePath: "/var/www/html",
              },
              diff: {
                workloadKind: {
                  current: "statefulset",
                  target: "deployment",
                  changed: true,
                },
                port: { current: 8080, target: 80, changed: true },
                image: {
                  current: "hermes:v1",
                  target: "wordpress:6.5",
                  changed: true,
                },
                storage: {
                  currentPath: "/opt/data",
                  targetPath: "/var/www/html",
                  policy: "PRESERVE_OLD_DETACH_AND_FRESH_VOLUME",
                  warning:
                    "Current storage (/opt/data) will be preserved and detached.",
                },
              },
              dependencies: {
                requiredServiceType: "MYSQL",
                managedStockAvailable: true,
                availableStockCount: 4,
                allowedModes: ["MANAGED", "BYOD"],
              },
              envDiff: {
                preservedEnvs: [],
                requiredEnvs: [],
                obsoleteEnvs: [],
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (urlStr.includes("/reinstall")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              message: "Reinstall triggered successfully",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      return new Response(JSON.stringify({ ok: false }), { status: 404 })
    }) as never
  })

  it("renders template search list and transitions through preflight diff", async () => {
    const onOpenChange = mock()
    const view = render(
      <ReinstallTemplateDialog
        stack={sampleStack}
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    // Should display the header
    expect(
      view.getByText(/Reinstall or Change Template: Hermes Agent/i)
    ).toBeInTheDocument()

    // Wait for templates to load
    await waitFor(() => {
      expect(view.getByText("WordPress")).toBeInTheDocument()
    })

    // Click on WordPress template
    fireEvent.click(view.getByText("WordPress"))

    // Should show preflight screen
    await waitFor(() => {
      expect(
        view.getByText("Preflight Compatibility & Diff")
      ).toBeInTheDocument()
    })

    expect(view.getByText("Database Requirement: MYSQL")).toBeInTheDocument()
    expect(view.getByText("Use Managed Stock Pool")).toBeInTheDocument()
    expect(view.getByText(/4 Available/i)).toBeInTheDocument()

    // Click Next: Safety Review
    fireEvent.click(view.getByText(/Next: Safety Review/i))

    // Should show final confirmation screen
    await waitFor(() => {
      expect(view.getByText("Confirm Template Reinstall")).toBeInTheDocument()
    })

    expect(
      view.getByText(/Safety Checks & Rollback Guarantee/i)
    ).toBeInTheDocument()

    // Confirm button should be disabled until slug matches
    const confirmBtn = view.getByText("Confirm & Deploy New Template")
    expect(confirmBtn).toBeDisabled()

    // Type the correct slug
    const slugInput = view.getByPlaceholderText("hermes-agent")
    fireEvent.change(slugInput, { target: { value: "hermes-agent" } })

    expect(confirmBtn).not.toBeDisabled()

    // Click confirm
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })
})
