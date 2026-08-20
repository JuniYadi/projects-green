import { beforeEach, describe, expect, it } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import PrivacyPage, {
  generateMetadata as generatePrivacyMetadata,
} from "./page"

describe("Privacy Policy Page", () => {
  beforeEach(() => {
    cleanup()
  })

  it("renders privacy page with H1 and correct content", async () => {
    const page = await PrivacyPage({
      params: Promise.resolve({ lang: "en" }),
    })
    const view = render(page)

    expect(
      view.getByRole("heading", { level: 1, name: "Privacy Policy" })
    ).toBeInTheDocument()
    expect(view.getByText("1. Information We Collect")).toBeInTheDocument()
  })

  it("generates correct metadata for English and Indonesian", async () => {
    const enMeta = await generatePrivacyMetadata({
      params: Promise.resolve({ lang: "en" }),
    })
    expect(enMeta.title).toBe("Privacy Policy — PFNApp")

    const idMeta = await generatePrivacyMetadata({
      params: Promise.resolve({ lang: "id" }),
    })
    expect(idMeta.title).toBe("Kebijakan Privasi — PFNApp")
  })
})
