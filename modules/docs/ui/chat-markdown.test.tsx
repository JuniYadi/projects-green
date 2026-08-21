import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import { ChatMarkdown } from "./chat-markdown"

describe("ChatMarkdown", () => {
  it("renders plain text correctly", () => {
    const view = render(
      <ChatMarkdown content="Hello world from Tanya P" activeLocale="id" />
    )

    expect(view.getByText("Hello world from Tanya P")).toBeTruthy()
  })

  it("renders markdown links as clickable links with locale prefix", () => {
    const view = render(
      <ChatMarkdown
        content="Buka menu [Isi Ulang Saldo](/console/billing/topup) sekarang."
        activeLocale="id"
      />
    )

    const link = view.getByRole("link", { name: /Isi Ulang Saldo/i })
    expect(link).toBeTruthy()
    expect(link.getAttribute("href")).toBe("/id/console/billing/topup")
  })

  it("renders external links with target _blank and rel noopener", () => {
    const view = render(
      <ChatMarkdown
        content="Lihat [Meta Developers](https://developers.facebook.com) untuk detail."
        activeLocale="en"
      />
    )

    const link = view.getByRole("link", { name: /Meta Developers/i })
    expect(link).toBeTruthy()
    expect(link.getAttribute("href")).toBe("https://developers.facebook.com")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toBe("noopener noreferrer")
  })

  it("renders markdown images with alt and src attributes", () => {
    const view = render(
      <ChatMarkdown
        content="Berikut screenshot: ![Form Topup QRIS](/kb-assets/billing/topup.png)"
        activeLocale="id"
      />
    )

    const img = view.getByRole("img")
    expect(img).toBeTruthy()
    expect(img.getAttribute("src")).toBe("/kb-assets/billing/topup.png")
    expect(img.getAttribute("alt")).toBe("Form Topup QRIS")
  })

  it("renders bold text and inline code", () => {
    const view = render(
      <ChatMarkdown
        content="Pastikan **saldo cukup** dan jalankan command `pfn deploy`."
        activeLocale="id"
      />
    )

    expect(view.getByText("saldo cukup")).toBeTruthy()
    expect(view.getByText("pfn deploy")).toBeTruthy()
  })

  it("renders numbered and bulleted lists", () => {
    const view = render(
      <ChatMarkdown
        content={`1. Langkah pertama\n2. Langkah kedua\n- Catatan penting`}
        activeLocale="id"
      />
    )

    expect(view.getByText("Langkah pertama")).toBeTruthy()
    expect(view.getByText("Langkah kedua")).toBeTruthy()
    expect(view.getByText("Catatan penting")).toBeTruthy()
  })
})
