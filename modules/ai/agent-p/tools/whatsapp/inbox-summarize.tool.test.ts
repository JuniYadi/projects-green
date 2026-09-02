import { describe, expect, it } from "bun:test"
import { inboxSummarizeTool } from "./inbox-summarize.tool"

describe("inboxSummarizeTool", () => {
  it("has valid tool metadata", () => {
    expect(inboxSummarizeTool.name).toBe("whatsapp.inbox.summarize")
  })
})
