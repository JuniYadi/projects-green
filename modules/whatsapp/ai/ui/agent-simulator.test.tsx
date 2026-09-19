import { describe, expect, it } from "bun:test"
import WhatsAppAgentSimulator, {
  AgentSimulator as NamedSimulator,
} from "./agent-simulator"

describe("WhatsApp AI Agent Simulator Re-export", () => {
  it("re-exports default and named AgentSimulator component", () => {
    expect(typeof WhatsAppAgentSimulator).toBe("function")
    expect(typeof NamedSimulator).toBe("function")
  })
})
