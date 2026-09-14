import { describe, expect, it, mock } from "bun:test"
import React from "react"
import UsersPage, { metadata } from "./page"

mock.module("./users-table", () => ({
  UsersTable: () =>
    React.createElement("div", { "data-testid": "users-table" }),
}))

describe("UsersPage", () => {
  it("exports page metadata", () => {
    expect(metadata.title).toBe("Users")
  })

  it("renders page without crashing", async () => {
    const element = await UsersPage()
    expect(React.isValidElement(element)).toBe(true)
  })
})
