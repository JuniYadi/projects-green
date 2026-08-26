import "@/test/register"
import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import React from "react"

const notFound = mock(() => {})
const control = mock(
  ({
    locale,
    messages,
  }: {
    locale: string
    messages: { controlLabel: string }
  }) => (
    <div data-testid="language-control" data-locale={locale}>
      {messages.controlLabel}
    </div>
  )
)

mock.module("next/navigation", () => ({ notFound }))
mock.module("@/components/indonesian-locale-control", () => ({
  IndonesianLocaleControl: control,
}))

const { default: LocaleLayout } = await import("./layout")
const { default: ConsoleAppLayout } = await import("./console/app/layout")

describe("LocaleLayout", () => {
  it("renders the global language control with a public route", async () => {
    const view = render(
      await LocaleLayout({
        children: <main>Public content</main>,
        params: Promise.resolve({ lang: "en" }),
      })
    )

    expect(view.getByRole("main")).toHaveTextContent("Public content")
    expect(view.getByTestId("language-control")).toHaveAttribute(
      "data-locale",
      "en"
    )
  })

  it("keeps the global control around an authenticated console layout path", async () => {
    const view = render(
      await LocaleLayout({
        children: (
          <ConsoleAppLayout>
            <div>Authenticated console content</div>
          </ConsoleAppLayout>
        ),
        params: Promise.resolve({ lang: "id" }),
      })
    )

    expect(view.getByRole("main")).toHaveTextContent(
      "Authenticated console content"
    )
    expect(view.getByTestId("language-control")).toHaveAttribute(
      "data-locale",
      "id"
    )
  })
})
