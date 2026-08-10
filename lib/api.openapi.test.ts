import { describe, expect, it } from "bun:test"
import { z } from "zod"

import { app, toOpenApiJsonSchema } from "@/lib/api"
type OpenApiMediaType = {
  example?: unknown
  schema?: Record<string, unknown>
}

type OpenApiOperation = {
  tags?: string[]
  requestBody?: {
    content?: Record<string, OpenApiMediaType>
  }
  responses?: Record<
    string,
    {
      content?: Record<string, OpenApiMediaType>
    }
  >
}

type OpenApiDocument = {
  openapi?: string
  paths?: Record<string, Record<string, OpenApiOperation>>
}
const METHODS: Record<string, true> = {
  get: true,
  post: true,
  put: true,
  patch: true,
  delete: true,
  options: true,
  head: true,
  trace: true,
}

const operationsOf = (document: OpenApiDocument) =>
  Object.entries(document.paths ?? {}).flatMap(([path, pathItem]) =>
    Object.entries(pathItem)
      .filter(([method]) => METHODS[method] === true)
      .map(([method, operation]) => ({ path, method, operation }))
  )

describe("OpenAPI documentation", () => {
  it("serves the UI and complete generated specification", async () => {
    const html = await app.handle(
      new Request("http://localhost/api/openapi", { method: "GET" })
    )
    expect(html.status).toBe(200)
    expect(html.headers.get("content-type")).toContain("text/html")
    const health = await app.handle(
      new Request("http://localhost/api/health", { method: "GET" })
    )
    expect(health.status).toBe(200)
    const healthBody = (await health.json()) as { endpoints?: unknown }
    expect(Array.isArray(healthBody.endpoints)).toBe(true)

    const response = await app.handle(
      new Request("http://localhost/api/openapi/json", { method: "GET" })
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("application/json")

    const document = (await response.json()) as OpenApiDocument
    expect(document.openapi).toBe("3.0.3")

    const operations = operationsOf(document)
    expect(Object.keys(document.paths ?? {}).length).toBe(361)
    expect(operations.length).toBe(458)
    expect(
      operations.every(
        ({ operation }) =>
          Array.isArray(operation.tags) && operation.tags.length > 0
      )
    ).toBe(true)
    expect(
      operations.some(({ operation }) => operation.tags?.includes("API Admin"))
    ).toBe(true)
    expect(
      operations.some(({ operation }) => operation.tags?.includes("Api"))
    ).toBe(false)

    for (const { method, operation } of operations) {
      expect(operation.responses).toBeDefined()

      for (const [status, responseDefinition] of Object.entries(
        operation.responses ?? {}
      )) {
        expect(
          responseDefinition.content,
          `${method} ${status} response`
        ).toBeDefined()

        for (const [mediaType, media] of Object.entries(
          responseDefinition.content ?? {}
        )) {
          expect(
            Object.prototype.hasOwnProperty.call(media, "example"),
            `${method} ${status} ${mediaType} response example`
          ).toBe(true)
        }
      }

      if (["post", "put", "patch", "delete"].includes(method)) {
        expect(operation.requestBody, `${method} request body`).toBeDefined()
        const requestContent = operation.requestBody?.content ?? {}
        expect(
          Object.keys(requestContent).length,
          `${method} request media`
        ).toBeGreaterThan(0)

        for (const [mediaType, media] of Object.entries(requestContent)) {
          expect(
            Object.prototype.hasOwnProperty.call(media, "example"),
            `${method} ${mediaType} request example`
          ).toBe(true)
        }
      }
    }

    const echo = document.paths?.["/api/echo"]?.post
    const echoSchema = echo?.requestBody?.content?.["application/json"]?.schema
    expect(echoSchema?.type).toBe("object")
    expect(echoSchema?.properties).toMatchObject({
      message: { type: "string" },
    })
    expect(document.paths?.["/api/vouchers/portal/"]?.get?.tags).toEqual([
      "Vouchers",
    ])
    expect(document.paths?.["/api/admin/organizations"]?.get?.tags).toEqual([
      "API Admin",
    ])
    expect(document.paths?.["/api/admin/devices/"]?.get?.tags).toEqual([
      "API Admin",
    ])
  })

  describe("Production WhatsApp webhook routing", () => {
    it("mounts canonical GET/POST routes without legacy global-secret route", () => {
      expect(app.routes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: "GET",
            path: "/api/whatsapp/meta-webhook/:webhookKey",
          }),
          expect.objectContaining({
            method: "POST",
            path: "/api/whatsapp/meta-webhook/:webhookKey",
          }),
        ])
      )
      expect(app.routes).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: "GET",
            path: "/api/whatsapp/webhook",
          }),
          expect.objectContaining({
            method: "POST",
            path: "/api/whatsapp/webhook",
          }),
        ])
      )
    })
  })

  it("converts Zod transforms without warnings", () => {
    const warnings: unknown[][] = []
    const warn = console.warn
    console.warn = (...args: unknown[]) => warnings.push(args)

    try {
      const schema = toOpenApiJsonSchema(
        z.object({ value: z.string().transform((value) => value.trim()) })
      )

      expect(schema).toMatchObject({
        type: "object",
        properties: { value: { type: "string" } },
      })
    } finally {
      console.warn = warn
    }

    expect(warnings).toEqual([])
  })
})
