import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

describe("Card", () => {
  it("renders all card slots", () => {
    const view = render(
      <Card size="sm">
        <CardHeader>
          <CardTitle>Deploy status</CardTitle>
          <CardDescription>Last updated now</CardDescription>
          <CardAction>Action</CardAction>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    )

    expect(
      view.container.querySelector('[data-slot="card"]')
    ).toBeInTheDocument()
    expect(
      view.container.querySelector('[data-slot="card-header"]')
    ).toBeInTheDocument()
    expect(
      view.container.querySelector('[data-slot="card-action"]')
    ).toBeInTheDocument()
    expect(view.getByText("Deploy status")).toBeInTheDocument()
    expect(view.getByText("Body")).toBeInTheDocument()
    expect(view.getByText("Footer")).toBeInTheDocument()
  })
})
