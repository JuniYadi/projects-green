import { describe, expect, it } from "bun:test"
import { render, fireEvent } from "@testing-library/react"

describe("OperatePage", () => {
  it("renders operate page and shows tabs", async () => {
    const pageModule = await import("@/app/[lang]/console/app/deploy/operate/page")
    const view = render(<pageModule.default />)

    // Check header info
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
    const pageModule = await import("@/app/[lang]/console/app/deploy/operate/page")
    const view = render(<pageModule.default />)

    const faqButton = view.getByText("Operations FAQ")
    expect(faqButton).toBeTruthy()

    // Click to open FAQ troubleshooter drawer
    fireEvent.click(faqButton)
    expect(view.getByText("Application Operations FAQ")).toBeTruthy()
    expect(view.getByPlaceholderText("Search troubleshooting questions...")).toBeTruthy()
  })

  it("covers all 14 operational questions in the FAQ drawer", async () => {
    const pageModule = await import("@/app/[lang]/console/app/deploy/operate/page")
    const view = render(<pageModule.default />)

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
})
