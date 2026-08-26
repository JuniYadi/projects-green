import "@/test/register"
import { afterEach, expect, mock, test } from "bun:test"
import { render } from "@testing-library/react"

let currentLocale = "en"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: currentLocale }),
}))

import { AccessRestricted } from "./access-restricted"

const originalLanguage = document.documentElement.lang

afterEach(() => {
  currentLocale = "en"
  document.documentElement.lang = originalLanguage
})

test("renders English access guidance with the current and required roles", () => {
  document.documentElement.lang = "en"

  const view = render(
    <AccessRestricted
      required="ADMIN"
      current="MEMBER"
      action="Ask an administrator for access."
    />
  )

  expect(view.getByText("Access restricted")).toBeInTheDocument()
  expect(view.getByText("Current role: MEMBER")).toBeInTheDocument()
  expect(view.getByText("Required role: ADMIN")).toBeInTheDocument()
  expect(view.getByText("Ask an administrator for access.")).toBeInTheDocument()
})

test("renders Indonesian access guidance when the route and document use Indonesian", () => {
  currentLocale = "id"
  document.documentElement.lang = "id"

  const view = render(
    <AccessRestricted
      required="ADMIN"
      current={null}
      action="Hubungi administrator untuk mendapatkan akses."
    />
  )

  expect(view.getByText("Akses dibatasi")).toBeInTheDocument()
  expect(view.getByText("Peran saat ini: none")).toBeInTheDocument()
  expect(view.getByText("Peran yang diperlukan: ADMIN")).toBeInTheDocument()
  expect(
    view.getByText("Hubungi administrator untuk mendapatkan akses.")
  ).toBeInTheDocument()
})
