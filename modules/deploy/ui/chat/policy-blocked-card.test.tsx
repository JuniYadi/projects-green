import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { PolicyBlockedCard } from "./policy-blocked-card"

describe("PolicyBlockedCard", () => {
  beforeEach(() => {
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders header, violation details, and recommended solutions", () => {
    const view = render(
      <PolicyBlockedCard
        ruleTitle="Block unmanaged legacy PHP/WordPress standalone code"
        reason="Ditemukan file wp-config.php dan core lama yang rentan CVE."
      />
    )

    expect(
      view.getByText(
        /DEPLOYMENT DIBLOKIR OLEH KEBIJAKAN PLATFORM \(POLICY BLOCKED\)/i
      )
    ).toBeDefined()
    expect(
      view.getByText(/Block unmanaged legacy PHP\/WordPress standalone code/i)
    ).toBeDefined()
    expect(
      view.getByText(
        /Ditemukan file wp-config\.php dan core lama yang rentan CVE\./i
      )
    ).toBeDefined()
    expect(view.getByText(/Solusi & Rekomendasi dari Tanya:/i)).toBeDefined()
    expect(
      view.getByText(/Gunakan 1-Click Managed WordPress di App Marketplace/i)
    ).toBeDefined()
    expect(
      view.getByText(
        /Atau bungkus aplikasi Anda ke dalam Dockerfile yang terisolasi/i
      )
    ).toBeDefined()
  })

  it("triggers onSelectMarketplace when marketplace button is clicked", () => {
    const onSelectMarketplace = mock(() => {})
    const view = render(
      <PolicyBlockedCard onSelectMarketplace={onSelectMarketplace} />
    )

    const marketplaceBtn = view.getByTestId("policy-marketplace-btn")
    act(() => {
      fireEvent.click(marketplaceBtn)
    })

    expect(onSelectMarketplace).toHaveBeenCalledTimes(1)
  })

  it("triggers onSelectCustomDockerfile when Dockerfile button is clicked", () => {
    const onSelectCustomDockerfile = mock(() => {})
    const view = render(
      <PolicyBlockedCard onSelectCustomDockerfile={onSelectCustomDockerfile} />
    )

    const dockerBtn = view.getByTestId("policy-dockerfile-btn")
    act(() => {
      fireEvent.click(dockerBtn)
    })

    expect(onSelectCustomDockerfile).toHaveBeenCalledTimes(1)
  })
})
