"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Buildings,
  CaretUpDown,
  Check,
  MagnifyingGlass,
  X,
} from "@/components/ui/phosphor-icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { eden } from "@/lib/eden"
import { cn } from "@/lib/utils"

export interface PortalOrgFilterComboboxProps {
  value?: string | null
  onChange?: (organizationId: string | null) => void
  className?: string
  placeholder?: string
  allLabel?: string
  disabled?: boolean
  id?: string
}

export interface OrganizationOption {
  id: string
  name: string
}

function extractOrganizations(data: unknown): OrganizationOption[] {
  if (!data || typeof data !== "object") return []
  const record = data as Record<string, unknown>

  if (Array.isArray(record.organizations)) {
    return record.organizations as OrganizationOption[]
  }

  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>
    if (Array.isArray(nested.organizations)) {
      return nested.organizations as OrganizationOption[]
    }
    if (Array.isArray(record.data)) {
      return record.data as OrganizationOption[]
    }
  }

  if (Array.isArray(data)) {
    return data as OrganizationOption[]
  }

  return []
}

export function PortalOrgFilterCombobox({
  value,
  onChange,
  className,
  placeholder,
  allLabel = "All Organizations",
  disabled = false,
  id,
}: PortalOrgFilterComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [organizations, setOrganizations] = React.useState<
    OrganizationOption[]
  >([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
  const highlightedIndexRef = React.useRef(highlightedIndex)

  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    highlightedIndexRef.current = highlightedIndex
  }, [highlightedIndex])

  React.useEffect(() => {
    let isMounted = true

    async function loadOrganizations() {
      try {
        const response = await eden.api.admin.organizations.get({
          $query: { limit: 100 },
        })

        if (!isMounted) return

        if (response && "data" in response && response.data) {
          const raw = extractOrganizations(response.data)
          const orgList = raw.map((item) => ({
            id: String(item.id),
            name: String(item.name || item.id),
          }))
          setOrganizations(orgList)
        } else {
          setOrganizations([])
        }
      } catch {
        if (isMounted) {
          setOrganizations([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadOrganizations()

    return () => {
      isMounted = false
    }
  }, [])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setSearch("")
      setHighlightedIndex(-1)
      highlightedIndexRef.current = -1
    }
  }

  const selectedOrg = React.useMemo(() => {
    if (!value) return null
    return organizations.find((org) => org.id === value) ?? null
  }, [organizations, value])

  const displayText = React.useMemo(() => {
    if (selectedOrg) {
      return selectedOrg.name
    }
    if (value) {
      return value
    }
    return placeholder ?? allLabel
  }, [selectedOrg, value, placeholder, allLabel])

  const normalizedSearch = search.trim().toLowerCase()

  const filteredOrgs = React.useMemo(() => {
    if (!normalizedSearch) return organizations
    return organizations.filter(
      (org) =>
        org.name.toLowerCase().includes(normalizedSearch) ||
        org.id.toLowerCase().includes(normalizedSearch)
    )
  }, [organizations, normalizedSearch])

  const showAllOption = React.useMemo(() => {
    if (organizations.length === 0) return false
    if (!normalizedSearch) return true
    return allLabel.toLowerCase().includes(normalizedSearch)
  }, [allLabel, normalizedSearch, organizations.length])

  const totalOptions = (showAllOption ? 1 : 0) + filteredOrgs.length
  const showEmptyState =
    !isLoading &&
    (organizations.length === 0 ||
      (filteredOrgs.length === 0 && !showAllOption))

  const handleSelect = React.useCallback(
    (orgId: string | null) => {
      onChange?.(orgId)
      setOpen(false)
    },
    [onChange]
  )

  const handleClear = React.useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation()
      e.preventDefault()
      onChange?.(null)
    },
    [onChange]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((prev) => {
        const next = prev < totalOptions - 1 ? prev + 1 : 0
        highlightedIndexRef.current = next
        return next
      })
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : totalOptions - 1
        highlightedIndexRef.current = next
        return next
      })
    } else if (e.key === "Enter") {
      e.preventDefault()
      const currentIndex = highlightedIndexRef.current
      if (currentIndex >= 0) {
        if (showAllOption && currentIndex === 0) {
          handleSelect(null)
        } else {
          const orgIndex = showAllOption ? currentIndex - 1 : currentIndex
          if (filteredOrgs[orgIndex]) {
            handleSelect(filteredOrgs[orgIndex].id)
          }
        }
      } else if (totalOptions === 1) {
        if (showAllOption) {
          handleSelect(null)
        } else if (filteredOrgs[0]) {
          handleSelect(filteredOrgs[0].id)
        }
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={displayText}
          aria-busy={isLoading}
          disabled={disabled}
          className={cn(
            "h-9 w-64 justify-between gap-2 px-3 text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <div className="flex min-w-0 items-center gap-2 truncate">
            <Buildings className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{displayText}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear filter"
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleClear(e)
                  }
                }}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </span>
            )}
            <CaretUpDown className="size-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] min-w-[260px] p-0"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <MagnifyingGlass className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search organization..."
            aria-label="Search organization"
            className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div
          role="listbox"
          aria-label="Organizations"
          className="max-h-60 overflow-y-auto p-1"
        >
          {isLoading ? (
            <div
              role="status"
              className="flex items-center justify-center p-4 text-sm text-muted-foreground"
            >
              Loading organizations...
            </div>
          ) : showEmptyState ? (
            <div
              role="status"
              className="p-4 text-center text-sm text-muted-foreground"
            >
              No organizations found.
            </div>
          ) : (
            <>
              {showAllOption && (
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  onClick={() => handleSelect(null)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors outline-none",
                    highlightedIndex === 0
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/70",
                    !value && "font-medium"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2 truncate">
                    <Buildings className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{allLabel}</span>
                  </div>
                  {!value && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              )}

              {filteredOrgs.map((org, idx) => {
                const isSelected = value === org.id
                const itemIndex = showAllOption ? idx + 1 : idx
                return (
                  <button
                    key={org.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(org.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors outline-none",
                      highlightedIndex === itemIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted/70",
                      isSelected && "font-medium"
                    )}
                  >
                    <div className="flex min-w-0 flex-col items-start truncate pr-2 text-left">
                      <div className="flex items-center gap-2 truncate">
                        <Buildings className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{org.name}</span>
                      </div>
                      {org.id !== org.name && (
                        <span className="pl-6 text-xs text-muted-foreground">
                          {org.id}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                )
              })}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
