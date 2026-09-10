import { describe, expect, it } from "bun:test"
import { createMetaAppSchema, updateMetaAppSchema } from "./meta-apps.schemas"

describe("meta-apps.schemas", () => {
  it("accepts valid create and update inputs", () => {
    expect(
      createMetaAppSchema.parse({
        name: " Primary ",
        metaAppId: "123456789",
        appSecret: "app-secret",
        verifyToken: "verify-token",
        systemToken: "master-token",
        defaultVersion: "v25.0",
        active: true,
      })
    ).toEqual({
      name: "Primary",
      metaAppId: "123456789",
      appSecret: "app-secret",
      verifyToken: "verify-token",
      systemToken: "master-token",
      defaultVersion: "v25.0",
      active: true,
    })

    expect(
      updateMetaAppSchema.parse({
        systemToken: "new-master-token",
        defaultVersion: "v25.0",
      })
    ).toEqual({
      systemToken: "new-master-token",
      defaultVersion: "v25.0",
    })
  })

  it("defaults defaultVersion to v24.0 when omitted", () => {
    const parsed = createMetaAppSchema.parse({
      name: "Default App",
      metaAppId: "123456789",
      appSecret: "secret",
      verifyToken: "token",
    })
    expect(parsed.defaultVersion).toBe("v24.0")
  })

  it("rejects invalid input shapes", () => {
    expect(() =>
      createMetaAppSchema.parse({
        name: "",
        metaAppId: "1",
        appSecret: "secret",
        verifyToken: "token",
      })
    ).toThrow()

    expect(() => updateMetaAppSchema.parse({})).toThrow()
  })
})
