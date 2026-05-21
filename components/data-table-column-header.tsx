"use client"

import type { Column } from "@tanstack/react-table"
import {
  ArrowsDownUpIcon,
  CaretDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

type DataTableColumnHeaderProps<TData, TValue> = {
  column: Column<TData, TValue>
  title: string
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return title
  }

  const sorted = column.getIsSorted()
  const Icon =
    sorted === "asc"
      ? CaretUpIcon
      : sorted === "desc"
        ? CaretDownIcon
        : ArrowsDownUpIcon

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {title}
      <Icon />
    </Button>
  )
}
