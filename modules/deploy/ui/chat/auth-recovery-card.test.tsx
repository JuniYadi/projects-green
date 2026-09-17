import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test"
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react"
import { AuthRecoveryCard } from "./auth-recovery-card"

describe("AuthRecoveryCard", () => {
  beforeEach(() => {
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders header, explanatory copy with repo name, and footer note", () => {
    const onAuthorized = mock(() => {})
    const view = render(
      <AuthRecoveryCard
        repoName="my-enterprise/private-core"
        onAuthorized={onAuthorized}
      />
    )

    expect(
      view.getByText(/AKSES REPOSITORY DIBUTUHKAN \(PRIVATE REPOSITORY\)/i)
    ).toBeDefined()
    expect(view.getByText(/my-enterprise\/private-core/i)).toBeDefined()
    expect(view.getByText(/Tanya membutuhkan izin baca kode/i)).toBeDefined()
    expect(
      view.getByText(/Jendela popup akan tertutup otomatis/i)
    ).toBeDefined()
  })

  it("opens OAuth popup when clicking Primary GitHub App button and triggers onAuthorized upon postMessage", () => {
    const onAuthorized = mock(() => {})
    const openMock = mock(() => ({}) as Window)
    const originalOpen = window.open
    window.open = openMock

    const view = render(
      <AuthRecoveryCard
        repoName="my-enterprise/private-core"
        onAuthorized={onAuthorized}
      />
    )

    const popupBtn = view.getByTestId("auth-popup-btn")
    act(() => {
      fireEvent.click(popupBtn)
    })

    expect(openMock).toHaveBeenCalled()
    const callUrl = (openMock.mock.calls[0] as unknown[])[0] as string
    expect(callUrl).toContain("/api/integrations/github/install/start?popup=1")

    // Simulate popup sending postMessage
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "github-install-complete", status: "connected" },
          origin: window.location.origin,
        })
      )
    })

    expect(onAuthorized).toHaveBeenCalledTimes(1)
    window.open = originalOpen
  })

  it("toggles PAT input, permits entering token and triggers onAuthorized upon submit", async () => {
    const onAuthorized = mock(() => {})
    const onSubmitPat = mock(async () => {})

    const view = render(
      <AuthRecoveryCard
        repoName="my-enterprise/private-core"
        onAuthorized={onAuthorized}
        onSubmitPat={onSubmitPat}
      />
    )

    // PAT container not initially visible
    expect(view.queryByTestId("pat-input-container")).toBeNull()

    // Toggle open
    const toggleBtn = view.getByTestId("auth-pat-toggle-btn")
    act(() => {
      fireEvent.click(toggleBtn)
    })

    const patInput = view.getByTestId("pat-token-input")
    expect(patInput).toBeDefined()

    // Enter token
    act(() => {
      fireEvent.change(patInput, { target: { value: "ghp_secretToken12345" } })
    })

    const submitBtn = view.getByTestId("submit-pat-btn")
    act(() => {
      fireEvent.click(submitBtn)
    })

    expect(onSubmitPat).toHaveBeenCalledWith("ghp_secretToken12345")
    await waitFor(() => {
      expect(onAuthorized).toHaveBeenCalledTimes(1)
    })
  })
})
