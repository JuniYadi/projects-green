import { describe, expect, it } from "bun:test"
import { inboxSuggestReplyTool } from "./inbox-suggest-reply.tool"

describe("inboxSuggestReplyTool", () => {
  it("has valid tool metadata", () => {
    expect(inboxSuggestReplyTool.name).toBe("whatsapp.inbox.suggest_reply")
  })
})
