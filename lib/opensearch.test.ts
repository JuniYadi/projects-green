import { describe, expect, it, beforeEach } from "bun:test"
import { createOpenSearchClient, getOpenSearchClient } from "./opensearch"

describe("OpenSearch Client", () => {
  beforeEach(() => {
    process.env.OPENSEARCH_URL = "https://localhost:9200"
    process.env.OPENSEARCH_USER = "admin"
    process.env.OPENSEARCH_PASSWORD = "admin"
    process.env.OPENSEARCH_US_EAST_1_URL =
      "https://us-east-1.opensearch.example.com:9200"
    process.env.OPENSEARCH_US_EAST_1_USER = "admin"
    process.env.OPENSEARCH_US_EAST_1_PASSWORD = "password"
    process.env.OPENSEARCH_EU_WEST_1_URL =
      "https://eu-west-1.opensearch.example.com:9200"
    process.env.OPENSEARCH_EU_WEST_1_USER = "admin"
    process.env.OPENSEARCH_EU_WEST_1_PASSWORD = "password"
  })

  it("creates a client with provided config", () => {
    const client = createOpenSearchClient({
      node: "https://localhost:9200",
      auth: { username: "admin", password: "admin" },
    })
    expect(client).toBeDefined()
    expect(typeof client.search).toBe("function")
  })

  it("returns singleton from getOpenSearchClient", () => {
    const a = getOpenSearchClient()
    const b = getOpenSearchClient()
    expect(a).toBe(b)
  })

  it("creates different clients for different regions", () => {
    const us = getOpenSearchClient("us-east-1")
    const eu = getOpenSearchClient("eu-west-1")
    expect(us).not.toBe(eu)
  })
})
