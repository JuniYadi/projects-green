import { describe, expect, test } from "bun:test"
import { collectChangedTsFiles } from "./typecheck-changed"

describe("collectChangedTsFiles", () => {
  test("filters out non-ts files, declaration files, and non-existent files", () => {
    const files = [
      "package.json",
      "README.md",
      "scripts/changed-files.ts",
      "scripts/typecheck-changed.ts",
      "types/matchers.d.ts",
      "non-existent-file.ts",
    ]

    const result = collectChangedTsFiles(files)

    expect(result).toContain("scripts/changed-files.ts")
    expect(result).toContain("scripts/typecheck-changed.ts")
    expect(result).not.toContain("package.json")
    expect(result).not.toContain("README.md")
    expect(result).not.toContain("types/matchers.d.ts")
    expect(result).not.toContain("non-existent-file.ts")
  })

  test("handles empty list", () => {
    const result = collectChangedTsFiles([])
    expect(result).toEqual([])
  })
})
