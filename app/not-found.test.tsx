import { describe, expect, it, mock } from "bun:test"
import "@testing-library/jest-dom"
import { render } from "@testing-library/react"

mock.module("next/navigation", () => ({
  useRouter: mock(() => ({ back: mock(), push: mock() })),
  usePathname: mock(() => "/en/unknown-route"),
  useSearchParams: mock(() => new URLSearchParams()),
  useParams: mock(() => ({})),
  redirect: mock(),
  notFound: mock(),
}))

import NotFound from "@/app/not-found"

describe("NotFound", () => {
  it("root NotFound renders GlobalNotFoundView correctly", () => {
    const { getByRole, getByText } = render(<NotFound />)

    expect(getByRole("heading", { name: "Page not found" })).toBeInTheDocument()
    expect(getByText("404 Not Found")).toBeInTheDocument()
  })
})
