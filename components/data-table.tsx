"use client"

import * as React from "react"
import {
  type ColumnFiltersState,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"

import { usePersistedColumnVisibility } from "@/hooks/use-persisted-column-visibility"
import { CaretDownIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type DataTableFilterOption = {
  label: string
  value: string
}

type DataTableFacetFilter = {
  allLabel?: string
  columnId: string
  label: string
  options: DataTableFilterOption[]
}

type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  emptyMessage?: string
  facetFilters?: DataTableFacetFilter[]
  initialColumnFilters?: ColumnFiltersState
  initialSorting?: SortingState
  searchableColumns: string[]
  searchPlaceholder: string
  tableId?: string
  /**
   * Columns to hide by default. These can be toggled on via the Columns dropdown.
   * The persistence layer will override this once the user has interacted with column visibility.
   */
  defaultColumnVisibility?: Record<string, boolean>
  /**
   * When set, enables client-side pagination with the given page size.
   */
  pageSize?: number
}

export function DataTable<TData>({
  columns,
  data,
  emptyMessage = "No results found.",
  facetFilters = [],
  initialColumnFilters = [],
  initialSorting = [],
  searchableColumns,
  searchPlaceholder,
  tableId,
  defaultColumnVisibility = {},
  pageSize,
}: DataTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(initialColumnFilters)
  const [columnVisibility, setColumnVisibility] =
    usePersistedColumnVisibility(tableId, defaultColumnVisibility)
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSize ?? 10,
  })

  // Reset to page 1 when filters or search change
  React.useEffect(() => {
    if (pageSize) {
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    }
  }, [globalFilter, columnFilters, pageSize])


  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
      sorting,
      columnFilters,
      columnVisibility,
      ...(pageSize ? { pagination } : {}),
    },
    globalFilterFn: (row, _, filterValue) => {
      const searchValue = String(filterValue ?? "")
        .trim()
        .toLowerCase()

      if (!searchValue) {
        return true
      }

      return searchableColumns.some((columnId) => {
        const value = row.getValue(columnId)
        return String(value ?? "")
          .toLowerCase()
          .includes(searchValue)
      })
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    ...(pageSize
      ? {
          onPaginationChange: setPagination,
          getPaginationRowModel: getPaginationRowModel(),
        }
      : {}),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full sm:max-w-sm"
          aria-label={searchPlaceholder}
        />
        <div className="flex flex-wrap gap-3 sm:ml-auto">
          {facetFilters.map((filter) => {
            const column = table.getColumn(filter.columnId)
            const value = String(column?.getFilterValue() ?? "all")

            return (
              <Select
                key={filter.columnId}
                value={value}
                onValueChange={(nextValue) =>
                  column?.setFilterValue(
                    nextValue === "all" ? undefined : nextValue
                  )
                }
              >
                <SelectTrigger className="w-[180px]" size="sm">
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {filter.allLabel ?? "All"}
                  </SelectItem>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          })}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto">
                Columns
                <CaretDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) => {
                      column.toggleVisibility(Boolean(checked))
                    }}
                  >
                    {column.id.replace(/_/g, " ")}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {pageSize && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {table.getFilteredRowModel().rows.length > 0
              ? `Showing ${table.getState().pagination.pageIndex * pageSize + 1}-${Math.min(
                  (table.getState().pagination.pageIndex + 1) * pageSize,
                  table.getFilteredRowModel().rows.length
                )} of ${table.getFilteredRowModel().rows.length} results`
              : "Showing 0 results"}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
