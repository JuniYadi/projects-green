"use client"

import { useState } from "react"
import {
  Columns,
  MagnifyingGlass,
  X,
  ArrowCounterClockwise,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type LogColumnPickerProps = {
  availableFields: string[]
  selectedColumns: string[]
  onToggleColumn: (field: string) => void
  onResetColumns: () => void
}

export function LogColumnPicker({
  availableFields,
  selectedColumns,
  onToggleColumn,
  onResetColumns,
}: LogColumnPickerProps) {
  const [search, setSearch] = useState("")

  const filteredFields = availableFields.filter((f) =>
    f.toLowerCase().includes(search.toLowerCase().trim())
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Columns size={13} />
          <span>Kolom</span>
          {selectedColumns.length > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 font-mono text-[10px] font-semibold text-primary">
              +{selectedColumns.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 rounded-xl border border-border bg-popover p-3 shadow-lg"
      >
        <div className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-1.5">
              <Columns size={14} className="text-foreground" />
              <span className="text-xs font-semibold text-foreground">
                Kustomisasi Kolom Tabel
              </span>
            </div>
            {selectedColumns.length > 0 && (
              <button
                type="button"
                onClick={onResetColumns}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                title="Reset ke kolom bawaan"
              >
                <ArrowCounterClockwise size={11} />
                <span>Reset</span>
              </button>
            )}
          </div>

          <p className="text-[11px] leading-snug text-muted-foreground">
            Pilih atribut JSON untuk ditampilkan sebagai kolom dinamis di tabel.
          </p>

          <div className="relative">
            <MagnifyingGlass
              size={13}
              className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              placeholder="Cari field (cth: status, pod)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 rounded-lg pl-7 text-[11px]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto py-1 pr-1">
            {filteredFields.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                {availableFields.length === 0
                  ? "Belum ada atribut JSON terdeteksi di log."
                  : "Field tidak ditemukan."}
              </div>
            ) : (
              filteredFields.map((field) => {
                const isSelected = selectedColumns.includes(field)
                return (
                  <label
                    key={field}
                    className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted/50"
                  >
                    <span className="truncate pr-2 font-mono text-[11px] text-foreground">
                      {field}
                    </span>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleColumn(field)}
                    />
                  </label>
                )
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
