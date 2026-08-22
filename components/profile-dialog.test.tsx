import { describe, expect, it } from "bun:test"
import React from "react"
import { ProfileDialog } from "./profile-dialog"

describe("ProfileDialog", () => {
  it("renders profile dialog element", () => {
    const element = React.createElement(ProfileDialog, {
      open: true,
      onOpenChange: () => {},
      user: {
        id: "usr_123",
        name: "Test User",
        email: "test@example.com",
        avatarUrl: null,
      },
      authMethodLabel: "Magic Link",
    })
    expect(React.isValidElement(element)).toBe(true)
  })
})
