import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

import { DeployStepTimeline } from "./deploy-timeline"

type FetchCalls = Array<{
  url: string
  ok: boolean
  json: () => Promise<unknown>
}>

const buildJson =
  (data: unknown, ok = true) =>
  () =>
    Promise.resolve({ ok, data })

const buildResponse = (
  url: string,
  data: unknown,
  ok = true
): FetchCalls[number] => ({
  url,
  ok,
  json: buildJson(data, ok),
})

const mockFetch = (dataByUrl?: (url: string) => unknown) => {
  return mock(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString()
    const data = dataByUrl ? dataByUrl(url) : null
    return buildResponse(url, data) as unknown as Response
  }) as unknown as typeof globalThis.fetch
}

describe("DeployStepTimeline", () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("renders 13 steps from canonical timeline items", () => {
    globalThis.fetch = mockFetch()

    const view = render(
      <DeployStepTimeline deployId="deploy-1" status="queued" />
    )
    const items = view.getAllByRole("listitem")
    expect(items.length).toBe(13)
  })

  it("marks each step with status text (not color-only)", () => {
    globalThis.fetch = mockFetch()

    const view = render(
      <DeployStepTimeline deployId="deploy-1" status="queued" />
    )
    // Every step renders a status text label paired with the icon
    const allStatusTexts = [
      ...view.queryAllByText("Completed"),
      ...view.queryAllByText("In progress"),
      ...view.queryAllByText("Pending"),
    ]
    expect(allStatusTexts.length).toBe(13)
  })

  it("sets aria-current=step on the active step", () => {
    globalThis.fetch = mockFetch()

    const view = render(
      <DeployStepTimeline deployId="deploy-1" status="building" />
    )
    const active = view.container.querySelector('[aria-current="step"]')
    expect(active).not.toBeNull()
  })
  it("announces timeline updates politely", () => {
    globalThis.fetch = mockFetch()

    const view = render(
      <DeployStepTimeline deployId="deploy-1" status="building" />
    )
    const list = view.getByRole("list", { name: "Deployment step timeline" })
    expect(list.getAttribute("aria-live")).toBe("polite")
  })

  it("marks active step failed and later steps skipped when failed", async () => {
    globalThis.fetch = mockFetch((url) => {
      if (url.includes("/status/")) {
        return {
          status: "failed",
          failureReason: "Jenkins crashed",
          startedAt: null,
          completedAt: null,
        }
      }
      return []
    })

    const view = render(
      <DeployStepTimeline deployId="deploy-1" status="failed" />
    )

    await waitFor(() => {
      expect(view.getAllByText("Failed").length).toBeGreaterThanOrEqual(1)
    })
    expect(view.getAllByText("Skipped").length).toBeGreaterThan(0)
  })

  it("shows retry CTA on failed step when onRetry provided", async () => {
    globalThis.fetch = mockFetch((url) => {
      if (url.includes("/status/")) {
        return {
          status: "failed",
          failureReason: "Jenkins crashed",
          startedAt: null,
          completedAt: null,
        }
      }
      return []
    })

    const retry = mock()
    const view = render(
      <DeployStepTimeline deployId="deploy-1" status="failed" onRetry={retry} />
    )

    await waitFor(() => {
      expect(view.getAllByText("Failed").length).toBeGreaterThanOrEqual(1)
    })

    // Expand the failed step to reveal the retry CTA inside the collapsible
    const triggers = view.getAllByRole("button")
    const failedTrigger = triggers.find((btn) =>
      btn.textContent?.includes("Failed")
    )
    failedTrigger?.click()

    await waitFor(() => {
      expect(view.getByText("Retry deploy")).toBeInTheDocument()
    })
    view.getByText("Retry deploy").click()
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it("shows live domain link when running and liveDomain provided", async () => {
    globalThis.fetch = mockFetch((url) => {
      if (url.includes("/status/")) {
        return {
          status: "running",
          failureReason: null,
          startedAt: "2026-07-29T00:00:00.000Z",
          completedAt: null,
        }
      }
      return []
    })

    const view = render(
      <DeployStepTimeline
        deployId="deploy-1"
        status="running"
        liveDomain="myapp.pfnapp.dev"
      />
    )

    await waitFor(() => {
      expect(view.getByText("Open live deployment →")).toBeInTheDocument()
    })
    const link = view.getByText("Open live deployment →").closest("a")
    expect(link?.getAttribute("href")).toBe("https://myapp.pfnapp.dev")
  })

  it("fetches logs when a step is expanded", async () => {
    const fetchedUrls: string[] = []
    globalThis.fetch = mockFetch((url) => {
      fetchedUrls.push(url)
      if (url.includes("/logs/")) {
        return [
          {
            id: "log-1",
            scope: "build",
            status: "BUILDING",
            message: "Building image",
          },
        ]
      }
      return []
    })

    const view = render(
      <DeployStepTimeline deployId="deploy-1" status="queued" />
    )

    const triggers = view.getAllByRole("button")
    triggers[0]?.click()

    await waitFor(() => {
      expect(fetchedUrls.some((u) => u.includes("/logs/"))).toBe(true)
    })
    await waitFor(() => {
      expect(view.getByText("Building image")).toBeInTheDocument()
    })
  })
  it("clears a previous logs error when another step opens", async () => {
    let logsCallCount = 0
    globalThis.fetch = mockFetch((url) => {
      if (url.includes("/status/")) {
        return {
          status: "queued",
          failureReason: null,
          startedAt: null,
          completedAt: null,
        }
      }
      if (url.includes("/logs/")) {
        logsCallCount++
        if (logsCallCount === 1) throw new Error("fetch failed")
        return [
          {
            id: "log-2",
            scope: "build",
            status: "BUILDING",
            message: "Step 2 log",
          },
        ]
      }
      return []
    })

    const view = render(
      <DeployStepTimeline deployId="deploy-1" status="queued" />
    )

    const triggers = view.getAllByRole("button")

    // Open first step — logs fetch fails via throw
    fireEvent.click(triggers[0]!)
    await waitFor(() => {
      expect(view.getByText("Failed to load logs")).toBeInTheDocument()
    })

    // Open second step — clears the error and fetches successfully
    fireEvent.click(triggers[1]!)
    await waitFor(() => {
      expect(view.queryByText("Failed to load logs")).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(view.getByText("Step 2 log")).toBeInTheDocument()
    })
  })

  it("stops polling when status is running", async () => {
    const fetchedUrls: string[] = []
    globalThis.fetch = mockFetch((url) => {
      fetchedUrls.push(url)
      if (url.includes("/status/")) {
        return {
          status: "running",
          failureReason: null,
          startedAt: null,
          completedAt: null,
        }
      }
      return []
    })

    render(<DeployStepTimeline deployId="deploy-1" status="running" />)

    // Wait beyond one poll cycle to confirm no interval fires
    const { promise, resolve } = Promise.withResolvers<void>()
    setTimeout(resolve, 200)
    await promise
    const statusCalls = fetchedUrls.filter((u) => u.includes("/status/"))
    // Only the initial one-shot fetch should occur; no interval polling
    expect(statusCalls.length).toBe(1)
  })
})
