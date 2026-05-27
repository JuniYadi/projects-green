import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { createEnvironmentVariablesClient } from "./environment-variables.client"

describe("environment-variables.client", () => {
  let client: ReturnType<typeof createEnvironmentVariablesClient>

  beforeEach(() => {
    client = createEnvironmentVariablesClient()
  })

  describe("list", () => {
    it("falls back to stub when not in browser", async () => {
      // In test env, fetch is not called, so stub is used
      const result = await client.list("test-env")
      expect(Array.isArray(result)).toBe(true)
    })

    it("returns array of variables", async () => {
      const result = await client.list("staging")
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe("create", () => {
    it("creates variable via stub in test env", async () => {
      const result = await client.create({
        environmentId: "test-env",
        key: "NEW_VAR",
        value: "new-value",
      })

      expect(result).toBeDefined()
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.item?.key).toBe("NEW_VAR")
      }
    })

    it("returns validation error for invalid input", async () => {
      const result = await client.create({
        environmentId: "test-env",
        key: "invalid-key",
        value: "test",
      })

      expect(result).toBeDefined()
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("INVALID_KEY")
      }
    })

    it("creates with explicit type and scope", async () => {
      const result = await client.create({
        environmentId: "test-env",
        key: "CUSTOM_VAR",
        value: "custom-value",
        type: "plain",
        scope: "all",
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.item?.type).toBe("plain")
        expect(result.item?.scope).toBe("all")
      }
    })

    it("creates secret variable", async () => {
      const result = await client.create({
        environmentId: "test-env",
        key: "MY_SECRET",
        value: "secret-value",
        type: "secret",
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.item?.type).toBe("secret")
        expect(result.item?.value).toBe("")
      }
    })
  })

  describe("update", () => {
    it("returns not found for non-existent variable", async () => {
      const result = await client.update({
        environmentId: "test-env",
        variableId: "non-existent-id",
        key: "SOME_KEY",
      })

      expect(result).toBeDefined()
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })

    it("updates existing variable", async () => {
      const create = await client.create({
        environmentId: "test-env",
        key: "UPDATE_TEST",
        value: "original",
      })

      if (!create.ok) throw new Error("Setup failed")

      const result = await client.update({
        environmentId: "test-env",
        variableId: create.item!.id,
        key: "UPDATE_TEST",
        value: "updated",
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.item?.value).toBe("updated")
      }
    })

    it("returns validation error for invalid key", async () => {
      const create = await client.create({
        environmentId: "test-env",
        key: "VALID_KEY",
        value: "test",
      })

      if (!create.ok) throw new Error("Setup failed")

      const result = await client.update({
        environmentId: "test-env",
        variableId: create.item!.id,
        key: "invalid-key",
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("INVALID_KEY")
      }
    })
  })

  describe("remove", () => {
    it("deletes existing variable", async () => {
      const create = await client.create({
        environmentId: "test-env",
        key: "DELETE_ME",
        value: "test",
      })

      if (!create.ok) throw new Error("Setup failed")

      const result = await client.remove({
        environmentId: "test-env",
        variableId: create.item!.id,
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.deletedId).toBe(create.item!.id)
      }
    })

    it("returns not found for non-existent variable", async () => {
      const result = await client.remove({
        environmentId: "test-env",
        variableId: "non-existent-id",
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })
  })

  describe("import", () => {
    it("imports valid dotenv content", async () => {
      const result = await client.import({
        environmentId: "test-env",
        raw: "KEY1=value1\nKEY2=value2",
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.importedCount).toBe(2)
      }
    })

    it("returns validation error for invalid syntax", async () => {
      const result = await client.import({
        environmentId: "test-env",
        raw: "INVALID_LINE",
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("VALIDATION_ERROR")
      }
    })

    it("returns validation error for empty content", async () => {
      const result = await client.import({
        environmentId: "test-env",
        raw: "",
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("VALIDATION_ERROR")
      }
    })

    it("imports with custom scope", async () => {
      const result = await client.import({
        environmentId: "test-env",
        raw: "SCOPE_VAR=value",
        scope: "build",
      })

      expect(result.ok).toBe(true)

      const list = await client.list("test-env")
      const imported = list.find((v) => v.key === "SCOPE_VAR")
      expect(imported?.scope).toBe("build")
    })
  })
})