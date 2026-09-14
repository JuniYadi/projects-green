import { describe, expect, it } from "bun:test"
import {
  flattenObject,
  getNestedValue,
  discoverLogFields,
  formatAttributeValue,
} from "./log-table-utils"

describe("log-table-utils", () => {
  describe("flattenObject", () => {
    it("flattens nested objects into dot notation", () => {
      const input = {
        status: 200,
        http: {
          method: "POST",
          response: {
            code: 502,
          },
        },
        message: "hello",
      }

      const flat = flattenObject(input)
      expect(flat["status"]).toBe(200)
      expect(flat["http.method"]).toBe("POST")
      expect(flat["http.response.code"]).toBe(502)
      expect(flat["message"]).toBe("hello")
    })

    it("handles primitives and arrays", () => {
      const input = {
        tags: ["prod", "asia"],
        active: true,
        count: 0,
      }

      const flat = flattenObject(input)
      expect(flat["tags"]).toBe("prod, asia")
      expect(flat["active"]).toBe(true)
      expect(flat["count"]).toBe(0)
    })
  })

  describe("getNestedValue", () => {
    it("retrieves deep nested properties", () => {
      const obj = {
        kubernetes: {
          pod_name: "hermes-0",
          labels: {
            env: "production",
          },
        },
      }

      expect(getNestedValue(obj, "kubernetes.pod_name")).toBe("hermes-0")
      expect(getNestedValue(obj, "kubernetes.labels.env")).toBe("production")
      expect(getNestedValue(obj, "kubernetes.missing")).toBeUndefined()
      expect(getNestedValue(null, "foo.bar")).toBeUndefined()
    })
  })

  describe("discoverLogFields", () => {
    it("discovers all unique custom fields from log entries excluding default columns", () => {
      const logs = [
        {
          timestamp: "12:00",
          level: "INFO",
          source: "app",
          message: "ready",
          raw: {
            http: { status: 200, method: "GET" },
            duration_ms: 45,
          },
        },
        {
          timestamp: "12:01",
          level: "ERROR",
          source: "app",
          message: "failed",
          raw: {
            http: { status: 502 },
            error: { kind: "Timeout" },
          },
        },
      ]

      const fields = discoverLogFields(logs)
      expect(fields).toContain("http.status")
      expect(fields).toContain("http.method")
      expect(fields).toContain("duration_ms")
      expect(fields).toContain("error.kind")
      // Should not contain internal / already covered fields
      expect(fields).not.toContain("message")
      expect(fields).not.toContain("timestamp")
      expect(fields).not.toContain("level")
    })
  })

  describe("formatAttributeValue", () => {
    it("formats different value types cleanly", () => {
      expect(formatAttributeValue("test")).toBe("test")
      expect(formatAttributeValue(42)).toBe("42")
      expect(formatAttributeValue(true)).toBe("true")
      expect(formatAttributeValue(false)).toBe("false")
      expect(formatAttributeValue(null)).toBe("-")
      expect(formatAttributeValue(undefined)).toBe("-")
      expect(formatAttributeValue({ foo: "bar" })).toBe('{"foo":"bar"}')
    })
  })
})
