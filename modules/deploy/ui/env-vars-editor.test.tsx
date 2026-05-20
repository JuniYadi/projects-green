import { beforeEach, describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { __testables } from "@/modules/deploy/api/environment-variables.stub"
import type { EnvVar } from "@/modules/deploy/deploy.types"
import { EnvVarsEditor } from "@/modules/deploy/ui/env-vars-editor"

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
})
