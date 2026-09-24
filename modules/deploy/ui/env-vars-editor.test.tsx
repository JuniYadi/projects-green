import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { __testables } from "@/modules/deploy/api/environment-variables.stub"
import type { EnvVar, SharedSecretOption } from "@/modules/deploy/deploy.types"
import { EnvVarsEditor } from "@/modules/deploy/ui/env-vars-editor"

const sharedSecretOptions: SharedSecretOption[] = [
  {
    id: "managed-postgres",
    label: "Managed PostgreSQL / production",
    serviceType: "POSTGRESQL",
    serviceCredentialId: "credential-postgres",
    vaultPath: "tenants/org-1/shared/managed-services/credential-postgres",
    vaultKey: "CONNECTION_STRING",
  },
]

describe("EnvVarsEditor", () => {
  beforeEach(() => {
    __testables.resetStore()
  })

  it("renders table columns and row actions", () => {
    const rows: EnvVar[] = [
      {
        id: "env-1",
        key: "APP_ENV",
        value: "staging",
        type: "plain",
        scope: "runtime",
        lastUpdatedAt: "2026-05-20T00:00:00.000Z",
      },
    ]

    const view = render(
      <EnvVarsEditor
        envVars={rows}
        environmentId="staging"
        onChange={() => {}}
      />
    )

    expect(view.getByText("Key")).toBeTruthy()
    expect(view.getByText("Value")).toBeTruthy()
    expect(view.getByText("Scope")).toBeTruthy()
    expect(view.getByText("Last updated")).toBeTruthy()
    expect(view.getByText("Actions")).toBeTruthy()
    expect(view.getByRole("button", { name: "Reveal" })).toBeTruthy()
    expect(view.getByRole("button", { name: "Edit" })).toBeTruthy()
    expect(view.getByRole("button", { name: "Delete" })).toBeTruthy()
    expect(view.getByRole("textbox", { name: "APP_ENV value" })).toHaveValue(
      "••••••••"
    )
  })

  it("requires confirmation before deleting and supports cancellation", async () => {
    const user = userEvent.setup()
    const changes: EnvVar[][] = []
    const view = render(
      <EnvVarsEditor
        envVars={[
          { id: "env-1", key: "APP_ENV", value: "staging", type: "plain" },
        ]}
        persistence="local"
        onChange={(rows) => changes.push(rows)}
      />
    )

    await user.click(view.getByRole("button", { name: "Delete" }))
    expect(view.getByRole("dialog")).toBeTruthy()
    expect(changes).toHaveLength(0)
    await user.click(view.getByRole("button", { name: "Cancel" }))
    expect(view.queryByRole("dialog")).toBeNull()
    expect(changes).toHaveLength(0)

    await user.click(view.getByRole("button", { name: "Delete" }))
    await user.click(
      within(view.getByRole("dialog")).getByRole("button", { name: "Delete" })
    )
    await waitFor(() => expect(changes.at(-1)).toHaveLength(0))
  })

  it("never enables secret copy before reveal and copies revealed value", async () => {
    const user = userEvent.setup()
    const writeText = mock(async () => {})
    const originalClipboard = navigator.clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    })
    const reveal = mock(async () => "top-secret")
    const view = render(
      <EnvVarsEditor
        envVars={[
          { id: "var-1", key: "APP_ENV", value: "", type: "secret_ref" },
          { id: "var-2", key: "TOKEN", value: "", type: "secret_ref" },
        ]}
        onChange={() => {}}
        onRevealSecret={reveal}
      />
    )

    const copyButtons = view.getAllByRole("button", { name: "Copy value" })
    expect(copyButtons[0]).toBeDisabled()
    expect(copyButtons[1]).toBeDisabled()
    await user.click(view.getAllByRole("button", { name: "Reveal" })[1])
    await waitFor(() =>
      expect(view.getByDisplayValue("top-secret")).toBeTruthy()
    )
    await user.click(view.getAllByRole("button", { name: "Copy value" })[1])
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("top-secret"))
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
    })
  })

  it("keeps long values inside a bounded input", () => {
    const view = render(
      <EnvVarsEditor
        envVars={[
          { id: "long", key: "LONG_VALUE", value: "", type: "secret_ref" },
        ]}
        onChange={() => {}}
      />
    )

    const input = view.getByRole("textbox", { name: "LONG_VALUE value" })
    expect(input.className).toContain("max-w-full")
  })

  it("masks all environment variables in vault-native mode", () => {
    const view = render(
      <EnvVarsEditor
        envVars={[
          {
            id: "legacy-plain",
            key: "APP_ENV",
            value: "production",
            type: "secret_ref",
            masked: true,
          },
        ]}
        onChange={() => {}}
      />
    )

    expect(view.getByDisplayValue("••••••••")).toBeTruthy()
  })

  it("creates a managed-service reference without storing a value", async () => {
    const user = userEvent.setup()
    const changes: EnvVar[][] = []
    const view = render(
      <EnvVarsEditor
        envVars={[]}
        onChange={(rows) => changes.push(rows)}
        sharedSecretOptions={sharedSecretOptions}
        persistence="local"
      />
    )

    await user.click(view.getByRole("button", { name: /add variable/i }))
    await user.type(
      view.getByRole("textbox", { name: "Variable key" }),
      "DB_URL"
    )
    await user.selectOptions(
      view.getByRole("combobox", { name: "Variable type" }),
      "secret_shared_ref"
    )
    await user.selectOptions(
      view.getByRole("combobox", { name: "Shared secret reference" }),
      "managed-postgres"
    )
    await user.click(view.getByRole("button", { name: "Save variable" }))

    const row = changes.at(-1)?.[0]
    expect(row).toMatchObject({
      key: "DB_URL",
      type: "secret_shared_ref",
      value: "",
      serviceCredentialId: "credential-postgres",
      vaultKey: "CONNECTION_STRING",
    })
  })

  it("sends the managed service credential id through the API adapter", async () => {
    const user = userEvent.setup()
    const changes: EnvVar[][] = []
    const view = render(
      <EnvVarsEditor
        envVars={[]}
        onChange={(rows) => changes.push(rows)}
        sharedSecretOptions={sharedSecretOptions}
      />
    )

    await user.click(view.getByRole("button", { name: /add variable/i }))
    await user.type(
      view.getByRole("textbox", { name: "Variable key" }),
      "DB_URL"
    )
    await user.selectOptions(
      view.getByRole("combobox", { name: "Variable type" }),
      "secret_shared_ref"
    )
    await user.selectOptions(
      view.getByRole("combobox", { name: "Shared secret reference" }),
      "managed-postgres"
    )
    await user.click(view.getByRole("button", { name: "Save variable" }))

    await waitFor(() => {
      expect(changes.at(-1)?.[0]?.serviceCredentialId).toBe(
        "credential-postgres"
      )
    })
  })

  it("preserves Vault metadata when editing without a rotation value", async () => {
    const user = userEvent.setup()
    const changes: EnvVar[][] = []
    const row: EnvVar = {
      id: "secret-1",
      key: "DATABASE_PASSWORD",
      value: "",
      type: "secret_ref",
      source: "vault",
      vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
      vaultKey: "DATABASE_PASSWORD",
      version: 3,
      lastUpdatedAt: "2026-05-20T00:00:00.000Z",
      isStoredSecret: true,
    }
    const view = render(
      <EnvVarsEditor
        envVars={[row]}
        onChange={(nextRows) => changes.push(nextRows)}
        persistence="local"
      />
    )

    await user.click(view.getByRole("button", { name: "Edit" }))
    await user.click(view.getByRole("button", { name: "Save changes" }))

    await waitFor(() => {
      expect(changes.at(-1)?.[0]).toMatchObject({
        source: "vault",
        vaultPath: row.vaultPath,
        vaultKey: row.vaultKey,
        version: 3,
        lastUpdatedAt: row.lastUpdatedAt,
      })
    })
  })
  it("preserves shared secret reference metadata when editing in local persistence mode", async () => {
    const user = userEvent.setup()
    const changes: EnvVar[][] = []
    const row: EnvVar = {
      id: "shared-1",
      key: "DATABASE_URL",
      value: "",
      type: "secret_shared_ref",
      source: "managed_service",
      serviceCredentialId: "credential-postgres",
      vaultPath: "tenants/org-1/shared/managed-services/credential-postgres",
      vaultKey: "CONNECTION_STRING",
      referenceLabel: "Managed PostgreSQL / production",
      lastUpdatedAt: "2026-05-20T00:00:00.000Z",
      isStoredSecret: true,
    }
    const view = render(
      <EnvVarsEditor
        envVars={[row]}
        onChange={(nextRows) => changes.push(nextRows)}
        persistence="local"
        sharedSecretOptions={[]}
      />
    )

    await user.click(view.getByRole("button", { name: "Edit" }))
    await user.click(view.getByRole("button", { name: "Save changes" }))

    await waitFor(() => {
      expect(changes.at(-1)?.[0]).toMatchObject({
        key: "DATABASE_URL",
        type: "secret_shared_ref",
        source: "managed_service",
        serviceCredentialId: "credential-postgres",
        vaultPath: "tenants/org-1/shared/managed-services/credential-postgres",
        vaultKey: "CONNECTION_STRING",
        referenceLabel: "Managed PostgreSQL / production",
        lastUpdatedAt: "2026-05-20T00:00:00.000Z",
      })
    })
  })

  it("previews imported secrets as masked and saves only the masked row", async () => {
    const user = userEvent.setup()
    const changes: EnvVar[][] = []
    const view = render(
      <EnvVarsEditor
        envVars={[]}
        environmentId="staging"
        onChange={(rows) => changes.push(rows)}
      />
    )

    await user.click(view.getByRole("button", { name: /import \.env/i }))
    await user.type(
      view.getByRole("textbox", { name: ".env payload" }),
      "APP_ENV=staging\nDATABASE_PASSWORD=top-secret"
    )

    expect(view.getAllByText("••••••••")).toHaveLength(2)
    expect(view.getAllByText("Secret")).toHaveLength(2)
    expect(view.queryByText("top-secret")).toBeNull()

    await user.click(view.getByRole("button", { name: "Import variables" }))

    await waitFor(() => {
      expect(changes.at(-1)).toHaveLength(2)
    })
    expect(changes.at(-1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "DATABASE_PASSWORD",
          type: "secret_ref",
          value: "",
        }),
      ])
    )
  })

  it("reveals a Vault secret through the supplied audited callback", async () => {
    const user = userEvent.setup()
    const reveal = mock(async () => "revealed-value")
    const view = render(
      <EnvVarsEditor
        envVars={[
          {
            id: "secret-1",
            key: "DATABASE_PASSWORD",
            value: "",
            type: "secret_ref",
            isStoredSecret: true,
          },
        ]}
        onChange={() => {}}
        onRevealSecret={reveal}
      />
    )

    expect(view.getByDisplayValue("••••••••")).toBeTruthy()
    await user.click(view.getByRole("button", { name: "Reveal" }))

    await waitFor(() => {
      expect(reveal).toHaveBeenCalledTimes(1)
      expect(view.getByDisplayValue("revealed-value")).toBeTruthy()
    })

    await user.click(view.getByRole("button", { name: "Hide" }))
    expect(view.getByDisplayValue("••••••••")).toBeTruthy()
  })

  it("shows a placeholder when an empty secret is revealed", async () => {
    const user = userEvent.setup()
    const reveal = mock(async () => "")
    const view = render(
      <EnvVarsEditor
        envVars={[
          {
            id: "secret-empty",
            key: "EMPTY_VAR",
            value: "",
            type: "secret_ref",
          },
        ]}
        onChange={() => {}}
        onRevealSecret={reveal}
      />
    )

    await user.click(view.getByRole("button", { name: "Reveal" }))
    const input = view.getByRole("textbox", { name: "EMPTY_VAR value" })
    expect(input).toHaveAttribute("placeholder", "<empty value>")
  })

  it("does not display an empty Vault reveal as a successful value", async () => {
    const user = userEvent.setup()
    const reveal = mock(async () => "")
    const view = render(
      <EnvVarsEditor
        envVars={[
          {
            id: "secret-empty",
            key: "EMPTY_SECRET",
            value: "",
            type: "secret_ref",
            isStoredSecret: true,
          },
        ]}
        onChange={() => {}}
        onRevealSecret={reveal}
      />
    )

    await user.click(view.getByRole("button", { name: "Reveal" }))

    await waitFor(() => {
      expect(
        view.getAllByText(/Vault returned an empty secret\./).length
      ).toBeGreaterThan(0)
    })
    expect(view.getByDisplayValue("••••••••")).toBeTruthy()
    expect(view.queryByText("<empty value>")).toBeNull()
  })

  it("blocks duplicate keys before saving", async () => {
    const user = userEvent.setup()
    const view = render(
      <EnvVarsEditor
        envVars={[
          {
            id: "env-1",
            key: "APP_ENV",
            value: "staging",
            type: "plain",
          },
        ]}
        environmentId="staging"
        onChange={() => {}}
        persistence="local"
      />
    )

    await user.click(view.getByRole("button", { name: /add variable/i }))
    await user.type(
      view.getByRole("textbox", { name: "Variable key" }),
      "app_env"
    )
    await user.type(view.getByLabelText("Variable value"), "production")
    await user.click(view.getByRole("button", { name: "Save variable" }))

    expect(view.getByRole("alert")).toHaveTextContent(
      "Variable APP_ENV already exists in staging."
    )
  })

  it("updates existing keys during a stack-scoped .env import", async () => {
    const user = userEvent.setup()
    const changes: EnvVar[][] = []
    const fetchMock = mock(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            references: [
              {
                key: "DATABASE_PASSWORD",
                type: "secret_ref",
                vaultPath: "stacks/stack-1/prod/app-env",
                vaultKey: "DATABASE_PASSWORD",
                version: 2,
                updatedAt: "2026-09-22T00:00:00.000Z",
              },
            ],
          },
        }),
        { headers: { "content-type": "application/json" } }
      )
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const view = render(
        <EnvVarsEditor
          envVars={[
            {
              id: "secret-1",
              key: "DATABASE_PASSWORD",
              value: "",
              type: "secret_ref",
              isStoredSecret: true,
            },
          ]}
          environmentId="prod"
          onChange={(rows) => changes.push(rows)}
          persistence="local"
          stackId="stack-1"
        />
      )

      await user.click(view.getByRole("button", { name: /import \.env/i }))
      await user.type(
        view.getByRole("textbox", { name: ".env payload" }),
        "DATABASE_PASSWORD=next-secret"
      )
      await user.click(view.getByRole("button", { name: "Import variables" }))

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      expect(changes.at(-1)).toEqual([
        expect.objectContaining({
          id: "secret-1",
          key: "DATABASE_PASSWORD",
          type: "secret_ref",
          version: 2,
        }),
      ])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
