import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"

import MonitoringPage from "@/app/[lang]/console/app/monitoring/page"

mock.module("next/navigation", () => {
  return {
    usePathname: () => "/console/app/monitoring",
  }
})

describe("MonitoringPage", () => {
  it("renders monitoring shell and runtime telemetry content", () => {
    const view = render(<MonitoringPage />)

    expect(view.getAllByText("Monitoring").length).toBeGreaterThan(0)
    expect(view.getByText("Monitoring Overview")).toBeTruthy()
    expect(view.getByText("Rollout Events")).toBeTruthy()
    expect(view.queryByText("Deploy Application")).toBeNull()
  })
})
