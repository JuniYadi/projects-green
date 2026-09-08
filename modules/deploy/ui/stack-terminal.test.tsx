import { describe, it, expect } from "bun:test"
import { StackTerminal } from "./stack-terminal"

describe("StackTerminal component", () => {
  it("exports a valid React component", () => {
    expect(typeof StackTerminal).toBe("function")
  })
})
