import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"
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
    expect(view.getByText("Type")).toBeTruthy()
    expect(view.getByText("Scope")).toBeTruthy()
    expect(view.getByText("Last updated")).toBeTruthy()
    expect(view.getByText("Actions")).toBeTruthy()
    expect(view.getByRole("button", { name: "Show" })).toBeTruthy()
    expect(view.getByRole("button", { name: "Edit" })).toBeTruthy()
    expect(view.getByRole("button", { name: "Delete" })).toBeTruthy()
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

    expect(view.getByText("••••••••")).toBeTruthy()
    expect(view.getByText("Secret (Vault)")).toBeTruthy()
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

    expect(view.getByText("••••••••")).toBeTruthy()
    await user.click(view.getByRole("button", { name: "Reveal" }))

    await waitFor(() => {
      expect(reveal).toHaveBeenCalledTimes(1)
      expect(view.getByText("revealed-value")).toBeTruthy()
    })

    await user.click(view.getByRole("button", { name: "Hide" }))
    expect(view.getByText("••••••••")).toBeTruthy()
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
    await user.type(
      view.getByRole("textbox", { name: "Variable value" }),
      "production"
    )
    await user.click(view.getByRole("button", { name: "Save variable" }))

    expect(view.getByRole("alert")).toHaveTextContent(
      "Variable APP_ENV already exists in staging."
    )
  })

  it("blocks duplicate imports before writing stack-scoped Vault secrets", async () => {
    const user = userEvent.setup()
    const fetchMock = mock(async () => {
      return new Response(
        JSON.stringify({ ok: true, data: { references: [] } }),
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
          onChange={() => {}}
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

      expect(view.getByRole("alert")).toHaveTextContent(
        "Import contains duplicate keys: DATABASE_PASSWORD."
      )
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
