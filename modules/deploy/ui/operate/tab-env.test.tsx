import { afterEach, describe, expect, it, mock } from "bun:test"
import { render, fireEvent, cleanup } from "@testing-library/react"

import type { EnvVar, K8sEnvironmentId } from "../../operate.types"
import { TabEnv } from "./tab-env"

describe("TabEnv with RuntimeQuickTuningCard", () => {
  afterEach(cleanup)

  it("renders RuntimeQuickTuningCard and EnvVarsEditor", () => {
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

    expect(view.getByText("Runtime Quick Tuning")).toBeTruthy()
    expect(view.getByText("Environment Variables")).toBeTruthy()
    expect(view.getByText("Max Upload Size (PHP_UPLOAD_MAX_FILESIZE)")).toBeTruthy()
  })

  it("updates environment variables and persists when quick tuning preset is clicked", () => {
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

    const preset100M = view.getByRole("button", { name: "Upload preset 100M" })
    fireEvent.click(preset100M)

    expect(setEnvVars).toHaveBeenCalled()
    expect(onPersist).toHaveBeenCalled()
  })
})
