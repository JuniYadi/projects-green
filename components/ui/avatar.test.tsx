import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"

describe("Avatar", () => {
  it("renders avatar variants and group helpers", () => {
    const view = render(
      <AvatarGroup>
        <Avatar size="lg">
          <AvatarImage src="https://example.test/me.png" alt="Jane" />
          <AvatarFallback>JA</AvatarFallback>
          <AvatarBadge data-testid="badge">!</AvatarBadge>
        </Avatar>
        <Avatar>
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+2</AvatarGroupCount>
      </AvatarGroup>
    )

    expect(
      view.container.querySelector('[data-slot="avatar-group"]')
    ).toBeInTheDocument()
    expect(view.getByText("JA")).toBeInTheDocument()
    expect(view.getByText("+2")).toBeInTheDocument()
  })
})
