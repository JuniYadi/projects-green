import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { DomainManagement } from "./domain-management"

const quota = {
  used: 1,
  maxCustomDomains: 2,
  allowWildcardDomain: true,
  allowCustomTls: true,
}

describe("DomainManagement", () => {
  it("shows custom domain quota usage", () => {
    const view = render(
      <DomainManagement
        quota={quota}
        cloudflareCredentials={[]}
        onAddDomain={() => {}}
      />
    )

    expect(view.getByText("Custom domain quota")).toBeTruthy()
    expect(view.getByText("1 of 2 custom domains in use")).toBeTruthy()
  })

  it("shows active Cloudflare credentials for wildcard domains", async () => {
    const user = userEvent.setup()
    const view = render(
      <DomainManagement
        quota={quota}
        cloudflareCredentials={[
          {
            id: "active",
            name: "Production",
            type: "CLOUDFLARE_API_TOKEN",
            status: "ACTIVE",
          },
          {
            id: "revoked",
            name: "Old token",
            type: "CLOUDFLARE_API_TOKEN",
            status: "REVOKED",
          },
        ]}
        onAddDomain={() => {}}
      />
    )

    await user.click(view.getByRole("switch", { name: "Wildcard domain" }))
    expect(view.getByText("Cloudflare API token")).toBeTruthy()
    await user.click(view.getByRole("combobox"))
    expect(view.getAllByText("Production").length).toBeGreaterThan(0)
    expect(view.queryByText("Old token")).toBeNull()
  })
})
