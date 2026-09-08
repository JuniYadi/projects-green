import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { TabScaling, parseCpuToCores, parseMemoryToMiB } from "./tab-scaling"

describe("TabScaling", () => {
  afterEach(() => {
    cleanup()
  })
  it("parses CPU and memory strings correctly", () => {
    expect(parseCpuToCores("500m")).toBe(0.5)
    expect(parseCpuToCores("1000m")).toBe(1.0)
    expect(parseCpuToCores("2000m")).toBe(2.0)
    expect(parseCpuToCores("4")).toBe(4)

    expect(parseMemoryToMiB("256Mi")).toBe(256)
    expect(parseMemoryToMiB("512Mi")).toBe(512)
    expect(parseMemoryToMiB("1024Mi")).toBe(1024)
    expect(parseMemoryToMiB("1Gi")).toBe(1024)
    expect(parseMemoryToMiB("4GiB")).toBe(4096)
  })

  it("verifies table legibility and absence of hardcoded text-white/border-white tokens", () => {
    const setReplicas = mock(() => {})
    const { container } = render(
      <TabScaling replicas={2} setReplicas={setReplicas} />
    )

    // Ensure no hardcoded text-white/80, border-white, or #0A0A0C
    expect(container.innerHTML).not.toContain("text-white/80")
    expect(container.innerHTML).not.toContain("border-white")
    expect(container.innerHTML).not.toContain("dark:bg-[#0A0A0C]")
    expect(container.innerHTML).not.toContain("bg-[#0A0A0C]")

    // Check table semantic classes
    const podNameCell = container.querySelector("tbody tr td")
    expect(podNameCell?.className).toContain("text-foreground")
  })

  it("calculates total resource footprint based on replicas and limits", () => {
    const setReplicas = mock(() => {})
    const { getByText } = render(
      <TabScaling replicas={2} setReplicas={setReplicas} />
    )

    // 2 replicas * 1000m = 2.0 / 4.0 Cores
    expect(getByText("2.0 / 4.0 Cores")).toBeDefined()
    // 2 replicas * 512Mi = 1024 MiB / 4096 MiB
    expect(getByText("1024 MiB / 4096 MiB")).toBeDefined()
  })

  it("disables + button and shows notice when replicas reach maxAllowedReplicas", () => {
    const setReplicas = mock(() => {})
    const { getByRole, getByText } = render(
      <TabScaling
        replicas={3}
        setReplicas={setReplicas}
        maxAllowedReplicas={3}
      />
    )

    const plusBtn = getByRole("button", { name: "Increase replicas" })
    expect(plusBtn.hasAttribute("disabled")).toBe(true)

    expect(
      getByText("Maximum resource quota reached for this plan.")
    ).toBeDefined()
  })

  it("disables + button when next replica would exceed CPU quota", () => {
    const setReplicas = mock(() => {})
    // 4 replicas * 1.0 core = 4.0 cores (maxCpuQuota is 4000m = 4.0 cores)
    // 5 replicas would be 5.0 > 4.0
    const { getByRole, getByText } = render(
      <TabScaling
        replicas={4}
        setReplicas={setReplicas}
        maxAllowedReplicas={8}
        maxCpuQuota="4000m"
      />
    )

    const plusBtn = getByRole("button", { name: "Increase replicas" })
    expect(plusBtn.hasAttribute("disabled")).toBe(true)

    expect(
      getByText("Maximum resource quota reached for this plan.")
    ).toBeDefined()
  })

  it("disables + button when next replica would exceed Memory quota", () => {
    const setReplicas = mock(() => {})
    // maxMemoryQuota is 1024Mi, 2 replicas * 512Mi = 1024Mi
    // 3 replicas would be 1536Mi > 1024Mi
    const { getByRole, getByText } = render(
      <TabScaling
        replicas={2}
        setReplicas={setReplicas}
        maxAllowedReplicas={8}
        maxMemoryQuota="1024Mi"
      />
    )

    const plusBtn = getByRole("button", { name: "Increase replicas" })
    expect(plusBtn.hasAttribute("disabled")).toBe(true)

    expect(
      getByText("Maximum resource quota reached for this plan.")
    ).toBeDefined()
  })

  it("caps HPA max replicas against CPU quota ceiling and displays notice", () => {
    const setReplicas = mock(() => {})
    const { getByText, getByRole } = render(
      <TabScaling
        replicas={2}
        setReplicas={setReplicas}
        maxAllowedReplicas={8}
        maxCpuQuota="4000m"
      />
    )

    // Toggle HPA
    const hpaToggle = getByRole("button", {
      name: /Toggle Horizontal Pod Autoscaler/i,
    })
    fireEvent.click(hpaToggle)
    expect(
      getByText(
        "HPA max replicas capped at 4 based on CPU limits and plan quota."
      )
    ).toBeDefined()

    // Manual replicas buttons should be disabled when HPA is active
    const plusBtn = getByRole("button", { name: "Increase replicas" })
    expect(plusBtn.hasAttribute("disabled")).toBe(true)

    expect(
      getByText(
        "Manual replicas are locked because Horizontal Pod Autoscaler (HPA) is currently active."
      )
    ).toBeDefined()
  })
})
