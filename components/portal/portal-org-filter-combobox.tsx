"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Buildings,
  CaretUpDown,
  Check,
  MagnifyingGlass,
  Spinner,
  X,
} from "@/components/ui/phosphor-icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { eden } from "@/lib/eden"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { cn } from "@/lib/utils"

export interface PortalOrgFilterComboboxProps {
  value?: string | null
  onChange?: (organizationId: string | null) => void
  className?: string
  placeholder?: string
  allLabel?: string
  searchPlaceholder?: string
  emptyMessage?: string
  loadingMessage?: string
  clearLabel?: string
  disabled?: boolean
  id?: string
  locale?: string
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
  allLabel,
  searchPlaceholder,
  emptyMessage,
  loadingMessage,
  clearLabel,
  disabled = false,
  id,
  locale,
}: PortalOrgFilterComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [initialOrgs, setInitialOrgs] = React.useState<OrganizationOption[]>([])
  const [searchResults, setSearchResults] = React.useState<
    OrganizationOption[]
  >([])
  const [resolvedOrg, setResolvedOrg] =
    React.useState<OrganizationOption | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSearching, setIsSearching] = React.useState(false)
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
  const highlightedIndexRef = React.useRef(highlightedIndex)

  const inputRef = React.useRef<HTMLInputElement>(null)

  const defaultDetectedLocale =
    typeof window !== "undefined"
      ? window.location.pathname.split("/")[1]
      : undefined
  const activeLocale = resolveLocaleOrDefault(locale ?? defaultDetectedLocale)
  const messages = getMessages(activeLocale).sharedComponents.orgFilterCombobox

  const effectiveAllLabel = allLabel ?? messages.allLabel
  const effectivePlaceholder = placeholder ?? messages.placeholder
  const effectiveSearchPlaceholder =
    searchPlaceholder ?? messages.searchPlaceholder
  const effectiveEmptyMessage = emptyMessage ?? messages.empty
  const effectiveLoadingMessage = loadingMessage ?? messages.loading
  const effectiveClearLabel = clearLabel ?? messages.clearFilterAriaLabel
  const effectiveClearSearchLabel = messages.clearSearchAriaLabel
  const effectiveSearchAriaLabel = messages.searchAriaLabel
  const effectiveListAriaLabel = messages.listAriaLabel

  React.useEffect(() => {
    highlightedIndexRef.current = highlightedIndex
  }, [highlightedIndex])

  // Initial load: 15 organizations
  React.useEffect(() => {
    let isMounted = true

    async function loadOrganizations() {
      try {
        const response = await eden.api.admin.organizations.get({
          $query: { limit: 15 },
        })

        if (!isMounted) return

        if (response && "data" in response && response.data) {
          const raw = extractOrganizations(response.data)
          const orgList = raw.map((item) => ({
            id: String(item.id),
            name: String(item.name || item.id),
          }))
          setInitialOrgs(orgList)
        } else {
          setInitialOrgs([])
        }
      } catch {
        if (isMounted) {
          setInitialOrgs([])
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

  // Resolve organization name when value is not in initial batch
  React.useEffect(() => {
    const orgValue = value
    if (isLoading || !orgValue) {
      return
    }

    const targetOrgId: string = orgValue
    const alreadyInInitial = initialOrgs.some((org) => org.id === targetOrgId)
    if (alreadyInInitial || resolvedOrg?.id === targetOrgId) {
      return
    }

    let isMounted = true

    async function resolveOrganization() {
      try {
        const response = await eden.api.admin.organizations.get({
          $query: { limit: 1, search: targetOrgId },
        })

        if (!isMounted) return

        if (response && "data" in response && response.data) {
          const raw = extractOrganizations(response.data)
          const matched = raw.find((item) => item.id === targetOrgId) ?? raw[0]
          if (matched && matched.id === targetOrgId) {
            setResolvedOrg({
              id: String(matched.id),
              name: String(matched.name || matched.id),
            })
          }
        }
      } catch {
        // Keep raw value fallback
      }
    }

    void resolveOrganization()

    return () => {
      isMounted = false
    }
  }, [isLoading, value, initialOrgs, resolvedOrg?.id])

  // Debounce search query (250ms)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 250)

    return () => {
      clearTimeout(timer)
    }
  }, [search])

  // Fetch search results when debounced query changes
  React.useEffect(() => {
    const trimmed = debouncedSearch.trim()
    if (!trimmed) {
      return
    }

    let isMounted = true

    async function searchOrganizations() {
      setIsSearching(true)
      try {
        const response = await eden.api.admin.organizations.get({
          $query: { limit: 15, search: trimmed },
        })

        if (!isMounted) return

        if (response && "data" in response && response.data) {
          const raw = extractOrganizations(response.data)
          const orgList = raw.map((item) => ({
            id: String(item.id),
            name: String(item.name || item.id),
          }))
          setSearchResults(orgList)
        } else {
          setSearchResults([])
        }
      } catch {
        if (isMounted) {
          setSearchResults([])
        }
      } finally {
        if (isMounted) {
          setIsSearching(false)
        }
      }
    }

    void searchOrganizations()

    return () => {
      isMounted = false
    }
  }, [debouncedSearch])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setSearch("")
      setDebouncedSearch("")
      setSearchResults([])
      setIsSearching(false)
      setHighlightedIndex(-1)
      highlightedIndexRef.current = -1
    }
  }

  const selectedOrg = React.useMemo(() => {
    if (!value) return null
    return (
      searchResults.find((org) => org.id === value) ??
      initialOrgs.find((org) => org.id === value) ??
      (resolvedOrg?.id === value ? resolvedOrg : null)
    )
  }, [searchResults, initialOrgs, resolvedOrg, value])

  const displayText = React.useMemo(() => {
    if (selectedOrg) {
      return selectedOrg.name
    }
    if (value) {
      return value
    }
    return effectivePlaceholder ?? effectiveAllLabel
  }, [selectedOrg, value, effectivePlaceholder, effectiveAllLabel])

  const displayOrgs = React.useMemo(() => {
    if (debouncedSearch.trim()) {
      return searchResults
    }
    if (
      resolvedOrg &&
      value === resolvedOrg.id &&
      !initialOrgs.some((org) => org.id === resolvedOrg.id)
    ) {
      return [resolvedOrg, ...initialOrgs]
    }
    return initialOrgs
  }, [debouncedSearch, searchResults, initialOrgs, resolvedOrg, value])

  const normalizedSearch = search.trim().toLowerCase()

  const filteredOrgs = React.useMemo(() => {
    if (!normalizedSearch) return displayOrgs
    return displayOrgs.filter(
      (org) =>
        org.name.toLowerCase().includes(normalizedSearch) ||
        org.id.toLowerCase().includes(normalizedSearch)
    )
  }, [displayOrgs, normalizedSearch])

  const showAllOption = React.useMemo(() => {
    if (displayOrgs.length === 0 && !normalizedSearch) return false
    if (!normalizedSearch) return true
    return effectiveAllLabel.toLowerCase().includes(normalizedSearch)
  }, [effectiveAllLabel, normalizedSearch, displayOrgs.length])

  const totalOptions = (showAllOption ? 1 : 0) + filteredOrgs.length
  const showEmptyState =
    !isLoading &&
    !isSearching &&
    (displayOrgs.length === 0 || (filteredOrgs.length === 0 && !showAllOption))

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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearch(val)
    if (!val.trim()) {
      setDebouncedSearch("")
      setSearchResults([])
      setIsSearching(false)
    }
  }

  const handleClearSearch = () => {
    setSearch("")
    setDebouncedSearch("")
    setSearchResults([])
    setIsSearching(false)
  }

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

  const isSearchPending =
    isSearching || (search.trim() !== "" && search !== debouncedSearch)

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
                aria-label={effectiveClearLabel}
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
          {isSearchPending ? (
            <Spinner
              data-testid="search-spinner"
              className="size-4 shrink-0 animate-spin text-muted-foreground"
            />
          ) : (
            <MagnifyingGlass className="size-4 shrink-0 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            placeholder={effectiveSearchPlaceholder}
            aria-label={effectiveSearchAriaLabel}
            className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button
              type="button"
              aria-label={effectiveClearSearchLabel}
              onClick={handleClearSearch}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div
          role="listbox"
          aria-label={effectiveListAriaLabel}
          className="max-h-60 overflow-y-auto p-1"
        >
          {isLoading ? (
            <div
              role="status"
              className="flex items-center justify-center p-4 text-sm text-muted-foreground"
            >
              {effectiveLoadingMessage}
            </div>
          ) : showEmptyState ? (
            <div
              role="status"
              className="p-4 text-center text-sm text-muted-foreground"
            >
              {effectiveEmptyMessage}
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
                    <span className="truncate">{effectiveAllLabel}</span>
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
