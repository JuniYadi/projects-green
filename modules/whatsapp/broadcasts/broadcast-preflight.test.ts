import { describe, expect, it } from "bun:test"
import {
  formatBroadcastVariableValidationError,
  validateBroadcastRecipientVariables,
} from "./broadcast-preflight"

describe("validateBroadcastRecipientVariables", () => {
  it("passes a zero-variable template without requiring a mapping", () => {
    expect(
      validateBroadcastRecipientVariables({
        templateBody: "Pesan tanpa variabel.",
        recipients: [{}, {}],
      })
    ).toEqual({
      requiredVariables: [],
      missingByRecipient: [],
      unknownColumns: [],
      excessColumns: [],
      isValid: true,
    })
  })

  it("accepts every required variable for each recipient", () => {
    expect(
      validateBroadcastRecipientVariables({
        templateBody: "Halo {{2}}, pesanan {{1}} siap.",
        recipients: [
          { dynamicValues: { "{{1}}": "A-1", "{{2}}": "Ayu" } },
          { dynamicValues: { "1": "B-1", "2": "Budi" } },
        ],
      }).isValid
    ).toBe(true)
  })

  it("reports the recipient and exact variable when a required value is missing", () => {
    const validation = validateBroadcastRecipientVariables({
      templateBody: "Halo {{1}} dan {{2}}",
      recipients: [{ dynamicValues: { "{{1}}": "Ayu", "{{2}}": "" } }],
    })

    expect(validation.missingByRecipient).toEqual([
      { recipientIndex: 0, variables: ["{{2}}"] },
    ])
    expect(formatBroadcastVariableValidationError(validation)).toContain(
      "Recipient 1 is missing {{2}}"
    )
  })

  it("reports unknown and excess CSV-style columns", () => {
    const validation = validateBroadcastRecipientVariables({
      templateBody: "Halo {{1}}",
      recipients: [
        {
          dynamicValues: {
            "{{1}}": "Ayu",
            "{{2}}": "Tidak dipakai",
            Kota: "Jakarta",
          },
        },
      ],
    })

    expect(validation.unknownColumns).toEqual(["Kota"])
    expect(validation.excessColumns).toEqual(["{{2}}"])
    expect(formatBroadcastVariableValidationError(validation)).toContain(
      "Rename them to the required {{N}} headers"
    )
  })
})
