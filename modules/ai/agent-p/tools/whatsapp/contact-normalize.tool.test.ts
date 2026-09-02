import { describe, expect, it } from "bun:test"
import { contactNormalizeTool } from "./contact-normalize.tool"
import type { AgentPContext } from "../../types"

const context: AgentPContext = {
  session: { organizationId: "org-1", userId: "user-1", role: "USER" },
}

describe("contactNormalizeTool", () => {
  it("normalizes phone numbers correctly", () => {
    expect(
      contactNormalizeTool.execute(
        { phoneNumber: "0812-345-678", defaultCountryCode: "62" },
        context
      )
    ).toEqual({
      input: "0812-345-678",
      normalized: "+62812345678",
      isValid: true,
    })
  })
})
