import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"

import { TrafficFlowCanvas } from "./traffic-flow-canvas"

describe("TrafficFlowCanvas", () => {
  const defaultProps = {
    diagnosticMode: "healthy",
    replicas: 2,
    cloudflareEnabled: true,
    dbConnected: true,
    setCloudflareEnabled: mock(() => {}),
    setDbConnected: mock(() => {}),
    domains: [
      {
        id: "dom-1",
        domain: "laravel-shop.com",
        isPrimary: true,
        tlsStatus: "active" as const,
        dnsStatus: "verified" as const,
        expiresAt: "2026-08-01",
      },
      {
        id: "dom-2",
        domain: "www.laravel-shop.com",
        isPrimary: false,
        tlsStatus: "active" as const,
        dnsStatus: "verified" as const,
        expiresAt: "2026-08-01",
      },
    ],
  }

  beforeEach(() => {
    defaultProps.setCloudflareEnabled.mockClear()
    defaultProps.setDbConnected.mockClear()
  })

  it("renders the canvas nodes and title", () => {
    const view = render(<TrafficFlowCanvas {...defaultProps} />)

    expect(view.getByText("Cluster Traffic Routing Canvas")).toBeInTheDocument()
    expect(view.getByText("Internet")).toBeInTheDocument()
    expect(view.getByText("Cloudflare")).toBeInTheDocument()
    expect(view.getByText("laravel-shop.com")).toBeInTheDocument()
    expect(view.getByText("MySQL DB")).toBeInTheDocument()
  })

  it("handles Cloudflare and Database simulation toggle interactions", () => {
    const view = render(<TrafficFlowCanvas {...defaultProps} />)

    // Click Cloudflare bypass toggle
    const cfBtn = view.getByRole("button", { name: "Proxied" })
    fireEvent.click(cfBtn)
    expect(defaultProps.setCloudflareEnabled).toHaveBeenCalledWith(false)

    // Click Database offline toggle
    const dbBtn = view.getByRole("button", { name: "Connected" })
    fireEvent.click(dbBtn)
    expect(defaultProps.setDbConnected).toHaveBeenCalledWith(false)
  })

  it("displays the correct number of pods based on replicas prop", () => {
    // 1 replica
    let view = render(<TrafficFlowCanvas {...defaultProps} replicas={1} />)
    expect(view.getByText("pod-prod-a8f1")).toBeInTheDocument()
    expect(view.queryByText("pod-prod-c2d4")).not.toBeInTheDocument()
    view.unmount()

    // 2 replicas
    view = render(<TrafficFlowCanvas {...defaultProps} replicas={2} />)
    expect(view.getByText("pod-prod-a8f1")).toBeInTheDocument()
    expect(view.getByText("pod-prod-c2d4")).toBeInTheDocument()
    expect(view.queryByText("pod-prod-e9f6")).not.toBeInTheDocument()
    view.unmount()

    // 3 replicas
    view = render(<TrafficFlowCanvas {...defaultProps} replicas={3} />)
    expect(view.getByText("pod-prod-a8f1")).toBeInTheDocument()
    expect(view.getByText("pod-prod-c2d4")).toBeInTheDocument()
    expect(view.getByText("pod-prod-e9f6")).toBeInTheDocument()
    view.unmount()
  })

  it("applies correct status configurations for different diagnostic modes", () => {
    // 502 error
    let view = render(<TrafficFlowCanvas {...defaultProps} diagnosticMode="error_502" />)
    const errStatus = view.getAllByText("STATUS:")
    expect(errStatus.length).toBe(2) // two pods
    expect(view.getAllByText("ERR_CRASH").length).toBe(2)
    view.unmount()

    // SSL expired error
    view = render(<TrafficFlowCanvas {...defaultProps} diagnosticMode="ssl_expired" />)
    expect(view.getByText("SSL HANDSHAKE FAIL")).toBeInTheDocument()
    view.unmount()

    // Redirect loop error
    view = render(<TrafficFlowCanvas {...defaultProps} diagnosticMode="redirect_loop" />)
    expect(view.getByText("301 LOOP DETECTED")).toBeInTheDocument()
    view.unmount()
  })

  it("triggers SSL HANDSHAKE FAIL when the active domain has an expired TLS status", () => {
    const expiredProps = {
      ...defaultProps,
      diagnosticMode: "healthy",
      domains: [
        {
          id: "dom-1",
          domain: "laravel-shop.com",
          isPrimary: true,
          tlsStatus: "expired" as const,
          dnsStatus: "verified" as const,
          expiresAt: "2026-05-18",
        }
      ]
    }
    const view = render(<TrafficFlowCanvas {...expiredProps} />)
    expect(view.getByText("SSL HANDSHAKE FAIL")).toBeInTheDocument()
    view.unmount()
  })
})
