import { afterEach, describe, expect, it } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

import { TabMounts } from "@/modules/deploy/ui/operate/tab-mounts"
import type {
  K8sEnvironmentId,
  VolumeMount,
} from "@/modules/deploy/operate.types"

function TestHarness({
  initialMounts = [],
}: {
  initialMounts?: VolumeMount[]
}) {
  const [mounts, setMounts] = useState<Record<K8sEnvironmentId, VolumeMount[]>>(
    {
      dev: initialMounts,
      staging: [],
      prod: [],
    }
  )

  return <TabMounts selectedEnv="dev" mounts={mounts} setMounts={setMounts} />
}

describe("TabMounts", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders generic form labels, placeholders, and descriptions", () => {
    const view = render(<TestHarness />)

    expect(view.getByText("File Mounts & Configurations")).toBeDefined()
    expect(
      view.getByText(
        "Mount configuration files, certificates, or secrets securely into container paths"
      )
    ).toBeDefined()
    expect(view.getByText("File Content / Configuration Data")).toBeDefined()
    expect(
      view.getByText("No volume or configuration files mounted.")
    ).toBeDefined()
    expect(view.getByText("In-Container File Mounting Mechanics")).toBeDefined()

    const nameInput = view.getByPlaceholderText(
      "e.g. app-config or application-key"
    )
    expect(nameInput).toBeDefined()

    const pathInput = view.getByPlaceholderText(
      "e.g. /etc/app/config.yaml or /var/secrets/key.pem"
    )
    expect(pathInput).toBeDefined()

    const textarea = view.getByPlaceholderText(/# Configuration data/)
    expect(textarea).toBeDefined()
    expect(textarea.getAttribute("placeholder")).toBe(
      "# Configuration data (YAML, JSON, text, or PEM secret)\nPORT: 3000\nLOG_LEVEL: info"
    )
  })

  it("adds a generic file mount and displays it in the active list", async () => {
    const user = userEvent.setup()
    const view = render(<TestHarness />)

    const nameInput = view.getByPlaceholderText(
      "e.g. app-config or application-key"
    )
    const pathInput = view.getByPlaceholderText(
      "e.g. /etc/app/config.yaml or /var/secrets/key.pem"
    )
    const textarea = view.getByPlaceholderText(/# Configuration data/)

    await user.type(nameInput, "app-config")
    await user.type(pathInput, "/etc/app/config.yaml")
    await user.type(textarea, "PORT: 3000\nLOG_LEVEL: info")

    const submitBtn = view.getByRole("button", { name: "Create File Mount" })
    await user.click(submitBtn)

    expect(view.getByText("/etc/app/config.yaml")).toBeDefined()
    expect(view.getByText(/type=yaml/)).toBeDefined()
  })

  it("deletes a mount from the active list", async () => {
    const user = userEvent.setup()
    const existingMount: VolumeMount = {
      id: "mnt-test-1",
      name: "app-config",
      mountPath: "/etc/app/config.yaml",
      sourceType: "secret",
      fileMode: "0400",
      readOnly: true,
      contentSummary: "[REDACTED] type=yaml bytes=24 fingerprint=abc123",
    }

    const view = render(<TestHarness initialMounts={[existingMount]} />)

    expect(view.getByText("/etc/app/config.yaml")).toBeDefined()

    const deleteBtn = view.getByRole("button", { name: "" })
    await user.click(deleteBtn)

    expect(view.queryByText("/etc/app/config.yaml")).toBeNull()
    expect(
      view.getByText("No volume or configuration files mounted.")
    ).toBeDefined()
  })

  it("has complete absence of bg-black, text-white, and border-white classes", () => {
    const existingMount: VolumeMount = {
      id: "mnt-theme-check",
      name: "app-config",
      mountPath: "/etc/app/config.yaml",
      sourceType: "secret",
      fileMode: "0400",
      readOnly: true,
      contentSummary: "[REDACTED] type=yaml bytes=24 fingerprint=abc123",
    }

    const { container } = render(
      <TestHarness initialMounts={[existingMount]} />
    )

    const prohibitedPattern = /(bg-black|text-white|border-white)/
    const offendingElements = Array.from(container.querySelectorAll("*"))
      .filter((el) => {
        const className = el.getAttribute("class") ?? ""
        return prohibitedPattern.test(className)
      })
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        className: el.getAttribute("class"),
      }))

    expect(offendingElements).toEqual([])
  })
})
