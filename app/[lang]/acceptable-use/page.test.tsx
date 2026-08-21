import { beforeEach, describe, expect, it } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import AcceptableUsePage, {
  generateMetadata as generateAupMetadata,
} from "./page"

describe("Acceptable Use Policy Page", () => {
  beforeEach(() => {
    cleanup()
  })

  it("renders acceptable use page with H1 and correct content", async () => {
    const page = await AcceptableUsePage({
      params: Promise.resolve({ lang: "en" }),
    })
    const view = render(page)

    expect(
      view.getByRole("heading", {
        level: 1,
        name: "Acceptable Use Policy",
      })
    ).toBeInTheDocument()
    expect(view.getByText("1. Purpose & Scope")).toBeInTheDocument()
  })

  it("generates correct metadata for English and Indonesian", async () => {
    const enMeta = await generateAupMetadata({
      params: Promise.resolve({ lang: "en" }),
    })
    expect(enMeta.title).toBe("Acceptable Use Policy — PFNApp")

    const idMeta = await generateAupMetadata({
      params: Promise.resolve({ lang: "id" }),
    })
    expect(idMeta.title).toBe("Kebijakan Penggunaan Wajar — PFNApp")
  })
})
