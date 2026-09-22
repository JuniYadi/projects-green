import { afterEach, describe, expect, it, mock } from "bun:test"
import { render, cleanup } from "@testing-library/react"

import type { EnvVar, K8sEnvironmentId } from "../../operate.types"
import { TabEnv } from "./tab-env"

describe("TabEnv", () => {
  afterEach(cleanup)

  it("renders only the environment variables editor", () => {
    const envVars: Record<K8sEnvironmentId, EnvVar[]> = {
      prod: [
        {
          id: "env-1",
          key: "PHP_UPLOAD_MAX_FILESIZE",
          value: "64M",
          isSecret: false,
          updatedAt: "2026-09-19T00:00:00.000Z",
        },
      ],
      staging: [],
      dev: [],
    }

    const setEnvVars = mock(() => {})
    const onPersist = mock(async () => {})

    const view = render(
      <TabEnv
        selectedEnv="prod"
        envVars={envVars}
        setEnvVars={setEnvVars}
        onPersist={onPersist}
        framework="laravel"
      />
    )

    expect(view.queryByText("Runtime Quick Tuning")).toBeNull()
    expect(view.getByText("Environment Variables")).toBeTruthy()
    expect(view.getByRole("textbox", { name: "PHP_UPLOAD_MAX_FILESIZE value" })).toBeTruthy()
})
})
