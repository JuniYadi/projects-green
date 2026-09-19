import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"
import InteractiveRepliesToggle from "./interactive-replies-toggle"

describe("InteractiveRepliesToggle", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders toggle, label, and mock buttons when enabled", () => {
    const onCheckedChange = mock(() => {})
    const { getByText, getByTestId, getByRole } = render(
      <InteractiveRepliesToggle
        checked={true}
        onCheckedChange={onCheckedChange}
        lang="id"
      />
    )

    expect(
      getByText(
        "Izinkan Tombol Interaktif WhatsApp (Quick Replies & URL Links)"
      )
    ).toBeDefined()
    expect(getByText("Aktif")).toBeDefined()
    expect(getByText("💬 Tanya Produk")).toBeDefined()
    expect(getByText("📦 Cek Pesanan")).toBeDefined()
    expect(getByText("🌐 Kunjungi Website")).toBeDefined()

    const preview = getByTestId("interactive-replies-preview")
    expect(preview.className).toContain("opacity-100")

    const toggle = getByRole("switch")
    fireEvent.click(toggle)
    expect(onCheckedChange).toHaveBeenCalledWith(false)
  })

  it("renders disabled state and hint when checked is false", () => {
    const onCheckedChange = mock(() => {})
    const { getByText, getByTestId, getByRole } = render(
      <InteractiveRepliesToggle
        checked={false}
        onCheckedChange={onCheckedChange}
        lang="id"
      />
    )

    expect(getByText("Nonaktif")).toBeDefined()
    expect(
      getByText(/Pesan tombol interaktif dinonaktifkan/i)
    ).toBeDefined()

    const preview = getByTestId("interactive-replies-preview")
    expect(preview.className).toContain("opacity-50")
    expect(preview.className).toContain("grayscale")

    const toggle = getByRole("switch")
    fireEvent.click(toggle)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it("renders English locale correctly", () => {
    const onCheckedChange = mock(() => {})
    const { getByText } = render(
      <InteractiveRepliesToggle
        checked={true}
        onCheckedChange={onCheckedChange}
        lang="en"
      />
    )

    expect(
      getByText(
        "Allow WhatsApp Interactive Replies (Quick Replies & URL Links)"
      )
    ).toBeDefined()
    expect(getByText("Enabled")).toBeDefined()
  })
})
