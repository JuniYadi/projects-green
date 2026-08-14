import { describe, expect, test } from "bun:test"

import { parseChangedTestArgs, selectChangedTests } from "./run-changed-tests"

const availableTests = [
  "app/api/deploy/route.test.ts",
  "modules/deploy/deploy.logic.test.ts",
  "modules/deploy/ui/deploy-wizard-v2.test.tsx",
  "modules/example/example.test.ts",
  "modules/example/example.test.tsx",
]

const NESTED_RUN_GUARD = "RUN_CHANGED_TESTS_NO_SPAWN"
const TARGET_TEST = "scripts/test-suites.test.ts"

describe("selectChangedTests", () => {
  test("selects directly changed logic and component tests", () => {
    const selection = selectChangedTests(
      ["modules/example/example.test.ts", "modules/example/example.test.tsx"],
      availableTests
    )

    expect(selection).toEqual({
      testFiles: [
        "modules/example/example.test.ts",
        "modules/example/example.test.tsx",
      ],
      unmappedProductionPaths: [],
    })
  })

  test("selects paired logic and component tests", () => {
    const selection = selectChangedTests(
      ["modules/example/example.ts", "modules/example/example.tsx"],
      availableTests
    )

    expect(selection).toEqual({
      testFiles: [
        "modules/example/example.test.ts",
        "modules/example/example.test.tsx",
      ],
      unmappedProductionPaths: [],
    })
  })

  test("selects all tests mapped to a changed feature", () => {
    const selection = selectChangedTests(
      ["modules/deploy/new-service.ts"],
      availableTests
    )

    expect(selection).toEqual({
      testFiles: [
        "app/api/deploy/route.test.ts",
        "modules/deploy/deploy.logic.test.ts",
        "modules/deploy/ui/deploy-wizard-v2.test.tsx",
      ],
      unmappedProductionPaths: [],
    })
  })

  test("selects billing tests mapped to a billing source path", () => {
    const selection = selectChangedTests(
      ["modules/billing/catalog/catalog-admin.service.ts"],
      [
        "modules/billing/catalog/catalog-admin.route.test.ts",
        "modules/billing/catalog/catalog-admin.service.test.ts",
        "modules/vouchers/vouchers.service.test.ts",
      ]
    )

    expect(selection).toEqual({
      testFiles: [
        "modules/billing/catalog/catalog-admin.route.test.ts",
        "modules/billing/catalog/catalog-admin.service.test.ts",
        "modules/vouchers/vouchers.service.test.ts",
      ],
      unmappedProductionPaths: [],
    })
  })

  test("selects every test when shared setup changes", () => {
    const selection = selectChangedTests(["test/setup.ts"], availableTests)

    expect(selection).toEqual({
      testFiles: [...availableTests].sort(),
      unmappedProductionPaths: [],
    })
  })

  test("selects mapped feature tests during coverage", () => {
    expect(
      selectChangedTests(["modules/example/example.test.tsx"], availableTests, {
        coverage: true,
      })
    ).toEqual({ testFiles: [], unmappedProductionPaths: [] })

    expect(
      selectChangedTests(["modules/deploy/new-service.ts"], availableTests, {
        coverage: true,
      })
    ).toEqual({
      testFiles: [
        "app/api/deploy/route.test.ts",
        "modules/deploy/deploy.logic.test.ts",
        "modules/deploy/ui/deploy-wizard-v2.test.tsx",
      ],
      unmappedProductionPaths: [],
    })
  })

  test("reports changed production paths without a test mapping", () => {
    const selection = selectChangedTests(
      ["modules/unmapped/production.ts"],
      availableTests
    )

    expect(selection).toEqual({
      testFiles: [],
      unmappedProductionPaths: ["modules/unmapped/production.ts"],
    })
  })
})

test("parses explicit targeted-test and unmapped decisions", () => {
  expect(
    parseChangedTestArgs([
      "--coverage",
      "--allow-unmapped",
      "--test",
      "modules/example/example.test.tsx",
      "--test=app/api/deploy/route.test.ts",
    ])
  ).toEqual({
    allowUnmapped: true,
    coverage: true,
    explicitTestFiles: [
      "app/api/deploy/route.test.ts",
      "modules/example/example.test.tsx",
    ],
  })
})

test("parses options after a --test <path> without skipping them", () => {
  expect(
    parseChangedTestArgs([
      "--test",
      "modules/example/example.test.tsx",
      "--allow-unmapped",
    ])
  ).toEqual({
    allowUnmapped: true,
    coverage: false,
    explicitTestFiles: ["modules/example/example.test.tsx"],
  })
})

const runningNested = process.env[NESTED_RUN_GUARD] === "1"

if (!runningNested) {
  test("run() passes --test paths through to the selected test set", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "scripts/run-changed-tests.ts", "--test", TARGET_TEST],
      {
        cwd: import.meta.dir + "/..",
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, [NESTED_RUN_GUARD]: "1" },
      }
    )
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode, `stderr: ${stderr}`).toBe(0)
    expect(stdout).toContain(`test:changed: selected: ${TARGET_TEST}`)
  }, 20_000)
}
