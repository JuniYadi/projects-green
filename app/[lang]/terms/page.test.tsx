import { beforeEach, describe, expect, it } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import TermsPage, { generateMetadata as generateTermsMetadata } from "./page"

describe("Terms of Service Page", () => {
  beforeEach(() => {
    cleanup()
  })

  it("renders terms page with H1 and correct content", async () => {
    const page = await TermsPage({
      params: Promise.resolve({ lang: "en" }),
    })
    const view = render(page)

    expect(
      view.getByRole("heading", { level: 1, name: "Terms of Service" })
    ).toBeInTheDocument()
    expect(view.getByText("1. Acceptance of Terms")).toBeInTheDocument()
  })

  it("generates correct metadata for English and Indonesian", async () => {
    const enMeta = await generateTermsMetadata({
      params: Promise.resolve({ lang: "en" }),
    })
    expect(enMeta.title).toBe("Terms of Service — PFNApp")

    const idMeta = await generateTermsMetadata({
      params: Promise.resolve({ lang: "id" }),
    })
    expect(idMeta.title).toBe("Ketentuan Layanan — PFNApp")
  })
})
