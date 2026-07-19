import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { WhatsAppDeviceClient } from "./device-client"

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockAnalyticsResponse = {
  data: [
    {
      phone_number_id: "123",
      phone_number: "15551234567",
      country: "US",
      conversation_direction: "BUSINESS_INITIATED",
      conversation_category: "MARKETING",
      conversation_start: 1723456789,
      message_inbound_count: 5,
      message_outbound_count: 3,
      cost: { amount: 0.035, currency: "USD" },
    },
  ],
  paging: { cursors: { before: "before1", after: "after1" } },
}

const mockPaginatedResponse = {
  data: [
    {
      phone_number_id: "456",
      message_inbound_count: 2,
      message_outbound_count: 1,
    },
  ],
  paging: { cursors: { before: "before2", after: "after2" } },
}

const mockEmptyResponse = {
  data: [],
  paging: { cursors: { before: "empty", after: "empty" } },
}

const mockRequest = mock(
  async (
    op: string,
    endpoint: string,
    method: string,
    body?: unknown
  ): Promise<any> => {
    if (endpoint.includes("after=after1")) {
      return mockEmptyResponse // stop after first page
    }
    return { ...mockAnalyticsResponse }
  }
)

mock.module("./client", () => ({
  MetaCloudHttpClient: class {
    request = mockRequest
    getAccessToken = () => "mock-token"
  },
}))

mock.module("../crypto", () => ({
  decryptWhatsAppToken: async (token: string) => token,
}))

function createClient() {
  return new WhatsAppDeviceClient({
    accessToken: "mock-token",
    phoneNumberId: "phone-1",
    wabaId: "waba-1",
  })
}

describe("WhatsAppDeviceClient.getAnalytics", () => {
  beforeEach(() => {
    mockRequest.mockClear()
  })

  it("fetches analytics with date range and granularity", async () => {
    const client = createClient()
    const result = await client.getAnalytics({
      start: 1723456000,
      end: 1723457000,
      granularity: "DAY",
    })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].message_inbound_count).toBe(5)
    expect(mockRequest).toHaveBeenCalledWith(
      "GET_ANALYTICS",
      expect.stringContaining("analytics"),
      "GET"
    )
  })

  it("passes metric_types parameter", async () => {
    const client = createClient()
    await client.getAnalytics({
      start: 1723456000,
      end: 1723457000,
      granularity: "DAY",
      metric_types: "CONVERSATION",
    })

    const [, endpoint] = mockRequest.mock.calls[0] as unknown as [
      string,
      string,
    ]
    expect(endpoint).toContain("metric_types=CONVERSATION")
  })

  it("passes phone_numbers parameter", async () => {
    const client = createClient()
    await client.getAnalytics({
      start: 1723456000,
      end: 1723457000,
      granularity: "DAY",
      phone_numbers: ["123", "456"],
    })

    const [, endpoint] = mockRequest.mock.calls[0] as unknown as [
      string,
      string,
    ]
    expect(endpoint).toContain("phone_numbers=123%2C456")
  })

  it("calls next page when paging.next is present", async () => {
    // First call returns a page with a next cursor, second returns empty
    mockRequest.mockImplementation(async (op: string, endpoint: string) => {
      if (endpoint.includes("after=after1")) {
        return { data: [], paging: { cursors: { before: "b2" } } }
      }
      return {
        data: [{ message_inbound_count: 1 }],
        paging: {
          cursors: { before: "b1", after: "after1" },
          next: "https://graph.facebook.com/next",
        },
      }
    })

    const client = createClient()
    const result = await client.getAnalytics({
      start: 1723456000,
      end: 1723457000,
      granularity: "DAY",
    })

    expect(result.data).toHaveLength(1)
    expect(mockRequest).toHaveBeenCalledTimes(2)
  })

  it("caps pagination at 10 pages", async () => {
    // Return a page with next cursor every time
    mockRequest.mockImplementation(async () => ({
      data: [{ message_inbound_count: 1 }],
      paging: {
        cursors: { before: "b", after: "a" },
        next: "https://graph.facebook.com/next",
      },
    }))

    const client = createClient()
    const result = await client.getAnalytics({
      start: 1723456000,
      end: 1723457000,
      granularity: "DAY",
    })

    expect(result.totalPages).toBe(10)
    expect(mockRequest).toHaveBeenCalledTimes(10)
  })

  it("handles empty response", async () => {
    mockRequest.mockImplementation(async () => ({ data: [] }))

    const client = createClient()
    const result = await client.getAnalytics({
      start: 1723456000,
      end: 1723457000,
      granularity: "WEEK",
    })

    expect(result.data).toHaveLength(0)
    expect(result.totalPages).toBe(1)
  })
})
