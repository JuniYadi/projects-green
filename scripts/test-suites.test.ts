import { describe, expect, test } from "bun:test"

import { selectSmokeProjects } from "./test-suites"

describe("selectSmokeProjects", () => {
  test("selects the mapped Deploy smoke project", () => {
    const selection = selectSmokeProjects([
      "modules/deploy/ui/deploy-wizard-v2.tsx",
    ])

    expect(selection).toEqual({
      projects: ["smoke-deploy"],
      unmappedUiPaths: [],
    })
  })

  test("selects every smoke project for shared UI changes", () => {
    const selection = selectSmokeProjects(["components/ui/button.tsx"])

    expect(selection).toEqual({
      projects: ["smoke-deploy"],
      unmappedUiPaths: [],
    })
  })

  test("reports an unmapped UI feature instead of running nothing", () => {
    const selection = selectSmokeProjects([
      "modules/new-feature/ui/new-page.tsx",
    ])

    expect(selection).toEqual({
      projects: [],
      unmappedUiPaths: ["modules/new-feature/ui/new-page.tsx"],
    })
  })

  test("ignores logic-only changes", () => {
    const selection = selectSmokeProjects(["modules/deploy/deploy.logic.ts"])

    expect(selection).toEqual({
      projects: [],
      unmappedUiPaths: [],
    })
  })
})
