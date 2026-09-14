import { describe, expect, it, mock } from "bun:test"
import React from "react"
import InvitationsPage, { metadata } from "./page"

mock.module("./invitations-table", () => ({
  InvitationsTable: () =>
    React.createElement("div", { "data-testid": "invitations-table" }),
}))

describe("InvitationsPage", () => {
  it("exports page metadata", () => {
    expect(metadata.title).toBe("Invitations")
  })

  it("renders page without crashing", async () => {
    const element = await InvitationsPage()
    expect(React.isValidElement(element)).toBe(true)
  })
})
