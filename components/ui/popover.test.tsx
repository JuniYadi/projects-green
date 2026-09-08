import { describe, expect, it } from "bun:test"
import { fireEvent, render } from "@testing-library/react"
import * as React from "react"

import { Popover, PopoverContent, PopoverTrigger } from "./popover"

describe("Popover component", () => {
  it("renders trigger and displays content when clicked", () => {
    const { getByText, queryByText } = render(
      <Popover>
        <PopoverTrigger asChild>
          <button type="button">Open popover</button>
        </PopoverTrigger>
        <PopoverContent>
          <p>Popover body content</p>
        </PopoverContent>
      </Popover>
    )

    expect(getByText("Open popover")).toBeInTheDocument()
    expect(queryByText("Popover body content")).toBeNull()

    fireEvent.click(getByText("Open popover"))
    expect(getByText("Popover body content")).toBeInTheDocument()
  })
})
