import { afterEach, describe, expect, it, mock } from "bun:test"
import { render, fireEvent, cleanup } from "@testing-library/react"

import { RuntimeQuickTuningCard } from "./runtime-quick-tuning-card"

describe("RuntimeQuickTuningCard", () => {
  afterEach(cleanup)
  it("renders Laravel tunables with default presets", () => {
    const view = render(
      <RuntimeQuickTuningCard
        framework="laravel"
        envVars={[
          { key: "PHP_UPLOAD_MAX_FILESIZE", value: "64M" },
          { key: "PHP_MEMORY_LIMIT", value: "256M" },
          { key: "CONTAINER_ROLE", value: "app" },
        ]}
      />
    )

    expect(view.getByText("Runtime Quick Tuning")).toBeTruthy()
    expect(view.getByText("LARAVEL")).toBeTruthy()
    expect(view.getByText("Max Upload Size (PHP_UPLOAD_MAX_FILESIZE)")).toBeTruthy()
    expect(view.getByText("Script Memory Limit (PHP_MEMORY_LIMIT)")).toBeTruthy()
    expect(view.getByText("Workload Role (CONTAINER_ROLE)")).toBeTruthy()
    expect(view.getByText("Web App")).toBeTruthy()
    expect(view.getByText("Queue Worker")).toBeTruthy()
    expect(view.getByText("Horizon")).toBeTruthy()
    expect(view.getByText("Scheduler")).toBeTruthy()
  })

  it("triggers upload change when clicking a preset badge", () => {
    const onApplyBatch = mock(() => {})
    const onApplyEnvVar = mock(() => {})

    const view = render(
      <RuntimeQuickTuningCard
        framework="laravel"
        envVars={[]}
        onApplyBatch={onApplyBatch}
        onApplyEnvVar={onApplyEnvVar}
      />
    )

    const preset100M = view.getByRole("button", { name: "Upload preset 100M" })
    fireEvent.click(preset100M)

    expect(onApplyBatch).toHaveBeenCalledWith({
      PHP_UPLOAD_MAX_FILESIZE: "100M",
      PHP_POST_MAX_SIZE: "100M",
    })
  })

  it("triggers memory limit change when clicking a memory preset badge", () => {
    const onApplyEnvVar = mock(() => {})

    const view = render(
      <RuntimeQuickTuningCard
        framework="laravel"
        envVars={[]}
        onApplyEnvVar={onApplyEnvVar}
      />
    )

    const preset512M = view.getByRole("button", { name: "Memory preset 512M" })
    fireEvent.click(preset512M)

    expect(onApplyEnvVar).toHaveBeenCalledWith("PHP_MEMORY_LIMIT", "512M")
  })

  it("triggers container role change when selecting a role", () => {
    const onApplyEnvVar = mock(() => {})

    const view = render(
      <RuntimeQuickTuningCard
        framework="laravel"
        envVars={[]}
        onApplyEnvVar={onApplyEnvVar}
      />
    )

    const workerButton = view.getByText("Queue Worker").closest("button")
    expect(workerButton).toBeTruthy()
    fireEvent.click(workerButton!)

    expect(onApplyEnvVar).toHaveBeenCalledWith("CONTAINER_ROLE", "worker")
  })

  it("renders non-laravel runtime summary for Next.js", () => {
    const view = render(
      <RuntimeQuickTuningCard
        framework="nextjs"
        envVars={[{ key: "PORT", value: "8080" }]}
      />
    )

    expect(view.getByText("NEXTJS")).toBeTruthy()
    expect(view.getByText("Container Port (PORT)")).toBeTruthy()
    expect(view.getByText("Environment Mode (NODE_ENV)")).toBeTruthy()
  })

  it("renders Bun runtime summary for Bun", () => {
    const view = render(
      <RuntimeQuickTuningCard
        framework="bun"
        envVars={[{ key: "PORT", value: "8080" }]}
      />
    )

    expect(view.getByText("BUN")).toBeTruthy()
    expect(view.getByText("Environment Mode (BUN_ENV)")).toBeTruthy()
  })

  it("does not trigger changes when readOnly is true", () => {
    const onApplyEnvVar = mock(() => {})
    const onApplyBatch = mock(() => {})

    const view = render(
      <RuntimeQuickTuningCard
        framework="laravel"
        envVars={[]}
        readOnly={true}
        onApplyEnvVar={onApplyEnvVar}
        onApplyBatch={onApplyBatch}
      />
    )

    const preset100M = view.getByRole("button", { name: "Upload preset 100M" })
    fireEvent.click(preset100M)

    expect(onApplyBatch).not.toHaveBeenCalled()
    expect(onApplyEnvVar).not.toHaveBeenCalled()
  })
})
