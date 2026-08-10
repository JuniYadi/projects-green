import { describe, expect, test } from "bun:test"

import { parseChangedTestArgs, selectChangedTests } from "./run-changed-tests"

const availableTests = [
  "app/api/deploy/route.test.ts",
  "modules/deploy/deploy.logic.test.ts",
  "modules/deploy/ui/deploy-wizard-v2.test.tsx",
  "modules/example/example.test.ts",
  "modules/example/example.test.tsx",
]

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

  test("selects every test when shared setup changes", () => {
    const selection = selectChangedTests(["test/setup.ts"], availableTests)

    expect(selection).toEqual({
      testFiles: [...availableTests].sort(),
      unmappedProductionPaths: [],
    })
  })

  test("keeps coverage direct-test selection tied to changed source", () => {
    expect(
      selectChangedTests(["modules/example/example.test.tsx"], availableTests, {
        coverage: true,
      })
    ).toEqual({ testFiles: [], unmappedProductionPaths: [] })

    expect(
      selectChangedTests(
        ["modules/example/example.tsx", "modules/example/example.test.tsx"],
        availableTests,
        { coverage: true }
      )
    ).toEqual({
      testFiles: ["modules/example/example.test.tsx"],
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
