import { describe, expect, it } from "bun:test"
import type { AiDeploymentSessionStatus } from "@prisma/client"
import {
  isTerminal,
  isValidTransition,
  canConfirm,
  canExecute,
  type Transition,
} from "./ai-deployment-session.transitions"

describe("ai-deployment-session transitions", () => {
  describe("isValidTransition", () => {
    const valid: Transition[] = [
      ["COLLECTING", "INSPECTING"],
      ["COLLECTING", "BLOCKED"],
      ["INSPECTING", "PLAN_READY"],
      ["INSPECTING", "BLOCKED"],
      ["INSPECTING", "FAILED"],
      ["BLOCKED", "COLLECTING"],
      ["BLOCKED", "INSPECTING"],
      ["PLAN_READY", "COLLECTING"],
      ["PLAN_READY", "CONFIRMED"],
      ["CONFIRMED", "EXECUTING"],
      ["EXECUTING", "SUCCEEDED"],
      ["EXECUTING", "FAILED"],
      ["FAILED", "COLLECTING"],
      ["FAILED", "PLAN_READY"],
    ]

    for (const [from, to] of valid) {
      it(`allows ${from} → ${to}`, () => {
        expect(isValidTransition(from, to)).toBe(true)
      })
    }

    const invalid: Transition[] = [
      ["COLLECTING", "CONFIRMED"],
      ["COLLECTING", "EXECUTING"],
      ["INSPECTING", "CONFIRMED"],
      ["INSPECTING", "EXECUTING"],
      ["BLOCKED", "CONFIRMED"],
      ["BLOCKED", "EXECUTING"],
      ["PLAN_READY", "EXECUTING"],
      ["CONFIRMED", "PLAN_READY"],
      ["CONFIRMED", "COLLECTING"],
      ["EXECUTING", "COLLECTING"],
      ["EXECUTING", "CONFIRMED"],
      ["SUCCEEDED", "COLLECTING"],
      ["SUCCEEDED", "EXECUTING"],
      ["CANCELLED", "COLLECTING"],
      ["CANCELLED", "EXECUTING"],
    ]

    for (const [from, to] of invalid) {
      it(`rejects ${from} → ${to}`, () => {
        expect(isValidTransition(from, to)).toBe(false)
      })
    }

    it("rejects self-transitions", () => {
      const statuses: AiDeploymentSessionStatus[] = [
        "COLLECTING",
        "INSPECTING",
        "BLOCKED",
        "PLAN_READY",
        "CONFIRMED",
        "EXECUTING",
        "SUCCEEDED",
        "FAILED",
        "CANCELLED",
      ]
      for (const s of statuses) {
        expect(isValidTransition(s, s)).toBe(false)
      }
    })
  })

  describe("isTerminal", () => {
    it("returns true for SUCCEEDED, FAILED, CANCELLED", () => {
      expect(isTerminal("SUCCEEDED")).toBe(true)
      expect(isTerminal("FAILED")).toBe(true)
      expect(isTerminal("CANCELLED")).toBe(true)
    })

    it("returns false for non-terminal states", () => {
      expect(isTerminal("COLLECTING")).toBe(false)
      expect(isTerminal("INSPECTING")).toBe(false)
      expect(isTerminal("BLOCKED")).toBe(false)
      expect(isTerminal("PLAN_READY")).toBe(false)
      expect(isTerminal("CONFIRMED")).toBe(false)
      expect(isTerminal("EXECUTING")).toBe(false)
    })
  })

  describe("canConfirm", () => {
    it("allows confirmation only from PLAN_READY", () => {
      expect(canConfirm("PLAN_READY")).toBe(true)
      expect(canConfirm("COLLECTING")).toBe(false)
      expect(canConfirm("CONFIRMED")).toBe(false)
      expect(canConfirm("EXECUTING")).toBe(false)
    })
  })

  describe("canExecute", () => {
    it("allows execution only from CONFIRMED", () => {
      expect(canExecute("CONFIRMED")).toBe(true)
      expect(canExecute("PLAN_READY")).toBe(false)
      expect(canExecute("EXECUTING")).toBe(false)
      expect(canExecute("COLLECTING")).toBe(false)
    })
  })

  describe("any non-terminal → CANCELLED", () => {
    it("allows cancel from every non-terminal state", () => {
      const nonTerminal: AiDeploymentSessionStatus[] = [
        "COLLECTING",
        "INSPECTING",
        "BLOCKED",
        "PLAN_READY",
        "CONFIRMED",
        "EXECUTING",
      ]
      for (const s of nonTerminal) {
        expect(isValidTransition(s, "CANCELLED")).toBe(true)
      }
    })

    it("rejects cancel from terminal states", () => {
      expect(isValidTransition("SUCCEEDED", "CANCELLED")).toBe(false)
      expect(isValidTransition("FAILED", "CANCELLED")).toBe(false)
      expect(isValidTransition("CANCELLED", "CANCELLED")).toBe(false)
    })
  })
})
