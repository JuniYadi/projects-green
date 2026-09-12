import { beforeEach, describe, expect, it } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { HomeNav } from "./nav"

describe("Home navigation", () => {
  beforeEach(() => {
    cleanup()
  })

  it("exposes the WhatsApp Official product page in Products", async () => {
    const view = render(<HomeNav />)
    const user = userEvent.setup()

    await user.click(view.getByRole("button", { name: "Open menu" }))

    expect(
      view.getByRole("link", { name: "WhatsApp Official" })
    ).toHaveAttribute("href", "/products/whatsapp-official")
  })
})
