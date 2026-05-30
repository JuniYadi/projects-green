import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import { DataTableColumnHeader } from "./data-table-column-header"

describe("DataTableColumnHeader", () => {
  it("renders plain title when column cannot be sorted", () => {
    const column = {
      getCanSort: () => false,
      getIsSorted: () => false,
      toggleSorting: mock(),
    } as unknown as Parameters<typeof DataTableColumnHeader>[0]["column"]

    const view = render(<DataTableColumnHeader column={column} title="Name" />)
    expect(view.getByText("Name")).toBeInTheDocument()
  })

  it("renders a sortable button with unsorted icon", () => {
    const column = {
      getCanSort: () => true,
      getIsSorted: () => false,
      toggleSorting: mock(),
    } as unknown as Parameters<typeof DataTableColumnHeader>[0]["column"]

    const view = render(<DataTableColumnHeader column={column} title="Email" />)
    const name = view.getByText("Email")
    expect(name).toBeInTheDocument()
    const button = name.closest("button")
    expect(button).toBeInTheDocument()
    expect(button?.querySelector("svg")).toBeInTheDocument()
  })

  it("renders ascending sort icon when sorted asc", () => {
    const column = {
      getCanSort: () => true,
      getIsSorted: () => "asc",
      toggleSorting: mock(),
    } as unknown as Parameters<typeof DataTableColumnHeader>[0]["column"]

    const view = render(<DataTableColumnHeader column={column} title="Role" />)
    const ascButton = view.getByText("Role").closest("button")
    expect(ascButton).toBeInTheDocument()
    expect(ascButton?.querySelector("svg")).toBeInTheDocument()
  })

  it("renders descending sort icon when sorted desc", () => {
    const column = {
      getCanSort: () => true,
      getIsSorted: () => "desc",
      toggleSorting: mock(),
    } as unknown as Parameters<typeof DataTableColumnHeader>[0]["column"]

    const view = render(<DataTableColumnHeader column={column} title="Date" />)
    const descButton = view.getByText("Date").closest("button")
    expect(descButton).toBeInTheDocument()
    expect(descButton?.querySelector("svg")).toBeInTheDocument()
  })

  it("toggles sorting on click", () => {
    const toggleSorting = mock()
    const column = {
      getCanSort: () => true,
      getIsSorted: () => false,
      toggleSorting,
    } as unknown as Parameters<typeof DataTableColumnHeader>[0]["column"]

    const view = render(<DataTableColumnHeader column={column} title="Name" />)
    view.getByText("Name").click()
    expect(toggleSorting).toHaveBeenCalledWith(false)
  })
})
