import { describe, expect, it, mock } from "bun:test"
import "@testing-library/jest-dom"
import { render } from "@testing-library/react"

mock.module("next/navigation", () => ({
  useRouter: mock(() => ({ back: mock(), push: mock() })),
  usePathname: mock(() => "/id/unknown-route"),
  useSearchParams: mock(() => new URLSearchParams()),
  useParams: mock(() => ({ lang: "id" })),
  redirect: mock(),
  notFound: mock(),
}))

import LocalizedNotFound from "@/app/[lang]/not-found"

describe("LocalizedNotFound", () => {
  it("renders localized 404 view", () => {
    const { getByRole, getByText } = render(<LocalizedNotFound />)

    expect(
      getByRole("heading", { name: "Halaman tidak ditemukan" })
    ).toBeInTheDocument()
    expect(getByText("404 Tidak Ditemukan")).toBeInTheDocument()
  })
})
