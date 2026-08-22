import { describe, expect, it } from "bun:test"
import { APP_NAME } from "@/lib/app-config"

describe("app-config", () => {
  it("defaults APP_NAME to PFNApp", () => {
    expect(APP_NAME).toBe("PFNApp")
  })
})
