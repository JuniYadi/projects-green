import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const setTheme = mock(() => {})
mock.module("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme }),
}))

import { HomeNav } from "./nav"

describe("Home navigation", () => {
  beforeEach(() => {
    cleanup()
    setTheme.mockClear()
  })

  it("exposes the WhatsApp Official product page in Products", async () => {
    const view = render(<HomeNav />)
    const user = userEvent.setup()

    await user.click(view.getByRole("button", { name: "Open menu" }))

    expect(
      view.getByRole("link", { name: "WhatsApp Official" })
    ).toHaveAttribute("href", "/en/products/whatsapp-official")
    expect(view.getAllByRole("link", { name: "Why Us" })).toHaveLength(2)
    for (const link of view.getAllByRole("link", { name: "Why Us" })) {
      expect(link).toHaveAttribute("href", "/en#why-us")
    }
    expect(view.getAllByRole("link", { name: "Templates" })).toHaveLength(2)
    await user.click(view.getAllByRole("link", { name: "Why Us" })[1]!)
    expect(view.queryByRole("button", { name: "Close menu" })).toBeNull()
    await user.click(view.getByRole("button", { name: "Open menu" }))
    expect(
      view.getAllByRole("link", { name: "Sign in to Console" })
    ).toHaveLength(2)
    for (const link of view.getAllByRole("link", {
      name: "Sign in to Console",
    })) {
      expect(link).toHaveAttribute("href", "/en/login?next=%2Fen%2Fconsole")
    }
    await user.click(
      view.getAllByRole("button", { name: "Choose language" })[1]!
    )
    expect(view.getByRole("link", { name: "Indonesia" })).toHaveAttribute(
      "href",
      "/id"
    )
    expect(view.getByRole("link", { name: "English" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    await user.click(view.getAllByRole("button", { name: "Switch theme" })[1]!)
    expect(setTheme).toHaveBeenCalledWith("light")
  })
})
