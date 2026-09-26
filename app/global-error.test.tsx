import { describe, expect, it, mock } from "bun:test"
import "@testing-library/jest-dom"
import { render } from "@testing-library/react"

mock.module("next/navigation", () => ({
  useRouter: mock(() => ({ back: mock(), push: mock() })),
  usePathname: mock(() => "/"),
  useSearchParams: mock(() => new URLSearchParams()),
  useParams: mock(() => ({})),
  redirect: mock(),
  notFound: mock(),
}))

import GlobalError from "@/app/global-error"

describe("GlobalError", () => {
  it("renders global error view wrapped in html body", () => {
    const reset = mock()
    const error = new Error("Global layout crash")

    const { getByRole, getByText } = render(
      <GlobalError error={error} reset={reset} />
    )

    expect(
      getByRole("heading", { name: "Something went wrong" })
    ).toBeInTheDocument()
    expect(getByText("500 Application Error")).toBeInTheDocument()
  })
})
