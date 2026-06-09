import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"

import { GithubEventsTable } from "./github-events-table"

afterEach(() => {
  cleanup()
  mock.restore()
})

describe("GithubEventsTable", () => {
  it("renders compact event rows and opens raw JSON modal", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/event_1")) {
        return Response.json({
          ok: true,
          data: {
            id: "event_1",
            deliveryId: "delivery_1",
            eventName: "push",
            repositoryFullName: "acme/api",
            payloadJson: { ref: "refs/heads/main" },
          },
        })
      }

      return Response.json({
        ok: true,
        data: {
          items: [
            {
              id: "event_1",
              receivedAt: "2026-06-09T00:00:00.000Z",
              eventName: "push",
              repositoryFullName: "acme/api",
              branch: "main",
              commitSha: "abcdef123456",
              commitMessage: "feat: webhook logs",
              senderLogin: "octocat",
              processStatus: "processed",
              eventDisposition: "tracked",
              processError: null,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 25,
        },
      })
    }) as typeof fetch

    const view = render(<GithubEventsTable />)

    await waitFor(() => {
      expect(view.getByText("acme/api")).toBeTruthy()
    })
    expect(view.getByText("feat: webhook logs")).toBeTruthy()

    fireEvent.click(view.getByRole("button", { name: /json/i }))

    await waitFor(() => {
      expect(view.getByText(/refs\/heads\/main/)).toBeTruthy()
    })
  })
})
