import { describe, expect, it } from "bun:test"

import { cn } from "@/lib/utils"

import { fixtureLabel } from "./fixture-label"

describe("Super-Linter TypeScript fixture", () => {
  it("supports Bun, aliases, and relative imports", () => {
    expect(cn(fixtureLabel, "fixture")).toBe("super-linter fixture")
  })
})
