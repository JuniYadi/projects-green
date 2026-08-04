type JsonObject = Record<string, unknown>

type OpenApiResponse = JsonObject & {
  content: Record<string, JsonObject>
}

type OpenApiOperation = JsonObject & {
  requestBody?: JsonObject & { content: Record<string, JsonObject> }
  responses: Record<string, OpenApiResponse>
  tags?: unknown
  summary?: string
  description?: string
}

type OpenApiPathItem = JsonObject & Record<string, OpenApiOperation>

/** Structural OpenAPI document shape returned by the enrichment helper. */
export type OpenApiDocument = JsonObject & {
  paths: Record<string, OpenApiPathItem>
}

type Schema = JsonObject

const OPERATION_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const

const WRITE_METHODS = new Set(["post", "put", "patch", "delete"])
const FALLBACK_EXTENSION = "x-pfnapp-fallback"

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasOwn(value: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T
  }

  if (isRecord(value)) {
    const result: JsonObject = {}
    for (const [key, item] of Object.entries(value)) {
      result[key] = cloneValue(item)
    }
    return result as T
  }

  return value
}

function firstSchemaBranch(
  schema: Schema,
  key: "anyOf" | "oneOf"
): Schema | undefined {
  const branches = schema[key]
  if (!Array.isArray(branches)) {
    return undefined
  }

  return branches.find(isRecord)
}

function numberExample(schema: Schema, integer: boolean): number {
  const minimum = schema.minimum
  const exclusiveMinimum = schema.exclusiveMinimum
  const maximum = schema.maximum
  const exclusiveMaximum = schema.exclusiveMaximum

  if (typeof exclusiveMinimum === "number") {
    return integer ? Math.ceil(exclusiveMinimum) : exclusiveMinimum
  }
  if (typeof minimum === "number") {
    const value = exclusiveMinimum === true ? minimum + 1 : minimum
    return integer ? Math.ceil(value) : value
  }
  if (typeof exclusiveMaximum === "number") {
    return integer ? Math.floor(exclusiveMaximum) : exclusiveMaximum
  }
  if (typeof maximum === "number") {
    const value = exclusiveMaximum === true ? maximum - 1 : maximum
    return integer ? Math.floor(value) : value
  }

  return 0
}

function stringExample(schema: Schema): string {
  switch (schema.format) {
    case "date":
      return "2020-01-01"
    case "date-time":
      return "2020-01-01T00:00:00.000Z"
    case "time":
      return "00:00:00Z"
    case "email":
      return "user@example.com"
    case "hostname":
      return "example.com"
    case "ipv4":
      return "192.0.2.1"
    case "ipv6":
      return "2001:db8::1"
    case "uri":
    case "uri-reference":
    case "url":
      return "https://example.com"
    case "uuid":
      return "00000000-0000-4000-8000-000000000000"
    case "byte":
    case "binary":
      return ""
    default:
      return "string"
  }
}

function mergeObjectExamples(values: unknown[]): unknown {
  const objects = values.filter(isRecord)
  if (!objects.length) {
    return values[0] ?? {}
  }

  return objects.reduce<JsonObject>((result, value) => {
    for (const [key, item] of Object.entries(value)) {
      if (!hasOwn(result, key)) {
        result[key] = cloneValue(item)
      }
    }
    return result
  }, {})
}

function schemaExample(schema: unknown, seen: Set<unknown>): unknown {
  if (!isRecord(schema) || seen.has(schema)) {
    return {}
  }

  const nextSeen = new Set(seen)
  nextSeen.add(schema)

  for (const key of ["example", "default", "const"] as const) {
    if (hasOwn(schema, key)) {
      return cloneValue(schema[key])
    }
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return cloneValue(schema.enum[0])
  }

  if (schema.nullable === true) {
    return null
  }

  const schemaType = schema.type
  if (Array.isArray(schemaType)) {
    if (schemaType.includes("null")) {
      return null
    }
    const nonNullType = schemaType.find((value) => typeof value === "string")
    return nonNullType
      ? schemaExample({ ...schema, type: nonNullType }, nextSeen)
      : {}
  }

  const anyOf = firstSchemaBranch(schema, "anyOf")
  if (anyOf) {
    return schemaExample(anyOf, nextSeen)
  }

  const oneOf = firstSchemaBranch(schema, "oneOf")
  if (oneOf) {
    return schemaExample(oneOf, nextSeen)
  }

  if (Array.isArray(schema.allOf)) {
    return mergeObjectExamples(
      schema.allOf
        .filter(isRecord)
        .map((branch) => schemaExample(branch, nextSeen))
    )
  }

  if (isRecord(schema.properties) || schemaType === "object") {
    const properties = isRecord(schema.properties) ? schema.properties : {}
    const required = Array.isArray(schema.required)
      ? new Set(
          schema.required.filter(
            (key): key is string => typeof key === "string"
          )
        )
      : undefined
    const result: JsonObject = {}

    for (const [key, property] of Object.entries(properties)) {
      if (!required || required.has(key)) {
        result[key] = schemaExample(property, nextSeen)
      }
    }
    return result
  }

  if (schemaType === "array") {
    return isRecord(schema.items) ? [schemaExample(schema.items, nextSeen)] : []
  }

  if (schemaType === "string" || typeof schema.format === "string") {
    return stringExample(schema)
  }
  if (schemaType === "integer") {
    return numberExample(schema, true)
  }
  if (schemaType === "number") {
    return numberExample(schema, false)
  }
  if (schemaType === "boolean") {
    return false
  }
  if (schemaType === "null") {
    return null
  }

  return {}
}

/** Generate stable, non-authoritative examples from JSON Schema. */
export function generateSchemaExample(schema: unknown): unknown {
  return schemaExample(schema, new Set())
}

function mediaPlaceholder(mediaType: string): unknown {
  const normalized = mediaType.toLowerCase()
  if (normalized.includes("json")) {
    return {}
  }
  if (normalized.startsWith("text/") || normalized.includes("xml")) {
    return "string"
  }
  if (normalized.includes("binary") || normalized.includes("octet-stream")) {
    return ""
  }
  return {}
}

function enrichContent(content: unknown): void {
  if (!isRecord(content)) {
    return
  }

  for (const [mediaType, mediaValue] of Object.entries(content)) {
    if (!isRecord(mediaValue)) {
      continue
    }

    const schema = mediaValue.schema
    if (isRecord(schema)) {
      if (!hasOwn(schema, "example")) {
        schema.example = generateSchemaExample(schema)
      }
      if (!hasOwn(mediaValue, "example") && !hasOwn(mediaValue, "examples")) {
        mediaValue.example = cloneValue(schema.example)
      }
    } else if (
      !hasOwn(mediaValue, "example") &&
      !hasOwn(mediaValue, "examples")
    ) {
      mediaValue.example = mediaPlaceholder(mediaType)
    }
  }
}

function fallbackSchema(): Schema {
  return {
    type: "object",
    additionalProperties: true,
    example: {},
    [FALLBACK_EXTENSION]: true,
  }
}

function fallbackRequestBody(): JsonObject {
  return {
    description:
      "Generic JSON request body fallback; inferred schema unavailable.",
    required: false,
    [FALLBACK_EXTENSION]: true,
    content: {
      "application/json": {
        schema: fallbackSchema(),
        example: {},
      },
    },
  }
}

function fallbackResponse(): JsonObject {
  return {
    description: "Generic JSON response fallback; inferred schema unavailable.",
    [FALLBACK_EXTENSION]: true,
    content: {
      "application/json": {
        schema: fallbackSchema(),
        example: {},
      },
    },
  }
}

function responseHasContent(response: unknown): boolean {
  return (
    isRecord(response) &&
    isRecord(response.content) &&
    Object.keys(response.content).length > 0
  )
}

function fallbackResponseFor(responses: JsonObject): JsonObject {
  const existing = responses["200"]
  if (isRecord(existing)) {
    if (!responseHasContent(existing)) {
      const fallback = fallbackResponse()
      existing.content = fallback.content
      existing[FALLBACK_EXTENSION] = true
      if (!hasOwn(existing, "description")) {
        existing.description = fallback.description
      }
    }
    return existing
  }

  const response = fallbackResponse()
  responses["200"] = response
  return response
}

function enrichRequestBody(requestBody: JsonObject): void {
  if (hasOwn(requestBody, "$ref")) {
    return
  }

  if (
    !isRecord(requestBody.content) ||
    Object.keys(requestBody.content).length === 0
  ) {
    const fallback = fallbackRequestBody()
    requestBody.content = fallback.content
    requestBody[FALLBACK_EXTENSION] = true
    if (!hasOwn(requestBody, "description")) {
      requestBody.description = fallback.description
    }
    return
  }

  enrichContent(requestBody.content)
}

function operationTag(path: string): string {
  const segment = path.split("/").find(Boolean)
  if (!segment) {
    return "API"
  }
  return segment
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function enrichOperation(
  operation: JsonObject,
  method: string,
  path: string
): void {
  const operationName = `${method.toUpperCase()} ${path}`
  if (!hasOwn(operation, "tags")) {
    operation.tags = [operationTag(path)]
  }
  if (!hasOwn(operation, "summary")) {
    operation.summary = operationName
  }
  if (!hasOwn(operation, "description")) {
    operation.description = `${operationName} operation.`
  }

  const requestBody = operation.requestBody
  if (
    WRITE_METHODS.has(method) &&
    (!hasOwn(operation, "requestBody") || requestBody === undefined)
  ) {
    operation.requestBody = fallbackRequestBody()
  } else if (isRecord(requestBody)) {
    enrichRequestBody(requestBody)
  }

  let responses: JsonObject
  if (isRecord(operation.responses)) {
    responses = operation.responses
  } else {
    responses = {}
    operation.responses = responses
  }

  if (Object.values(responses).some(responseHasContent)) {
    for (const response of Object.values(responses)) {
      if (isRecord(response)) {
        enrichContent(response.content)
      }
    }
  } else {
    fallbackResponseFor(responses)
  }
}

/** Return cloned document enriched with deterministic, explicitly marked fallbacks. */
export function enrichOpenApiDocument(document: unknown): OpenApiDocument {
  const enriched = cloneValue(document)
  if (!isRecord(enriched) || !isRecord(enriched.paths)) {
    return enriched as OpenApiDocument
  }

  for (const [path, pathItem] of Object.entries(enriched.paths)) {
    if (!isRecord(pathItem)) {
      continue
    }

    for (const method of OPERATION_METHODS) {
      const operation = pathItem[method]
      if (isRecord(operation)) {
        enrichOperation(operation, method, path)
      }
    }
  }

  return enriched as OpenApiDocument
}
