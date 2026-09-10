import "@/test/register"
import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TemplateEditorForm } from "./template-editor-form"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mock(),
    replace: mock(),
    back: mock(),
  }),
  useParams: () => ({ lang: "en", id: "tmpl-1" }),
}))
interface SavePayload {
  blueprintJson?: {
    runtime?: {
      healthCheckPath?: string
      livenessProbe?: { path: string }
      readinessProbe?: { path: string }
      startupProbe?: { path: string }
    }
  }
}

describe("TemplateEditorForm", () => {
  beforeEach(() => {
    cleanup()
  })

  it("renders 3 consolidated tabs for new template", () => {
    const onSave = mock(async () => {})
    const { getByText, queryByText } = render(
      <TemplateEditorForm isNew onSave={onSave} />
    )

    expect(getByText("General & Docs")).toBeTruthy()
    expect(getByText("Runtime & Services")).toBeTruthy()
    expect(getByText("Env Schema")).toBeTruthy()
    expect(queryByText("Installations")).toBeNull()
    expect(queryByText("5. Readme & Docs")).toBeNull()
    expect(queryByText("6. Installations")).toBeNull()
  })

  it("renders 4 consolidated tabs for existing template", () => {
    const onSave = mock(async () => {})
    const { getByText, queryByText } = render(
      <TemplateEditorForm
        isNew={false}
        initialData={{
          id: "tmpl-1",
          name: "9router",
          slug: "9router",
          tagline: "LLM Router",
          description: "Gateway router",
          readmeMarkdown: "# 9router",
          category: "AI",
          visibility: "PUBLIC",
          version: "1.0.0",
          isOfficial: true,
          isFeatured: false,
          currency: "USD",
          installCount: 10,
          reviewNotes: null,
          verifiedAt: null,
          priceMonthly: "0",
          blueprintJson: {
            version: "1.0.0",
            runtime: {
              image: "ghcr.io/decolua/9router:latest",
              defaultPort: 20128,
            },
            resources: {
              defaultCpu: 500,
              defaultMemory: 512,
            },
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }}
        onSave={onSave}
      />
    )

    expect(getByText("General & Docs")).toBeTruthy()
    expect(getByText("Runtime & Services")).toBeTruthy()
    expect(getByText("Env Schema")).toBeTruthy()
    expect(getByText("Installations")).toBeTruthy()
    expect(queryByText("5. Readme & Docs")).toBeNull()
    expect(queryByText("6. Installations")).toBeNull()
  })

  it("omits all probes from saved blueprint when liveness probe is empty", async () => {
    const onSave = mock(async (_payload: SavePayload) => {})
    const { getByTestId, getByText } = render(
      <TemplateEditorForm isNew={true} onSave={onSave} />
    )

    const user = userEvent.setup()
    const nameInput = getByTestId("template-name-input")
    const descInput = getByTestId("template-desc-input")

    await user.type(nameInput, "My Awesome App")
    await user.type(descInput, "Test description for blueprint")

    const saveBtn = getByText("Create Template")
    await user.click(saveBtn)

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    const payload = onSave.mock.calls[0]?.[0]
    expect(payload?.blueprintJson?.runtime?.healthCheckPath).toBeUndefined()
    expect(payload?.blueprintJson?.runtime?.livenessProbe).toBeUndefined()
    expect(payload?.blueprintJson?.runtime?.readinessProbe).toBeUndefined()
    expect(payload?.blueprintJson?.runtime?.startupProbe).toBeUndefined()
  })

  it("includes liveness and startup probes when liveness probe is filled", async () => {
    const onSave = mock(async (_payload: SavePayload) => {})
    const { getByTestId, getByText, getByLabelText } = render(
      <TemplateEditorForm isNew={true} onSave={onSave} />
    )

    const user = userEvent.setup()
    await user.type(getByTestId("template-name-input"), "Probe App")
    await user.type(getByTestId("template-desc-input"), "App with probes")

    // Switch to Runtime tab
    await user.click(getByText("Runtime & Services"))

    // Set liveness probe
    const healthInput = getByLabelText(/Liveness Probe Path/i)
    await user.type(healthInput, "/healthz")

    // Now Startup probe input appears
    const startupInput = getByLabelText(/Startup Probe Path/i)
    await user.type(startupInput, "/health/startup")

    // Save
    await user.click(getByText("Create Template"))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    const payload = onSave.mock.calls[0]?.[0]
    expect(payload?.blueprintJson?.runtime?.healthCheckPath).toBe("/healthz")
    expect(payload?.blueprintJson?.runtime?.livenessProbe?.path).toBe(
      "/healthz"
    )
    expect(payload?.blueprintJson?.runtime?.startupProbe?.path).toBe(
      "/health/startup"
    )
  })
})
