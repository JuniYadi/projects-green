import "@/test/register"
import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TemplateEditorForm } from "./template-editor-form"
import { OFFICIAL_APP_TEMPLATES } from "../app-template.seed"

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
  iconUrl?: string | null
  blueprintJson?: {
    access?: { title: string; steps: Array<{ text: string }> }
    runtime?: {
      command?: string[]
      args?: string[]
      healthCheckPath?: string
      livenessProbe?: { path: string }
      readinessProbe?: { path: string }
      startupProbe?: { path: string }
      runAsNonRoot?: boolean
      runAsUser?: number | null
      runAsGroup?: number | null
      fsGroup?: number | null
      readOnlyRootFilesystem?: boolean
    }
  }
}

describe("TemplateEditorForm", () => {
  beforeEach(() => {
    cleanup()
  })

  it("preserves the 9router access contract when saving other template fields", async () => {
    const onSave = mock(async (_payload: SavePayload) => {})
    const template = OFFICIAL_APP_TEMPLATES.find(
      (item) => item.slug === "9router"
    )!
    const { getByText } = render(
      <TemplateEditorForm
        isNew={false}
        onSave={onSave}
        initialData={{
          id: "tmpl-1",
          name: template.name,
          slug: template.slug,
          tagline: template.tagline,
          description: template.description,
          category: template.category,
          visibility: template.visibility,
          version: template.version,
          isOfficial: true,
          isFeatured: true,
          currency: "USD",
          installCount: 0,
          reviewNotes: null,
          verifiedAt: null,
          priceMonthly: "0",
          blueprintJson: template.blueprint,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }}
      />
    )
    await userEvent.setup().click(getByText("Save Changes"))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const payload = onSave.mock.calls[0]?.[0]
    expect(payload?.blueprintJson?.access?.title).toBe(
      "Mulai menggunakan 9router"
    )
    expect(payload?.blueprintJson?.access?.steps).toHaveLength(3)
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

  it("preserves and saves container command and args when provided", async () => {
    const onSave = mock(async (_payload: SavePayload) => {})
    const { getByTestId, getByText, getByLabelText } = render(
      <TemplateEditorForm isNew={true} onSave={onSave} />
    )

    const user = userEvent.setup()
    await user.type(getByTestId("template-name-input"), "Hermes App")
    await user.type(getByTestId("template-desc-input"), "Hermes AI gateway")

    // Switch to Runtime tab
    await user.click(getByText("Runtime & Services"))

    // Enter container command and arguments
    const cmdInput = getByLabelText(/Container Command/i)
    await user.type(cmdInput, "hermes gateway run")

    const argsInput = getByLabelText(/Container Arguments/i)
    await user.type(argsInput, "--verbose")

    // Save
    await user.click(getByText("Create Template"))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    const payload = onSave.mock.calls[0]?.[0]
    expect(payload?.blueprintJson?.runtime?.command).toEqual([
      "hermes",
      "gateway",
      "run",
    ])
    expect(payload?.blueprintJson?.runtime?.args).toEqual(["--verbose"])
  })

  it("renders More Actions dropdown and Sync from Runtime Manifest button", async () => {
    const onSave = mock(async () => {})
    const { getByText } = render(
      <TemplateEditorForm
        isNew={false}
        initialData={{
          id: "tmpl-hermes",
          name: "Hermes Agent",
          slug: "hermes",
          tagline: "Autonomous AI agent gateway",
          description: "Gateway router",
          readmeMarkdown: "# Hermes",
          category: "AI",
          visibility: "PUBLIC",
          version: "1.0.0",
          isOfficial: true,
          isFeatured: true,
          currency: "USD",
          installCount: 10,
          reviewNotes: null,
          verifiedAt: null,
          priceMonthly: "0",
          blueprintJson: {
            version: "1.0.0",
            runtime: {
              image: "ghcr.io/pfnapp/hermes-agent:v2026.9.14",
              defaultPort: 8642,
            },
            resources: {
              defaultCpu: 500,
              defaultMemory: 512,
            },
            envSchema: [],
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }}
        onSave={onSave}
      />
    )

    expect(getByText("More Actions")).toBeTruthy()
    expect(getByText("Save Changes")).toBeTruthy()

    // Switch to Env Schema tab
    await userEvent.click(getByText("Env Schema"))
    expect(getByText("Sync from Runtime Manifest")).toBeTruthy()
  })

  it("syncs environment variables from runtime manifest on button click", async () => {
    const origFetch = global.fetch
    global.fetch = mock(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              framework: "Hermes",
              tunables: [
                {
                  key: "HERMES_SYNCED_KEY",
                  label: "Hermes Key",
                  type: "string",
                  default: "test-value",
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    ) as unknown as typeof fetch

    try {
      const onSave = mock(async () => {})
      const { getByText, findByDisplayValue } = render(
        <TemplateEditorForm
          isNew={false}
          initialData={{
            id: "tmpl-hermes",
            name: "Hermes Agent",
            slug: "hermes",
            tagline: "Autonomous AI agent gateway",
            description: "Gateway router",
            readmeMarkdown: "# Hermes",
            category: "AI",
            visibility: "PUBLIC",
            version: "1.0.0",
            isOfficial: true,
            isFeatured: true,
            currency: "USD",
            installCount: 10,
            reviewNotes: null,
            verifiedAt: null,
            priceMonthly: "0",
            blueprintJson: {
              version: "1.0.0",
              runtime: {
                image: "ghcr.io/pfnapp/hermes-agent:v2026.9.14",
                defaultPort: 8642,
              },
              resources: {
                defaultCpu: 500,
                defaultMemory: 512,
              },
              envSchema: [],
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          onSave={onSave}
        />
      )

      await userEvent.click(getByText("Env Schema"))
      const syncBtn = getByText("Sync from Runtime Manifest")
      await userEvent.click(syncBtn)

      expect(await findByDisplayValue("HERMES_SYNCED_KEY")).toBeTruthy()
    } finally {
      global.fetch = origFetch
    }
  })

  it("configures and saves root execution securityContext with runAsNonRoot: false and null UID/GID", async () => {
    const onSave = mock(async (_payload: SavePayload) => {})
    const { getByTestId, getByText, getByLabelText } = render(
      <TemplateEditorForm isNew={true} onSave={onSave} />
    )

    const user = userEvent.setup()
    await user.type(getByTestId("template-name-input"), "Docker Root App")
    await user.type(
      getByTestId("template-desc-input"),
      "Requires root execution"
    )

    // Switch to Runtime tab
    await user.click(getByText("Runtime & Services"))

    // Toggle runAsNonRoot switch to false
    const nonRootSwitch = getByLabelText(/Run as Non-Root/i)
    await user.click(nonRootSwitch)

    // Save template
    await user.click(getByText("Create Template"))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    const payload = onSave.mock.calls[0]?.[0]
    expect(payload?.blueprintJson?.runtime?.runAsNonRoot).toBe(false)
    expect(payload?.blueprintJson?.runtime?.runAsUser).toBeNull()
    expect(payload?.blueprintJson?.runtime?.runAsGroup).toBeNull()
  })

  it("allows auto-input and overwriting UID/GID in security context", async () => {
    const onSave = mock(async (_payload: SavePayload) => {})
    const { getByTestId, getByText, getByLabelText } = render(
      <TemplateEditorForm isNew={true} onSave={onSave} />
    )

    const user = userEvent.setup()
    await user.type(getByTestId("template-name-input"), "Custom UID App")
    await user.type(
      getByTestId("template-desc-input"),
      "App with custom UID/GID"
    )

    // Switch to Runtime tab
    await user.click(getByText("Runtime & Services"))

    // Enter custom UID and GID (overwriting default empty values)
    const uidInput = getByLabelText(/Run As User \(UID\)/i)
    await user.type(uidInput, "1000")

    const gidInput = getByLabelText(/Run As Group \(GID\)/i)
    await user.type(gidInput, "2000")

    // Save template
    await user.click(getByText("Create Template"))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    const payload = onSave.mock.calls[0]?.[0]
    expect(payload?.blueprintJson?.runtime?.runAsNonRoot).toBe(true)
    expect(payload?.blueprintJson?.runtime?.runAsUser).toBe(1000)
    expect(payload?.blueprintJson?.runtime?.runAsGroup).toBe(2000)
  })

  it("switches activePreset to custom when readOnlyRootFilesystem or fsGroup is configured", async () => {
    const onSave = mock(async (_payload: SavePayload) => {})
    const {
      getByTestId,
      getByText,
      getAllByText,
      getByLabelText,
      queryByText,
    } = render(<TemplateEditorForm isNew={true} onSave={onSave} />)

    const user = userEvent.setup()
    await user.type(getByTestId("template-name-input"), "Sec Dev App")
    await user.type(
      getByTestId("template-desc-input"),
      "App testing custom presets"
    )

    // Switch to Runtime tab
    await user.click(getByText("Runtime & Services"))

    // Initially with image_default_non_root (runAsNonRoot: true, empty UID/GID), badge indicates Auto
    expect(getByText("Auto")).toBeTruthy()

    // Toggle Read-Only Root Filesystem
    const readOnlySwitch = getByLabelText(/Read-Only Root Filesystem/i)
    await user.click(readOnlySwitch)

    // Now preset indicator switches to Custom Configuration
    expect(queryByText("Auto")).toBeNull()
    expect(getAllByText("Custom Configuration").length).toBeGreaterThan(0)

    // Enter fsGroup
    const fsGroupInput = getByLabelText(/Storage FSGroup/i)
    await user.type(fsGroupInput, "3000")
    expect(getAllByText("Custom Configuration").length).toBeGreaterThan(0)

    // Save and assert payload has both values
    await user.click(getByText("Create Template"))
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    const payload = onSave.mock.calls[0]?.[0]
    expect(payload?.blueprintJson?.runtime?.readOnlyRootFilesystem).toBe(true)
    expect(payload?.blueprintJson?.runtime?.fsGroup).toBe(3000)
  })

  it("renders local icon preset selector and saves chosen iconUrl", async () => {
    const onSave = mock(async (_payload: SavePayload) => {})
    const template = OFFICIAL_APP_TEMPLATES.find(
      (item) => item.slug === "hermes"
    )!
    const { getByText, getByDisplayValue } = render(
      <TemplateEditorForm
        isNew={false}
        onSave={onSave}
        initialData={{
          id: "tmpl-hermes",
          name: template.name,
          slug: template.slug,
          tagline: template.tagline,
          description: template.description,
          iconUrl: "/app-hosting/icons/hermes.svg",
          category: template.category,
          visibility: template.visibility,
          version: template.version,
          isOfficial: true,
          isFeatured: true,
          currency: "USD",
          installCount: 0,
          reviewNotes: null,
          verifiedAt: null,
          priceMonthly: "0",
          blueprintJson: template.blueprint,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }}
      />
    )

    // Verify initial iconUrl is rendered in input
    const iconInput = getByDisplayValue("/app-hosting/icons/hermes.svg")
    expect(iconInput).toBeTruthy()

    await userEvent.setup().click(getByText("Save Changes"))
    await waitFor(() => expect(onSave).toHaveBeenCalled())

    const calls = onSave.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const payload = calls[0]?.[0]
    expect(payload?.iconUrl).toBe("/app-hosting/icons/hermes.svg")
  })
})
