import { describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

// ─── Mock functions ─────────────────────────────────────────────────────────

mock.module("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

mock.module("@/lib/i18n/messages", () => ({
  getMessages: () => ({
    console: {
      app: {
        overview: {
          heading: "App Platform",
          description: "Deploy and manage your applications.",
          deploy: "Deploy",
          deployDescription:
            "Configure source, build, and initial release settings.",
          manage: "Manage",
          manageDescription:
            "Monitor deployment status, view events, and inspect logs for your apps.",
          credentials: "Credentials",
          credentialsDescription:
            "Manage connected integrations and API tokens for your application.",
        },
      },
    },
  }),
}))

mock.module("@/lib/i18n/pathname", () => ({
  localizePathname: (opts: { pathname: string; locale: string }) =>
    `/en${opts.pathname}`,
  resolveLocaleOrDefault: (lang: string) => lang || "en",
}))

// ─── Import after mocks ─────────────────────────────────────────────────────

import ApplicationsPage from "./page"

describe("ApplicationsPage", () => {
  it("renders heading and description from i18n", async () => {
    const ui = await ApplicationsPage({
      params: Promise.resolve({ lang: "en" }),
    })
    const view = render(ui)

    await waitFor(() => {
      expect(view.getByText("App Platform")).toBeInTheDocument()
    })
    expect(
      view.getByText("Deploy and manage your applications.")
    ).toBeInTheDocument()

    view.unmount()
  })

  it("renders three cards: Deploy, Manage, and Credentials", async () => {
    const ui = await ApplicationsPage({
      params: Promise.resolve({ lang: "en" }),
    })
    const view = render(ui)

    await waitFor(() => {
      expect(view.getByText("Deploy")).toBeInTheDocument()
    })
    expect(view.getByText("Manage")).toBeInTheDocument()
    expect(view.getByText("Credentials")).toBeInTheDocument()

    view.unmount()
  })

  it("links cards to correct routes", async () => {
    const ui = await ApplicationsPage({
      params: Promise.resolve({ lang: "en" }),
    })
    const view = render(ui)

    await waitFor(() => {
      const links = view.getAllByText("Open")
      expect(links).toHaveLength(3)
    })

    const links = view.getAllByText("Open")
    expect(links[0].closest("a")?.getAttribute("href")).toBe(
      "/en/console/app/deploy"
    )
    expect(links[1].closest("a")?.getAttribute("href")).toBe(
      "/en/console/app/manage"
    )
    expect(links[2].closest("a")?.getAttribute("href")).toBe(
      "/en/console/app/credentials"
    )

    view.unmount()
  })

  it("renders card descriptions from i18n", async () => {
    const ui = await ApplicationsPage({
      params: Promise.resolve({ lang: "en" }),
    })
    const view = render(ui)

    await waitFor(() => {
      expect(
        view.getByText(
          "Configure source, build, and initial release settings."
        )
      ).toBeInTheDocument()
    })
    expect(
      view.getByText(
        "Monitor deployment status, view events, and inspect logs for your apps."
      )
    ).toBeInTheDocument()
    expect(
      view.getByText(
        "Manage connected integrations and API tokens for your application."
      )
    ).toBeInTheDocument()

    view.unmount()
  })
})
