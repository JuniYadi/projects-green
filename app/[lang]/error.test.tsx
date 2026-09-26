import { describe, expect, it, mock } from "bun:test"
import "@testing-library/jest-dom"
import { render } from "@testing-library/react"

mock.module("next/navigation", () => ({
  useRouter: mock(() => ({ back: mock(), push: mock() })),
  usePathname: mock(() => "/id/some-route"),
  useSearchParams: mock(() => new URLSearchParams()),
  useParams: mock(() => ({ lang: "id" })),
  redirect: mock(),
  notFound: mock(),
}))

import LocalizedError from "@/app/[lang]/error"

describe("LocalizedError", () => {
  it("renders localized error view", () => {
    const reset = mock()
    const error = new Error("Something broke")

    const { getByRole, getByText } = render(
      <LocalizedError error={error} reset={reset} />
    )

    expect(
      getByRole("heading", { name: "Terjadi kesalahan" })
    ).toBeInTheDocument()
    expect(getByText("500 Terjadi Kesalahan")).toBeInTheDocument()
  })
})
