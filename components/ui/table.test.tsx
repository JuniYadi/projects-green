import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "./table"

describe("Table", () => {
  it("renders table element with correct data-slot attribute", () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Data</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    const table = container.querySelector("table")
    expect(table).toBeTruthy()
    expect(table).toHaveAttribute("data-slot", "table")
  })

  it("renders wrapper div with table-container data-slot", () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Test</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    const wrapper = container.querySelector("div")
    expect(wrapper).toHaveAttribute("data-slot", "table-container")
  })

  it("applies custom className to table", () => {
    const { container } = render(
      <Table className="custom-table-class">
        <TableBody>
          <TableRow>
            <TableCell>Test</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    expect(container.querySelector("table")).toHaveClass("custom-table-class")
  })

  it("preserves existing className on table along with default classes", () => {
    const { container } = render(
      <Table className="extra-class">
        <TableBody>
          <TableRow>
            <TableCell>Test</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    const table = container.querySelector("table")
    expect(table).toHaveClass("extra-class")
    expect(table).toHaveClass("w-full")
    expect(table).toHaveClass("caption-bottom")
  })

  it("passes additional HTML attributes to table element", () => {
    const { container } = render(
      <Table id="my-table" style={{ color: "red" }}>
        <TableBody>
          <TableRow>
            <TableCell>Test</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    const table = container.querySelector("table")
    expect(table).toHaveAttribute("id", "my-table")
    expect(table).toHaveAttribute("style")
  })
})

describe("TableHeader", () => {
  it("renders thead element with correct data-slot", () => {
    const { container } = render(
      <table>
        <TableHeader>
          <TableRow>
            <TableHead>Header</TableHead>
          </TableRow>
        </TableHeader>
      </table>
    )
    const thead = container.querySelector("thead")
    expect(thead).toBeTruthy()
    expect(thead).toHaveAttribute("data-slot", "table-header")
  })

  it("applies custom className", () => {
    const { container } = render(
      <table>
        <TableHeader className="custom-header">
          <TableRow>
            <TableHead>H</TableHead>
          </TableRow>
        </TableHeader>
      </table>
    )
    expect(container.querySelector("thead")).toHaveClass("custom-header")
  })

  it("renders children correctly", () => {
    const view = render(
      <table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
      </table>
    )
    expect(view.getByText("Name")).toBeTruthy()
    expect(view.getByText("Email")).toBeTruthy()
  })
})

describe("TableBody", () => {
  it("renders tbody element with correct data-slot", () => {
    const { container } = render(
      <table>
        <TableBody>
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </table>
    )
    const tbody = container.querySelector("tbody")
    expect(tbody).toBeTruthy()
    expect(tbody).toHaveAttribute("data-slot", "table-body")
  })

  it("applies custom className", () => {
    const { container } = render(
      <table>
        <TableBody className="custom-body">
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </table>
    )
    expect(container.querySelector("tbody")).toHaveClass("custom-body")
  })
})

describe("TableFooter", () => {
  it("renders tfoot element with correct data-slot", () => {
    const { container } = render(
      <table>
        <TableFooter>
          <TableRow>
            <TableCell>Footer</TableCell>
          </TableRow>
        </TableFooter>
      </table>
    )
    const tfoot = container.querySelector("tfoot")
    expect(tfoot).toBeTruthy()
    expect(tfoot).toHaveAttribute("data-slot", "table-footer")
  })

  it("applies custom className", () => {
    const { container } = render(
      <table>
        <TableFooter className="custom-footer">
          <TableRow>
            <TableCell>F</TableCell>
          </TableRow>
        </TableFooter>
      </table>
    )
    expect(container.querySelector("tfoot")).toHaveClass("custom-footer")
  })

  it("renders children correctly", () => {
    const view = render(
      <table>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
          </TableRow>
        </TableFooter>
      </table>
    )
    expect(view.getByText("Total")).toBeTruthy()
  })
})

describe("TableRow", () => {
  it("renders tr element with correct data-slot", () => {
    const { container } = render(
      <table>
        <tbody>
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </tbody>
      </table>
    )
    const tr = container.querySelector("tr")
    expect(tr).toBeTruthy()
    expect(tr).toHaveAttribute("data-slot", "table-row")
  })

  it("applies custom className", () => {
    const { container } = render(
      <table>
        <tbody>
          <TableRow className="custom-row">
            <TableCell>Cell</TableCell>
          </TableRow>
        </tbody>
      </table>
    )
    expect(container.querySelector("tr")).toHaveClass("custom-row")
  })

  it("renders multiple cells in a row", () => {
    const view = render(
      <table>
        <tbody>
          <TableRow>
            <TableCell>Cell A</TableCell>
            <TableCell>Cell B</TableCell>
          </TableRow>
        </tbody>
      </table>
    )
    expect(view.getByText("Cell A")).toBeTruthy()
    expect(view.getByText("Cell B")).toBeTruthy()
  })
})

describe("TableHead", () => {
  it("renders th element with correct data-slot", () => {
    const { container } = render(
      <table>
        <thead>
          <tr>
            <TableHead>Header</TableHead>
          </tr>
        </thead>
      </table>
    )
    const th = container.querySelector("th")
    expect(th).toBeTruthy()
    expect(th).toHaveAttribute("data-slot", "table-head")
  })

  it("applies custom className", () => {
    const { container } = render(
      <table>
        <thead>
          <tr>
            <TableHead className="custom-head">H</TableHead>
          </tr>
        </thead>
      </table>
    )
    expect(container.querySelector("th")).toHaveClass("custom-head")
  })

  it("renders text content", () => {
    const view = render(
      <table>
        <thead>
          <tr>
            <TableHead>Column Name</TableHead>
          </tr>
        </thead>
      </table>
    )
    expect(view.getByText("Column Name")).toBeTruthy()
  })
})

describe("TableCell", () => {
  it("renders td element with correct data-slot", () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <TableCell>Cell</TableCell>
          </tr>
        </tbody>
      </table>
    )
    const td = container.querySelector("td")
    expect(td).toBeTruthy()
    expect(td).toHaveAttribute("data-slot", "table-cell")
  })

  it("applies custom className", () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <TableCell className="custom-cell">C</TableCell>
          </tr>
        </tbody>
      </table>
    )
    expect(container.querySelector("td")).toHaveClass("custom-cell")
  })

  it("renders text content", () => {
    const view = render(
      <table>
        <tbody>
          <tr>
            <TableCell>Data Value</TableCell>
          </tr>
        </tbody>
      </table>
    )
    expect(view.getByText("Data Value")).toBeTruthy()
  })
})

describe("TableCaption", () => {
  it("renders caption element with correct data-slot", () => {
    const { container } = render(
      <table>
        <TableCaption>List of items</TableCaption>
      </table>
    )
    const caption = container.querySelector("caption")
    expect(caption).toBeTruthy()
    expect(caption).toHaveAttribute("data-slot", "table-caption")
  })

  it("renders caption text", () => {
    const view = render(
      <table>
        <TableCaption>Product Inventory</TableCaption>
      </table>
    )
    const caption = view.getByText("Product Inventory")
    expect(caption).toBeTruthy()
    expect(caption.tagName).toBe("CAPTION")
  })

  it("applies custom className", () => {
    const { container } = render(
      <table>
        <TableCaption className="custom-caption">Caption</TableCaption>
      </table>
    )
    expect(container.querySelector("caption")).toHaveClass("custom-caption")
  })
})

describe("Table - integration", () => {
  it("renders a complete table with all subcomponents", () => {
    const view = render(
      <Table>
        <TableCaption>Monthly Report</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alice</TableCell>
            <TableCell>Admin</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Bob</TableCell>
            <TableCell>User</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total: 2</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    )

    const { container } = view

    // Verify all structural elements
    expect(container.querySelector("table")).toHaveAttribute(
      "data-slot",
      "table"
    )
    expect(container.querySelector("caption")).toHaveAttribute(
      "data-slot",
      "table-caption"
    )
    expect(container.querySelector("thead")).toHaveAttribute(
      "data-slot",
      "table-header"
    )
    expect(container.querySelector("tbody")).toHaveAttribute(
      "data-slot",
      "table-body"
    )
    expect(container.querySelector("tfoot")).toHaveAttribute(
      "data-slot",
      "table-footer"
    )
    expect(container.querySelectorAll("tr")).toHaveLength(4)
    expect(container.querySelectorAll("th")).toHaveLength(2)
    // 2 body rows × 2 cells + 1 footer row × 2 cells = 6
    expect(container.querySelectorAll("td")).toHaveLength(6)

    // Verify content
    expect(view.getByText("Monthly Report")).toBeTruthy()
    expect(view.getByText("Alice")).toBeTruthy()
    expect(view.getByText("Bob")).toBeTruthy()
  })

  it("renders an empty table gracefully", () => {
    const { container } = render(<Table />)
    const table = container.querySelector("table")
    expect(table).toBeTruthy()
    expect(table).toHaveAttribute("data-slot", "table")
  })
})
