import { afterEach, describe, expect, it } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import { ZeroConfigNotice, getAppSettingsUrl } from "./zero-config-notice"

describe("ZeroConfigNotice", () => {
  afterEach(cleanup)
  it("generates correct settings deep-link URL", () => {
    expect(getAppSettingsUrl("my-app-123")).toBe(
      "/console/app/my-app-123/settings"
    )
    expect(getAppSettingsUrl("my-app-123", "en")).toBe(
      "/en/console/app/my-app-123/settings"
    )
    expect(getAppSettingsUrl("app with spaces", "id")).toBe(
      "/id/console/app/app%20with%20spaces/settings"
    )
  })

  it("renders zero-config ready badge and default English notice", () => {
    const view = render(<ZeroConfigNotice count={12} lang="en" />)

    expect(view.getByTestId("zero-config-badge")).toBeTruthy()
    expect(view.getByText("Zero-Config Ready")).toBeTruthy()
    expect(
      view.getByText("12 variables auto-configured from .env.example")
    ).toBeTruthy()
    expect(
      view.getByText(
        /\(Production secrets can be configured anytime in App Settings\)/i
      )
    ).toBeTruthy()
  })

  it("renders Indonesian translation when lang is id", () => {
    const view = render(<ZeroConfigNotice count={5} lang="id" />)

    expect(view.getByText("Zero-Config Siap")).toBeTruthy()
    expect(
      view.getByText("5 variabel dikonfigurasi otomatis dari .env.example")
    ).toBeTruthy()
    expect(
      view.getByText(
        /\(Kunci rahasia produksi dapat diatur nanti di App Settings\)/i
      )
    ).toBeTruthy()
  })

  it("handles singular variable count correctly", () => {
    const view = render(<ZeroConfigNotice count={1} lang="en" />)
    expect(
      view.getByText("1 variable auto-configured from .env.example")
    ).toBeTruthy()
  })

  it("renders deep-link to App Settings when appId is provided", () => {
    const view = render(
      <ZeroConfigNotice count={8} appId="web-service-456" lang="en" />
    )

    const link = view.getByTestId("zero-config-deep-link")
    expect(link).toBeTruthy()
    expect(link.getAttribute("href")).toBe(
      "/en/console/app/web-service-456/settings"
    )
    expect(view.getByText("Open App Settings")).toBeTruthy()
  })

  it("renders badge-only variant cleanly", () => {
    const view = render(
      <ZeroConfigNotice count={12} variant="badge-only" lang="en" />
    )

    expect(view.getByTestId("zero-config-badge")).toBeTruthy()
    expect(view.queryByTestId("zero-config-notice")).toBeNull()
  })
})
