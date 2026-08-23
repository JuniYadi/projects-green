import { afterEach, expect, test } from "bun:test"
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const temporaryDirectories: string[] = []
const runnerPath = resolve(import.meta.dir, "run-test-suite.ts")

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

test("coverage runs selected logic tests without discovering spec files", async () => {
  const directory = mkdtempSync(join(tmpdir(), "run-test-suite-"))
  temporaryDirectories.push(directory)

  writeFileSync(join(directory, "covered.ts"), "export const value = 42\n")
  writeFileSync(
    join(directory, "selected.logic.test.ts"),
    [
      'import { expect, test } from "bun:test"',
      'import { value } from "./covered"',
      "",
      'test("covers selected logic", () => {',
      "  expect(value).toBe(42)",
      "})",
      "",
    ].join("\n")
  )
  writeFileSync(
    join(directory, "unselected.spec.ts"),
    'throw new Error("Bun discovery must not execute spec files")\n'
  )

  const proc = Bun.spawn(["bun", "run", runnerPath, "logic", "--coverage"], {
    cwd: directory,
    stdout: "pipe",
    stderr: "pipe",
  })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited
  const lcovPath = join(directory, "coverage", "lcov.info")

  expect(exitCode, `stdout: ${stdout}\nstderr: ${stderr}`).toBe(0)
  expect(existsSync(lcovPath)).toBe(true)
  expect(readFileSync(lcovPath, "utf8")).toContain("covered.ts")
}, 20_000)
