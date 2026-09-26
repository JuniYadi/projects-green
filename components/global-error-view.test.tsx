import { describe, expect, it, mock } from "bun:test"
import "@testing-library/jest-dom"
import { fireEvent, render } from "@testing-library/react"

mock.module("next/navigation", () => ({
  useRouter: mock(() => ({ back: mock(), push: mock() })),
  usePathname: mock(() => "/en/some-page"),
  useSearchParams: mock(() => new URLSearchParams()),
  useParams: mock(() => ({})),
  redirect: mock(),
  notFound: mock(),
}))

import { GlobalErrorView } from "@/components/global-error-view"

describe("GlobalErrorView", () => {
  it("renders 500 error heading and retry button", () => {
    const reset = mock()
    const error = new Error("Database connection failed")

    const { getByRole, getByText } = render(
      <GlobalErrorView error={error} reset={reset} />
    )

    expect(
      getByRole("heading", { name: "Something went wrong" })
    ).toBeInTheDocument()
    expect(getByText("500 Application Error")).toBeInTheDocument()

    const retryButton = getByRole("button", { name: /Try again/i })
    fireEvent.click(retryButton)
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it("displays digest if present on error object", () => {
    const reset = mock()
    const error = Object.assign(new Error("Crash"), { digest: "12345678" })

    const { getByText } = render(
      <GlobalErrorView error={error} reset={reset} />
    )

    expect(getByText("12345678")).toBeInTheDocument()
    expect(getByText(/Error reference:/i)).toBeInTheDocument()
  })

  it("renders Indonesian copy when forcedLocale is id", () => {
    const reset = mock()
    const error = new Error("Crash")

    const { getByRole, getByText } = render(
      <GlobalErrorView error={error} reset={reset} forcedLocale="id" />
    )

    expect(
      getByRole("heading", { name: "Terjadi kesalahan" })
    ).toBeInTheDocument()
    expect(getByText("500 Terjadi Kesalahan")).toBeInTheDocument()
    expect(getByRole("link", { name: "Kembali ke beranda" })).toHaveAttribute(
      "href",
      "/id"
    )
  })
})
