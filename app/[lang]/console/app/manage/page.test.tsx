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

  const pageModule = await import(
    "@/app/[lang]/console/app/manage/page"
  )
  return render(<pageModule.default />)
}

describe("ManagePage", () => {
  beforeEach(() => {
    currentQuery = ""
    replaceCalls.splice(0)
  })

  it("renders manage page and shows tabs", async () => {
    const view = await renderPage()

    expect(view.getByText("Manage Application")).toBeTruthy()
    expect(view.queryByText("Deploy Application")).toBeFalsy()

    expect(view.getByText("laravel-shop")).toBeTruthy()

    // Check tab buttons
    expect(view.getByText("Overview")).toBeTruthy()
    expect(view.getByText("Domains & SSL")).toBeTruthy()
    expect(view.getByText("Environment & Net")).toBeTruthy()
    expect(view.getByText("Storage & Mounts")).toBeTruthy()
    expect(view.getByText("Autoscaling & Tuning")).toBeTruthy()
    expect(view.getByText("Telemetry & Metrics")).toBeTruthy()
    expect(view.getByText("Opensearch Logs")).toBeTruthy()
  })

  it("can open operations FAQ troubleshooter", async () => {
    const view = await renderPage()

    const faqButton = view.getByText("Operations FAQ")
    expect(faqButton).toBeTruthy()

    // Click to open FAQ troubleshooter drawer
    fireEvent.click(faqButton)
    expect(view.getByText("Application Operations FAQ")).toBeTruthy()
    expect(
      view.getByPlaceholderText("Search troubleshooting questions...")
    ).toBeTruthy()
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
      expect(view.getByText(question)).toBeTruthy()
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
    expect(view.getByText("Opensearch Log Viewer")).toBeTruthy()
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
    expect(view.queryByText("Application Operations FAQ")).toBeFalsy()
    expect(view.getByText("Custom Domain Settings")).toBeTruthy()

    // URL should reflect the tab change
    const lastCall = replaceCalls[replaceCalls.length - 1]
    expect(lastCall).toContain("tab=domains")
  })
})
