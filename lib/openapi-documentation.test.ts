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
})
