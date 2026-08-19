import { describe, expect, it } from "bun:test"

import {
  enrichOpenApiDocument,
  generateSchemaExample,
} from "./openapi-documentation"

describe("generateSchemaExample", () => {
  it("preserves explicit schema values and recursively samples required properties", () => {
    expect(generateSchemaExample({ example: "provided", type: "string" })).toBe(
      "provided"
    )
    expect(generateSchemaExample({ default: 7, type: "number" })).toBe(7)
    expect(generateSchemaExample({ const: "fixed", type: "string" })).toBe(
      "fixed"
    )
    expect(
      generateSchemaExample({ enum: ["first", "second"], type: "string" })
    ).toBe("first")

    expect(
      generateSchemaExample({
        type: "object",
        required: ["name", "enabled"],
        properties: {
          name: { type: "string" },
          enabled: { type: "boolean" },
          omitted: { type: "integer" },
        },
      })
    ).toEqual({ name: "string", enabled: false })
  })

  it("handles arrays, unions, formats, numeric bounds, nullables, and refs", () => {
    expect(
      generateSchemaExample({ type: "array", items: { type: "integer" } })
    ).toEqual([0])
    expect(
      generateSchemaExample({ anyOf: [{ type: "string" }, { type: "number" }] })
    ).toBe("string")
    expect(generateSchemaExample({ oneOf: [{ type: "boolean" }] })).toBe(false)
    expect(
      generateSchemaExample({
        allOf: [{ type: "object", properties: { id: { type: "integer" } } }],
      })
    ).toEqual({
      id: 0,
    })
    expect(generateSchemaExample({ type: "string", format: "email" })).toBe(
      "user@example.com"
    )
    expect(generateSchemaExample({ type: "string", format: "date" })).toBe(
      "2020-01-01"
    )
    expect(generateSchemaExample({ type: "integer", minimum: 3 })).toBe(3)
    expect(generateSchemaExample({ type: ["null", "string"] })).toBe(null)
    expect(
      generateSchemaExample({ $ref: "#/components/schemas/Unknown" })
    ).toEqual({})
  })

  it("covers deterministic string formats, numeric bounds, and union fallbacks", () => {
    expect(generateSchemaExample({ type: "string", format: "date-time" })).toBe(
      "2020-01-01T00:00:00.000Z"
    )
    expect(generateSchemaExample({ type: "string", format: "time" })).toBe(
      "00:00:00Z"
    )
    expect(generateSchemaExample({ type: "string", format: "hostname" })).toBe(
      "example.com"
    )
    expect(generateSchemaExample({ type: "string", format: "ipv4" })).toBe(
      "192.0.2.1"
    )
    expect(generateSchemaExample({ type: "string", format: "ipv6" })).toBe(
      "2001:db8::1"
    )
    expect(generateSchemaExample({ type: "string", format: "uri" })).toBe(
      "https://example.com"
    )
    expect(
      generateSchemaExample({ type: "string", format: "uri-reference" })
    ).toBe("https://example.com")
    expect(generateSchemaExample({ type: "string", format: "url" })).toBe(
      "https://example.com"
    )
    expect(generateSchemaExample({ type: "string", format: "uuid" })).toBe(
      "00000000-0000-4000-8000-000000000000"
    )
    expect(generateSchemaExample({ type: "string", format: "byte" })).toBe("")
    expect(generateSchemaExample({ type: "string", format: "binary" })).toBe("")
    expect(generateSchemaExample({ type: "string", format: "unknown" })).toBe(
      "string"
    )

    expect(
      generateSchemaExample({ type: "integer", exclusiveMinimum: 2.2 })
    ).toBe(3)
    expect(
      generateSchemaExample({ type: "number", exclusiveMinimum: 2.2 })
    ).toBe(2.2)
    expect(
      generateSchemaExample({
        type: "integer",
        minimum: 2,
        exclusiveMinimum: true,
      })
    ).toBe(3)
    expect(
      generateSchemaExample({
        type: "number",
        minimum: 2,
        exclusiveMinimum: true,
      })
    ).toBe(3)
    expect(
      generateSchemaExample({ type: "integer", exclusiveMaximum: 4.8 })
    ).toBe(4)
    expect(
      generateSchemaExample({ type: "number", exclusiveMaximum: 4.8 })
    ).toBe(4.8)
    expect(
      generateSchemaExample({
        type: "integer",
        maximum: 4,
        exclusiveMaximum: true,
      })
    ).toBe(3)
    expect(
      generateSchemaExample({
        type: "number",
        maximum: 4,
        exclusiveMaximum: true,
      })
    ).toBe(3)
    expect(generateSchemaExample({ type: "number" })).toBe(0)

    expect(
      generateSchemaExample({
        allOf: [
          { type: "object", properties: { id: { type: "integer" } } },
          {
            type: "object",
            properties: { id: { example: 7 }, name: { type: "string" } },
          },
        ],
      })
    ).toEqual({ id: 0, name: "string" })
    expect(generateSchemaExample({ allOf: [{ type: "string" }] })).toBe(
      "string"
    )
    expect(generateSchemaExample({ nullable: true, type: "string" })).toBe(null)
    expect(generateSchemaExample({ type: "null" })).toBe(null)
    expect(generateSchemaExample({ type: ["integer", "string"] })).toBe(0)
    expect(generateSchemaExample({ type: [1, 3] })).toEqual({})
    expect(generateSchemaExample(null)).toEqual({})
    const cyclicSchema: Record<string, unknown> = { type: "object" }
    cyclicSchema.properties = { self: cyclicSchema }
    expect(generateSchemaExample(cyclicSchema)).toEqual({ self: {} })
  })
})

describe("enrichOpenApiDocument", () => {
  it("adds request and response samples while preserving existing status, media, and metadata", () => {
    const document = {
      openapi: "3.0.3",
      paths: {
        "/widgets": {
          post: {
            operationId: "createWidget",
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["name"],
                    properties: { name: { type: "string" } },
                  },
                },
              },
            },
            responses: {
              "201": {
                description: "Created",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { id: { type: "integer" } },
                    },
                  },
                },
              },
              "204": { description: "No content" },
            },
            tags: ["Custom"],
            summary: "Custom summary",
            description: "Custom description",
          },
          get: {
            responses: { "200": { description: "OK" } },
          },
        },
        "/upload": {
          post: {
            responses: {
              "200": {
                description: "Uploaded",
                content: {
                  "text/plain": { schema: { type: "string" } },
                  "application/octet-stream": {
                    schema: { type: "string", format: "binary" },
                  },
                },
              },
            },
          },
        },
      },
    }

    const enriched = enrichOpenApiDocument(document)

    expect(
      document.paths["/widgets"].post.requestBody?.content["application/json"]
        .schema
    ).not.toHaveProperty("example")
    expect(
      enriched.paths["/widgets"].post.requestBody?.content["application/json"]
        .schema
    ).toMatchObject({
      example: { name: "string" },
    })
    expect(
      enriched.paths["/widgets"].post.responses["201"].content[
        "application/json"
      ].schema
    ).toMatchObject({
      example: { id: 0 },
    })
    expect(enriched.paths["/widgets"].post.responses["204"] as unknown).toEqual(
      {
        description: "No content",
      }
    )
    expect(enriched.paths["/widgets"].post.tags).toEqual(["Custom"])
    expect(enriched.paths["/widgets"].post.summary).toBe("Custom summary")
    expect(enriched.paths["/widgets"].post.description).toBe(
      "Custom description"
    )

    const get = enriched.paths["/widgets"].get
    expect(get.requestBody).toBeUndefined()
    expect(get.responses["200"]).toMatchObject({ "x-pfnapp-fallback": true })
    expect(get.responses["200"].content["application/json"]).toMatchObject({
      example: {},
    })
    expect(get.tags).toBeArray()
    expect(get.summary).toContain("GET /widgets")
    expect(get.description).toContain("GET /widgets")

    expect(enriched.paths["/upload"].post.requestBody).toMatchObject({
      "x-pfnapp-fallback": true,
      content: { "application/json": { example: {}, schema: { example: {} } } },
    })
    expect(
      enriched.paths["/upload"].post.responses["200"].content["text/plain"]
    ).toMatchObject({
      example: "string",
    })
    expect(
      enriched.paths["/upload"].post.responses["200"].content[
        "application/octet-stream"
      ]
    ).toMatchObject({
      example: "",
    })
  })

  it("covers media placeholders, fallbacks, metadata defaults, and safe refs", () => {
    const document = {
      paths: {
        "/api-things/{id}": {
          put: {
            requestBody: { content: {}, description: "keep request" },
            responses: {},
          },
          post: {
            requestBody: { $ref: "#/components/requestBodies/Widget" },
            responses: {
              "201": {
                content: {
                  "application/json": {
                    schema: { type: "string", example: "schema value" },
                  },
                  "application/json;placeholder": {},
                  "application/xml": {},
                  "application/octet-stream": {
                    examples: { saved: { value: "keep" } },
                  },
                  "application/octet-stream;raw": {},
                  "application/x-custom": {},
                  "application/problem+json": null,
                },
              },
            },
          },
        },
        "/": {
          options: {},
        },
        "/safe": {
          delete: { responses: undefined },
          patch: { requestBody: { content: {} }, responses: {} },
          head: { responses: { "200": { description: "Keep status" } } },
          trace: { responses: { "200": {} } },
          parameters: [{ name: "ignored" }],
        },
      },
    }

    const enriched = enrichOpenApiDocument(document)
    const put = enriched.paths["/api-things/{id}"].put
    const post = enriched.paths["/api-things/{id}"].post
    const root = enriched.paths["/"].options
    const safe = enriched.paths["/safe"]

    expect(put.requestBody).toMatchObject({
      description: "keep request",
      "x-pfnapp-fallback": true,
      content: { "application/json": { example: {}, schema: { example: {} } } },
    })
    expect(put.responses["200"]).toMatchObject({
      "x-pfnapp-fallback": true,
      description:
        "Generic JSON response fallback; inferred schema unavailable.",
    })
    expect(post.requestBody as unknown).toEqual({
      $ref: "#/components/requestBodies/Widget",
    })
    expect(post.responses["201"].content["application/json"]).toEqual({
      schema: { type: "string", example: "schema value" },
      example: "schema value",
    })
    expect(post.responses["201"].content["application/xml"]).toEqual({
      example: "string",
    })
    expect(post.responses["201"].content["application/octet-stream"]).toEqual({
      examples: { saved: { value: "keep" } },
    })
    expect(post.responses["201"].content["application/x-custom"]).toEqual({
      example: {},
    })
    expect(post.responses["201"].content["application/problem+json"]).toBeNull()
    expect(
      post.responses["201"].content["application/json;placeholder"]
    ).toEqual({
      example: {},
    })
    expect(
      post.responses["201"].content["application/octet-stream;raw"]
    ).toEqual({
      example: "",
    })
    expect(safe.patch.requestBody).toMatchObject({
      "x-pfnapp-fallback": true,
      description:
        "Generic JSON request body fallback; inferred schema unavailable.",
    })
    expect(safe.trace.responses["200"]).toMatchObject({
      "x-pfnapp-fallback": true,
      description:
        "Generic JSON response fallback; inferred schema unavailable.",
    })

    expect(root.tags).toEqual(["API"])
    expect(root.summary).toBe("OPTIONS /")
    expect(root.description).toBe("OPTIONS / operation.")
    expect(safe.delete.responses["200"]).toMatchObject({
      "x-pfnapp-fallback": true,
    })
    expect(safe.head.responses["200"]).toMatchObject({
      description: "Keep status",
      "x-pfnapp-fallback": true,
    })
    expect(safe.parameters as unknown).toEqual([{ name: "ignored" }])
    expect(document.paths["/api-things/{id}"].put.requestBody).toEqual({
      content: {},
      description: "keep request",
    })
  })

  it("is pure and idempotent", () => {
    const input = {
      paths: {
        "/items": {
          patch: {
            responses: {},
          },
        },
      },
    }

    const first = enrichOpenApiDocument(input)
    const second = enrichOpenApiDocument(first)

    expect(first).toEqual(second)
    expect(input).toEqual({
      paths: { "/items": { patch: { responses: {} } } },
    })
  })
  it("assigns granular sub-resource tags and groups admin routes", () => {
    const enriched = enrichOpenApiDocument({
      paths: {
        "/api/vouchers": { get: { responses: { "200": {} } } },
        "/api/admin/vouchers": { get: { responses: { "200": {} } } },
        "/api/whatsapp/messages": { post: { responses: { "200": {} } } },
        "/api/whatsapp/templates": { get: { responses: { "200": {} } } },
        "/api/whatsapp/admin/devices": {
          get: { responses: { "200": {} } },
        },
        "/api/vpn/mobile/pairing": { get: { responses: { "200": {} } } },
        "/api/portal/vpn": { get: { responses: { "200": {} } } },
        "/api": { get: { responses: { "200": {} } } },
      },
    })

    expect(enriched.paths["/api/vouchers"].get.tags).toEqual(["Vouchers"])
    expect(enriched.paths["/api/admin/vouchers"].get.tags).toEqual([
      "API Admin",
    ])
    expect(enriched.paths["/api/whatsapp/messages"].post.tags).toEqual([
      "WhatsApp Messages",
    ])
    expect(enriched.paths["/api/whatsapp/templates"].get.tags).toEqual([
      "WhatsApp Templates",
    ])
    expect(enriched.paths["/api/whatsapp/admin/devices"].get.tags).toEqual([
      "API Admin",
    ])
    expect(enriched.paths["/api/vpn/mobile/pairing"].get.tags).toEqual([
      "VPN Mobile",
    ])
    expect(enriched.paths["/api/portal/vpn"].get.tags).toEqual(["Portal"])
    expect(enriched.paths["/api"].get.tags).toEqual(["API"])
  })

  it("filters out internal, non-whitelisted, and hidden routes when scope is public", () => {
    const enriched = enrichOpenApiDocument(
      {
        paths: {
          "/api/whatsapp/messages": { post: { responses: { "200": {} } } },
          "/api/whatsapp/devices/123": {
            get: { responses: { "200": {} } },
            delete: { hide: true, responses: { "200": {} } },
          },
          "/api/admin/whatsapp/webhooks": { get: { responses: { "200": {} } } },
          "/api/vpn/mobile/pairing/generate": {
            post: { responses: { "200": {} } },
          },
          "/api/deploy/apps": { get: { responses: { "200": {} } } },
          "/api/invoices/123/mark-paid": { post: { responses: { "200": {} } } },
          "/api/whatsapp/webhooks/dead-letter": {
            get: { responses: { "200": {} } },
          },
          "/api/invoices/123": { get: { responses: { "200": {} } } },
          "/api/auth/login": { post: { responses: { "200": {} } } },
          "/api/tenants/bootstrap": { get: { responses: { "200": {} } } },
          "/api/echo": { post: { responses: { "200": {} } } },
          "/api/portal/payments": { get: { responses: { "200": {} } } },
        },
      },
      { scope: "public" }
    )

    expect(enriched.paths["/api/whatsapp/messages"]).toBeDefined()
    expect(enriched.paths["/api/whatsapp/devices/123"]?.get).toBeDefined()
    expect(enriched.paths["/api/whatsapp/devices/123"]?.delete).toBeUndefined()
    expect(enriched.paths["/api/invoices/123"]).toBeUndefined()
    expect(enriched.paths["/api/vpn/mobile/pairing/generate"]).toBeUndefined()
    expect(enriched.paths["/api/deploy/apps"]).toBeUndefined()
    expect(enriched.paths["/api/admin/whatsapp/webhooks"]).toBeUndefined()
    expect(enriched.paths["/api/invoices/123/mark-paid"]).toBeUndefined()
    expect(enriched.paths["/api/whatsapp/webhooks/dead-letter"]).toBeUndefined()
    expect(enriched.paths["/api/auth/login"]).toBeUndefined()
    expect(enriched.paths["/api/tenants/bootstrap"]).toBeUndefined()
    expect(enriched.paths["/api/echo"]).toBeUndefined()
    expect(enriched.paths["/api/portal/payments"]).toBeUndefined()
  })
})
