import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import React from "react"

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      "email-templates": {
        get: mock(() =>
          Promise.resolve({
            data: {
              ok: true,
              data: [
                {
                  id: "welcome-email",
                  name: "Welcome Email",
                  category: "Auth",
                  subject: "Welcome to PFN",
                  from: "support@yourapp.com",
                },
              ],
            },
            error: null,
          })
        ),
      },
    },
  },
}))

import { EmailsView } from "./emails-view"

describe("EmailsView", () => {
  it("renders emails view component", () => {
    const { container } = render(<EmailsView />)
    expect(container).toBeDefined()
  })
})
