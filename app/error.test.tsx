import { describe, expect, it, mock } from "bun:test"
import "@testing-library/jest-dom"
import { render } from "@testing-library/react"

mock.module("next/navigation", () => ({
  useRouter: mock(() => ({ back: mock(), push: mock() })),
  usePathname: mock(() => "/en/some-route"),
  useSearchParams: mock(() => new URLSearchParams()),
  useParams: mock(() => ({})),
  redirect: mock(),
  notFound: mock(),
}))

import ErrorPage from "@/app/error"

describe("ErrorPage", () => {
  it("root ErrorPage renders error heading and retry", () => {
    const reset = mock()
    const error = new Error("Something broke")

    const { getByRole, getByText } = render(
      <ErrorPage error={error} reset={reset} />
    )

    expect(
      getByRole("heading", { name: "Something went wrong" })
    ).toBeInTheDocument()
    expect(getByText("500 Application Error")).toBeInTheDocument()
  })
})
