import { describe, expect, test } from "bun:test"

import { findFeatureMappings, selectSmokeProjects } from "./test-suites"

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
      projects: ["smoke-deploy", "smoke-portal"],
      unmappedUiPaths: [],
    })
  })

  test("selects the Billing portal smoke project", () => {
    const selection = selectSmokeProjects([
      "app/[lang]/portal/billing/promotions/page.tsx",
    ])

    expect(selection).toEqual({
      projects: ["smoke-portal"],
      unmappedUiPaths: [],
    })
  })

  test("selects the WhatsApp messages portal smoke project", () => {
    const selection = selectSmokeProjects([
      "app/[lang]/console/whatsapp/messages/page.tsx",
      "app/[lang]/portal/whatsapp/messages/page.tsx",
      "modules/whatsapp/messages/ui/interactive-composer.tsx",
    ])

    expect(selection).toEqual({
      projects: ["smoke-portal"],
      unmappedUiPaths: [],
    })
  })

  test("maps WhatsApp audit sources to their route tests", () => {
    expect(
      findFeatureMappings("app/[lang]/portal/whatsapp/audit-logs/page.tsx")
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "whatsapp-audit-logs",
          sourcePrefixes: [
            "app/[lang]/console/whatsapp/audit-logs/",
            "app/[lang]/portal/whatsapp/audit-logs/",
            "modules/whatsapp/audit/",
          ],
          testPrefixes: [
            "app/[lang]/console/whatsapp/audit-logs/",
            "app/[lang]/portal/whatsapp/audit-logs/",
            "modules/whatsapp/audit/",
          ],
          smokeProjects: ["smoke-portal"],
        }),
      ])
    )
  })
  test("maps WhatsApp templates sources to their template tests", () => {
    expect(
      findFeatureMappings("modules/whatsapp/templates/ui/template-detail.tsx")
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "whatsapp-templates",
          sourcePrefixes: [
            "app/[lang]/console/whatsapp/templates/",
            "app/[lang]/portal/whatsapp/templates/",
            "modules/whatsapp/templates/",
          ],
          testPrefixes: [
            "app/[lang]/console/whatsapp/templates/",
            "app/[lang]/portal/whatsapp/templates/",
            "modules/whatsapp/templates/",
          ],
          smokeProjects: ["smoke-portal"],
        }),
      ])
    )
  })
  test("maps WhatsApp event parsing to its webhook dispatch test", () => {
    expect(findFeatureMappings("lib/whatsapp/handle-event.ts")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "whatsapp-messages",
          testPrefixes: expect.arrayContaining([
            "lib/whatsapp/__tests__/webhook-dispatch.test.ts",
          ]),
        }),
      ])
    )
  })
  test("maps Indonesian locale offer sources to their focused tests", () => {
    expect(
      findFeatureMappings("components/indonesian-locale-control.tsx")
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "indonesian-locale-offer",
          testPrefixes: expect.arrayContaining([
            "components/indonesian-locale-control.test.tsx",
            "lib/i18n/indonesian-locale.test.ts",
          ]),
        }),
      ])
    )
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
