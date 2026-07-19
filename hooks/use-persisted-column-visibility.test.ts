import { describe, expect, test, beforeEach } from "bun:test"
import { renderHook, act } from "@testing-library/react"
import { usePersistedColumnVisibility } from "./use-persisted-column-visibility"

const STORAGE_KEY = "table:column-visibility:test-table"

beforeEach(() => {
  if (typeof localStorage !== "undefined") {
    localStorage.clear()
  }
})

describe("usePersistedColumnVisibility", () => {
  test("returns defaultVisibility on initial render", () => {
    const { result } = renderHook(() =>
      usePersistedColumnVisibility("test-table", { name: true })
    )
    expect(result.current[0]).toEqual({ name: true })
  })

  test("persists to localStorage on change", () => {
    const { result } = renderHook(() =>
      usePersistedColumnVisibility("test-table")
    )
    act(() => {
      result.current[1]({ name: false })
    })
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
    expect(stored).toEqual({ name: false })
  })

  test("restores from localStorage on mount", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ name: false, email: true })
    )
    const { result } = renderHook(() =>
      usePersistedColumnVisibility("test-table", { name: true, email: true })
    )
    expect(result.current[0]).toEqual({ name: false, email: true })
  })

  test("multiple table IDs don't collide", () => {
    const { result: r1 } = renderHook(() =>
      usePersistedColumnVisibility("table-a", { x: true })
    )
    const { result: r2 } = renderHook(() =>
      usePersistedColumnVisibility("table-b", { y: true })
    )
    act(() => {
      r1.current[1]({ x: false })
    })
    expect(r2.current[0]).toEqual({ y: true })
  })

  test("accepts updater function", () => {
    const { result } = renderHook(() =>
      usePersistedColumnVisibility("test-table", { name: true, email: true })
    )
    act(() => {
      result.current[1]((prev) => ({ ...prev, name: false }))
    })
    expect(result.current[0]).toEqual({ name: false, email: true })
  })

  test("no tableId returns plain useState (backward compat)", () => {
    const { result } = renderHook(() =>
      usePersistedColumnVisibility(undefined, { x: true })
    )
    expect(result.current[0]).toEqual({ x: true })
    act(() => {
      result.current[1]({ x: false })
    })
    expect(result.current[0]).toEqual({ x: false })
  })
})
