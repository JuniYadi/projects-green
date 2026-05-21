import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, fireEvent } from "@testing-library/react"

let currentQuery = ""
const replaceCalls: string[] = []

const updateQueryFromUrl = (url: string) => {
  const parts = url.split("?")
  currentQuery = parts[1] ?? ""
}

mock.module("next/navigation", () => {
  return {
    usePathname: () => "/console/app/manage",
    useSearchParams: () => new URLSearchParams(currentQuery),
    useRouter: () => ({
      replace: (url: string) => {
        replaceCalls.push(url)
        updateQueryFromUrl(url)
      },
    }),
  }
})

const renderPage = async (query = "") => {
  currentQuery = query
  replaceCalls.splice(0)

  const pageModule = await import("@/app/[lang]/console/app/manage/page")
  return render(<pageModule.default />)
}

describe("ManagePage", () => {
  beforeEach(() => {
    currentQuery = ""
    replaceCalls.splice(0)
  })

  it("renders manage page and shows tabs", async () => {
    const view = await renderPage()

    expect(view.getByText("Manage Application")).toBeInTheDocument()
    expect(view.queryByText("Deploy Application")).not.toBeInTheDocument()

    expect(view.getByText("laravel-shop")).toBeInTheDocument()

    // Check tab buttons
    expect(view.getByText("Overview")).toBeInTheDocument()
    expect(view.getByText("Domains & SSL")).toBeInTheDocument()
    expect(view.getByText("Environment & Net")).toBeInTheDocument()
    expect(view.getByText("Storage & Mounts")).toBeInTheDocument()
    expect(view.getByText("Autoscaling & Tuning")).toBeInTheDocument()
    expect(view.getByText("Telemetry & Metrics")).toBeInTheDocument()
    expect(view.getByText("Opensearch Logs")).toBeInTheDocument()
  })

  it("can open operations FAQ troubleshooter", async () => {
    const view = await renderPage()

    const faqButton = view.getByText("Operations FAQ")
    expect(faqButton).toBeInTheDocument()

    // Click to open FAQ troubleshooter drawer
    fireEvent.click(faqButton)
    expect(view.getByText("Application Operations FAQ")).toBeInTheDocument()
    expect(
      view.getByPlaceholderText("Search troubleshooting questions...")
    ).toBeInTheDocument()
  })

  it("covers all 14 operational questions in the FAQ drawer", async () => {
    const view = await renderPage()

    fireEvent.click(view.getByText("Operations FAQ"))

    const questions = [
      "1. How do I manage my app?",
      "2. How do I change or custom domain? What DNS should I set?",
      "3. How do I add environment variables?",
      "4. I want to mount a private key file, how?",
      "5. I want to rebuild my repository, there is an update. How?",
      "6. I want to see status of my app, why cannot I access it?",
      "7. My app is slow, is resource enough to handle the traffic? Where can I see metrics?",
      "8. My SSL expired, why is the site not showing that?",
      "9. I'm behind Cloudflare, my SSL cannot activate. Why?",
      "10. I'm behind Cloudflare, and it is in a redirect loop. How do I fix it?",
      "11. I'm behind a proxy, client IPs show local IP instead of real IP.",
      "12. I need to customize my app resource because of lack of RAM.",
      "13. I need to add replica on my server, or enable HPA or VPA limits.",
      "14. I need to see logs of my app (Opensearch Integration).",
    ]

    for (const question of questions) {
      expect(view.getByText(question)).toBeInTheDocument()
    }
  })

  it("syncs active tab to URL search params", async () => {
    const view = await renderPage()

    // Click "Domains & SSL" tab
    fireEvent.click(view.getByText("Domains & SSL"))

    // URL should be updated with ?tab=domains
    const lastCall = replaceCalls[replaceCalls.length - 1]
    expect(lastCall).toContain("tab=domains")
    expect(lastCall).toContain("env=prod")
  })

  it("syncs environment to URL search params", async () => {
    const view = await renderPage()

    // Click "Development" environment
    fireEvent.click(view.getByText("Development"))

    const lastCall = replaceCalls[replaceCalls.length - 1]
    expect(lastCall).toContain("env=dev")
  })

  it("restores active tab from URL search params", async () => {
    const view = await renderPage("tab=logs&env=staging")

    // The logs tab should be active (showing the log viewer)
    expect(view.getByText("Opensearch Log Viewer")).toBeInTheDocument()
  })

  it("deep links from FAQ to correct tab and updates URL", async () => {
    const view = await renderPage()

    // Open FAQ
    fireEvent.click(view.getByText("Operations FAQ"))

    // Click "Go to Setting" on the domains question
    const goButtons = view.getAllByText("Go to Setting")
    // Q2 (domains) is the second FAQ item, index 1
    fireEvent.click(goButtons[1])

    // Troubleshooter should close and domains tab should be active
    expect(
      view.queryByText("Application Operations FAQ")
    ).not.toBeInTheDocument()
    expect(view.getByText("Custom Domain Settings")).toBeInTheDocument()

    // URL should reflect the tab change
    const lastCall = replaceCalls[replaceCalls.length - 1]
    expect(lastCall).toContain("tab=domains")
  })

  it("covers env, mounts, scaling, and metrics tab interactions", async () => {
    const view = await renderPage()

    const originalAlert = globalThis.alert
    const alertMock = mock(() => undefined)
    globalThis.alert = alertMock as unknown as typeof alert

    try {
      fireEvent.click(view.getByText("Environment & Net"))
      expect(view.getByText("Environment Variables")).toBeInTheDocument()

      fireEvent.click(view.getByRole("button", { name: "Bulk Import .env" }))
      expect(view.getByText("Bulk Import .env Variables")).toBeInTheDocument()
      fireEvent.click(view.getByRole("button", { name: "Cancel" }))
      expect(
        view.queryByText("Bulk Import .env Variables")
      ).not.toBeInTheDocument()

      fireEvent.click(view.getByRole("button", { name: "Bulk Import .env" }))
      fireEvent.click(view.getByRole("button", { name: "Import Variables" }))
      expect(view.getByText("Bulk Import .env Variables")).toBeInTheDocument()
      fireEvent.click(view.getByRole("button", { name: "Cancel" }))
      expect(
        view.queryByText("Bulk Import .env Variables")
      ).not.toBeInTheDocument()

      fireEvent.change(view.getByPlaceholderText("KEY (e.g. CACHE_DRIVER)"), {
        target: { value: "custom-value" },
      })
      fireEvent.change(view.getByPlaceholderText("Value"), {
        target: { value: "enabled" },
      })
      fireEvent.click(view.getByRole("button", { name: "Add Var" }))

      fireEvent.click(view.getByRole("button", { name: "DISABLED" }))
      expect(view.getByText("TRUST ACTIVE")).toBeInTheDocument()
      expect(
        view.getByText(
          "✓ Trust proxies is active. Real client IPs will show in application code (request()->ip())."
        )
      ).toBeInTheDocument()

      fireEvent.click(view.getByText("Storage & Mounts"))
      expect(view.getByText("Active Pod File Mounts")).toBeInTheDocument()

      fireEvent.click(view.getByRole("button", { name: "Create File Mount" }))
      expect(view.getByText("All fields are required")).toBeInTheDocument()

      fireEvent.change(
        view.getByPlaceholderText("e.g. application-private-key"),
        {
          target: { value: "my mount" },
        }
      )
      fireEvent.change(
        view.getByPlaceholderText("e.g. /var/www/html/storage/app/key.pem"),
        {
          target: { value: "/bin/forbidden.pem" },
        }
      )
      fireEvent.change(
        view.getByPlaceholderText(/-----BEGIN PRIVATE KEY-----/),
        {
          target: { value: "-----BEGIN PRIVATE KEY-----test" },
        }
      )
      fireEvent.click(view.getByRole("button", { name: "Create File Mount" }))

      fireEvent.change(
        view.getByPlaceholderText("e.g. /var/www/html/storage/app/key.pem"),
        {
          target: { value: "relative/path.pem" },
        }
      )
      fireEvent.click(view.getByRole("button", { name: "Create File Mount" }))

      fireEvent.change(
        view.getByPlaceholderText("e.g. /var/www/html/storage/app/key.pem"),
        {
          target: { value: "/var/www/html/storage/app/new.pem" },
        }
      )
      fireEvent.click(view.getByRole("button", { name: "Create File Mount" }))

      fireEvent.click(view.getByText("Autoscaling & Tuning"))
      expect(
        view.getByText("Autoscaling Policies (HPA / VPA)")
      ).toBeInTheDocument()

      fireEvent.click(view.getByRole("button", { name: "+" }))
      expect(view.getByText("3")).toBeInTheDocument()
      fireEvent.click(view.getByRole("button", { name: "-" }))
      expect(view.getByText("2")).toBeInTheDocument()

      const scalingToggles = view.getAllByRole("button", {
        name: "Disabled",
      })
      fireEvent.click(scalingToggles[0])
      expect(view.getByRole("button", { name: "Active" })).toBeInTheDocument()
      expect(view.getByText("Min Replicas")).toBeInTheDocument()

      const hpaInputs = view.getAllByRole("spinbutton")
      fireEvent.change(hpaInputs[0], { target: { value: "3" } })
      fireEvent.change(hpaInputs[1], { target: { value: "10" } })
      fireEvent.change(hpaInputs[2], { target: { value: "65" } })

      fireEvent.click(view.getByRole("button", { name: "Disabled" }))
      const modeButtons = ["Off", "Initial", "Auto"]
      for (const mode of modeButtons) {
        fireEvent.click(view.getByRole("button", { name: mode }))
      }

      fireEvent.click(
        view.getByRole("button", { name: "Save Resource Settings" })
      )
      expect(alertMock).toHaveBeenCalled()

      fireEvent.click(view.getByText("Telemetry & Metrics"))
      expect(view.getByText("Live Resource Monitoring")).toBeInTheDocument()
      expect(view.getByText("⚠️ Low RAM Headroom")).toBeInTheDocument()
    } finally {
      globalThis.alert = originalAlert
    }
  })
})
