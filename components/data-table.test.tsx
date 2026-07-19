import { describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"

import type { ColumnDef } from "@tanstack/react-table"

// Mock the persisted visibility hook before importing DataTable
mock.module("@/hooks/use-persisted-column-visibility", () => ({
  usePersistedColumnVisibility: () => [{}, mock(() => {})],
}))

import { DataTable } from "./data-table"

// --- Realistic test data ---

interface Item {
  id: number
  name: string
  status: "active" | "inactive" | "pending"
  category: string
}

const makeItems = (count: number): Item[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    status: (["active", "inactive", "pending"] as const)[i % 3]!,
    category: `Category ${Math.floor(i / 5) + 1}`,
  }))

const columns: ColumnDef<Item>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => row.original.name,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span data-testid={`status-${row.original.id}`}>
        {row.original.status}
      </span>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
  },
]

describe("DataTable pagination", () => {
  const TABLE_ID = "test-pagination-table"

  describe("with pageSize prop", () => {
    const items = makeItems(25) // 25 rows total

    it("shows exactly pageSize rows on the first page", () => {
      const { container } = render(
        <DataTable
          columns={columns}
          data={items}
          tableId={TABLE_ID}
          pageSize={10}
          searchableColumns={["name"]}
          searchPlaceholder="Search..."
        />
      )

      const tbody = container.querySelector("tbody")!
      const rows = tbody.querySelectorAll("tr")
      expect(rows).toHaveLength(10)
    })

    it("shows the pagination footer with correct summary text", () => {
      const { getByText } = render(
        <DataTable
          columns={columns}
          data={items}
          tableId={TABLE_ID}
          pageSize={10}
          searchableColumns={["name"]}
          searchPlaceholder="Search..."
        />
      )

      expect(getByText(/^Showing 1-10 of 25 results$/)).toBeDefined()
      expect(getByText(/^Page 1 of 3$/)).toBeDefined()

      const prev = Array.from(document.body.querySelectorAll("button")).filter(
        (b) => b.textContent === "Previous"
      )
      expect(prev[0]).toBeDisabled()

      const next = Array.from(document.body.querySelectorAll("button")).filter(
        (b) => b.textContent === "Next"
      )
      expect(next[0]).toBeEnabled()
    })

    it("navigates to the next page when Next is clicked", () => {
      const { getByText } = render(
        <DataTable
          columns={columns}
          data={items}
          tableId={TABLE_ID}
          pageSize={10}
          searchableColumns={["name"]}
          searchPlaceholder="Search..."
        />
      )

      const nextButtons = () =>
        Array.from(document.body.querySelectorAll("button")).filter(
          (b) => b.textContent === "Next"
        )
      fireEvent.click(nextButtons()[0]!)

      expect(getByText(/^Showing 11-20 of 25 results$/)).toBeDefined()
      expect(getByText(/^Page 2 of 3$/)).toBeDefined()

      const prev = Array.from(document.body.querySelectorAll("button")).filter(
        (b) => b.textContent === "Previous"
      )
      expect(prev[0]).toBeEnabled()
      expect(nextButtons()[0]).toBeEnabled()
    })

    it("shows the last page correctly", () => {
      const { getByText } = render(
        <DataTable
          columns={columns}
          data={items}
          tableId={TABLE_ID}
          pageSize={10}
          searchableColumns={["name"]}
          searchPlaceholder="Search..."
        />
      )

      const nextButtons = () =>
        Array.from(document.body.querySelectorAll("button")).filter(
          (b) => b.textContent === "Next"
        )
      fireEvent.click(nextButtons()[0]!)
      fireEvent.click(nextButtons()[0]!)

      expect(getByText(/^Showing 21-25 of 25 results$/)).toBeDefined()
      expect(getByText(/^Page 3 of 3$/)).toBeDefined()
      expect(nextButtons()[0]).toBeDisabled()
    })

    it("resets to page 1 when a search query is typed", async () => {
      const { getByPlaceholderText, getByText } = render(
        <DataTable
          columns={columns}
          data={items}
          tableId={TABLE_ID}
          pageSize={10}
          searchableColumns={["name"]}
          searchPlaceholder="Search..."
        />
      )

      const nextButtons = () =>
        Array.from(document.body.querySelectorAll("button")).filter(
          (b) => b.textContent === "Next"
        )
      fireEvent.click(nextButtons()[0]!)
      expect(getByText(/^Page 2 of 3$/)).toBeDefined()

      const searchInput = getByPlaceholderText("Search...")
      // userEvent.type properly fires React onChange in Happy DOM
      await userEvent.type(searchInput, "Item 1")

      // "Item 1" matches Item 1 and Items 10-19 = 11 items → 2 pages
      expect(getByText(/^Page 1 of 2$/)).toBeDefined()
      expect(getByText(/Showing 1-\d+ of 11 results/)).toBeDefined()
    })

    it("resets to page 1 when column filters change", () => {
      const { getByText, getByRole } = render(
        <DataTable
          columns={columns}
          data={items}
          tableId={TABLE_ID}
          pageSize={10}
          searchableColumns={["name"]}
          searchPlaceholder="Search..."
          facetFilters={[
            {
              columnId: "status",
              label: "Status",
              options: [
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ],
            },
          ]}
        />
      )

      const nextButtons = () =>
        Array.from(document.body.querySelectorAll("button")).filter(
          (b) => b.textContent === "Next"
        )
      fireEvent.click(nextButtons()[0]!)
      expect(getByText(/^Page 2 of 3$/)).toBeDefined()

      // Open the Status select and choose "Active"
      const selectTrigger = getByRole("combobox")
      fireEvent.click(selectTrigger)

      // After opening, Radix renders SelectItem options in the portal.
      // Click the "Active" option (role=option, text="Active")
      const activeOption = Array.from(
        document.body.querySelectorAll('[role="option"]')
      ).find((o) => o.textContent === "Active")
      expect(activeOption).not.toBeNull()
      fireEvent.click(activeOption!)

      // Should reset to page 1
      expect(getByText(/^Page 1 of \d+$/)).toBeDefined()
    })
  })

  describe("without pageSize prop", () => {
    const items = makeItems(25)

    it("renders all rows without pagination controls", () => {
      const { container, queryByText } = render(
        <DataTable
          columns={columns}
          data={items}
          tableId="no-pagination-table"
          searchableColumns={["name"]}
          searchPlaceholder="Search..."
        />
      )

      const tbody = container.querySelector("tbody")!
      const rows = tbody.querySelectorAll("tr")
      expect(rows).toHaveLength(25)

      expect(queryByText(/Showing \d+-\d+ of \d+ results/)).toBeNull()
      expect(queryByText(/^Page \d+ of \d+$/)).toBeNull()
    })

    it("still renders a search input", () => {
      const { getByPlaceholderText } = render(
        <DataTable
          columns={columns}
          data={items}
          tableId="no-pagination-table"
          searchableColumns={["name"]}
          searchPlaceholder="Search items..."
        />
      )

      expect(getByPlaceholderText("Search items...")).toBeDefined()
    })
  })

  describe("empty state", () => {
    it("shows empty message in table body and hides pagination footer", () => {
      const { getByText, queryByText } = render(
        <DataTable
          columns={columns}
          data={[]}
          tableId="empty-table"
          pageSize={10}
          emptyMessage="No items found."
          searchableColumns={["name"]}
          searchPlaceholder="Search..."
        />
      )

      // Empty message shown in table body
      expect(getByText("No items found.")).toBeDefined()
      // Pagination footer is NOT rendered — with empty data TanStack returns
      // pageCount = ceil(0/10) = 0, so the condition "pageSize && pageCount > 1" is false
      expect(queryByText(/Showing \d+-\d+ of \d+ results/)).toBeNull()
      expect(queryByText(/^Page \d+ of \d+$/)).toBeNull()
    })

    it("hides pagination controls when data fits on one page", () => {
      const { queryByText } = render(
        <DataTable
          columns={columns}
          data={makeItems(5)}
          tableId="single-page-table"
          pageSize={10}
          searchableColumns={["name"]}
          searchPlaceholder="Search..."
        />
      )

      // 5 items < pageSize(10), pageCount = ceil(5/10) = 1, so 1 > 1 is false → hidden
      expect(queryByText(/Showing \d+-\d+ of \d+ results/)).toBeNull()
      expect(queryByText(/^Page 1 of 1$/)).toBeNull()
    })
  })
})
