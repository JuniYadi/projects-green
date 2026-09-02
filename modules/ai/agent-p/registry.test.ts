import { describe, expect, it } from "bun:test"
import { agentPRegistry } from "./registry"

describe("agentPRegistry", () => {
  it("registers tools correctly", () => {
    expect(agentPRegistry.get("whatsapp.contact.normalize")).toBeDefined()
  })
})
