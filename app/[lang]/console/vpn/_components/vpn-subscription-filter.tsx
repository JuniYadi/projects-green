"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MagnifyingGlassIcon } from "@phosphor-icons/react"

export type FilterState = {
  regionSlug: string | null
  search: string
}

export type RegionOption = {
  slug: string
  name: string
  countryCode: string
}

type Props = {
  regions: RegionOption[]
  onFilterChange: (filters: FilterState) => void
}

/** ponytail: ~300ms debounce via setTimeout, not a lib. */
export function VpnSubscriptionFilter({ regions, onFilterChange }: Props) {
  const [regionSlug, setRegionSlug] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const timerRef = useRef<Timer | null>(null)

  const emit = useCallback(
    (nextRegion: string | null, nextSearch: string) => {
      onFilterChange({ regionSlug: nextRegion, search: nextSearch })
    },
    [onFilterChange],
  )

  const handleRegionChange = (value: string) => {
    const next = value === "__all__" ? null : value
    setRegionSlug(next)
    emit(next, search)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearch(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => emit(regionSlug, val), 300)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Select value={regionSlug ?? "__all__"} onValueChange={handleRegionChange}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="All Regions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Regions</SelectItem>
          {regions.map((r) => (
            <SelectItem key={r.slug} value={r.slug}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative flex-1">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search server..."
          value={search}
          onChange={handleSearchChange}
        />
      </div>
    </div>
  )
}
