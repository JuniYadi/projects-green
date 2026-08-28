import { describe, expect, it } from "bun:test"
import {
  isValidTransition,
  isTerminal,
  canConfirm,
  canExecute,
  NON_TERMINAL,
} from "./ai-deployment-session.transitions"
import type { AiDeploymentSessionStatus } from "@prisma/client"

describe("ai-deployment-session.transitions", () => {
  describe("isValidTransition", () => {
    it("rejects transition to the same status (reflexive)", () => {
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

      for (const status of statuses) {
        expect(isValidTransition(status, status)).toBe(false)
      }
    })

    it("allows valid transitions from COLLECTING", () => {
      expect(isValidTransition("COLLECTING", "INSPECTING")).toBe(true)
      expect(isValidTransition("COLLECTING", "BLOCKED")).toBe(true)
      expect(isValidTransition("COLLECTING", "CANCELLED")).toBe(true)
      expect(isValidTransition("COLLECTING", "EXECUTING")).toBe(false)
      expect(isValidTransition("COLLECTING", "SUCCEEDED")).toBe(false)
    })

    it("allows valid transitions from INSPECTING", () => {
      expect(isValidTransition("INSPECTING", "PLAN_READY")).toBe(true)
      expect(isValidTransition("INSPECTING", "BLOCKED")).toBe(true)
      expect(isValidTransition("INSPECTING", "FAILED")).toBe(true)
      expect(isValidTransition("INSPECTING", "CANCELLED")).toBe(true)
      expect(isValidTransition("INSPECTING", "CONFIRMED")).toBe(false)
    })

    it("allows valid transitions from BLOCKED", () => {
      expect(isValidTransition("BLOCKED", "COLLECTING")).toBe(true)
      expect(isValidTransition("BLOCKED", "INSPECTING")).toBe(true)
      expect(isValidTransition("BLOCKED", "CANCELLED")).toBe(true)
      expect(isValidTransition("BLOCKED", "PLAN_READY")).toBe(false)
    })

    it("allows valid transitions from PLAN_READY", () => {
      expect(isValidTransition("PLAN_READY", "COLLECTING")).toBe(true)
      expect(isValidTransition("PLAN_READY", "CONFIRMED")).toBe(true)
      expect(isValidTransition("PLAN_READY", "CANCELLED")).toBe(true)
      expect(isValidTransition("PLAN_READY", "EXECUTING")).toBe(false)
    })

    it("allows valid transitions from CONFIRMED", () => {
      expect(isValidTransition("CONFIRMED", "EXECUTING")).toBe(true)
      expect(isValidTransition("CONFIRMED", "CANCELLED")).toBe(true)
      expect(isValidTransition("CONFIRMED", "SUCCEEDED")).toBe(false)
    })

    it("allows valid transitions from EXECUTING", () => {
      expect(isValidTransition("EXECUTING", "SUCCEEDED")).toBe(true)
      expect(isValidTransition("EXECUTING", "FAILED")).toBe(true)
      expect(isValidTransition("EXECUTING", "CANCELLED")).toBe(true)
      expect(isValidTransition("EXECUTING", "PLAN_READY")).toBe(false)
    })

    it("allows retry transitions from FAILED", () => {
      expect(isValidTransition("FAILED", "COLLECTING")).toBe(true)
      expect(isValidTransition("FAILED", "PLAN_READY")).toBe(true)
      expect(isValidTransition("FAILED", "EXECUTING")).toBe(false)
      expect(isValidTransition("FAILED", "CANCELLED")).toBe(false) // FAILED is terminal so cannot cancel
    })

    it("handles CANCELLED transitions", () => {
      // Non-terminal states can transition to CANCELLED
      expect(isValidTransition("COLLECTING", "CANCELLED")).toBe(true)
      expect(isValidTransition("INSPECTING", "CANCELLED")).toBe(true)
      expect(isValidTransition("BLOCKED", "CANCELLED")).toBe(true)
      expect(isValidTransition("PLAN_READY", "CANCELLED")).toBe(true)
      expect(isValidTransition("CONFIRMED", "CANCELLED")).toBe(true)
      expect(isValidTransition("EXECUTING", "CANCELLED")).toBe(true)

      // Terminal states cannot transition to CANCELLED
      expect(isValidTransition("SUCCEEDED", "CANCELLED")).toBe(false)
      expect(isValidTransition("FAILED", "CANCELLED")).toBe(false)
      expect(isValidTransition("CANCELLED", "CANCELLED")).toBe(false)
    })

    it("rejects invalid forward/backward jumps", () => {
      expect(isValidTransition("COLLECTING", "SUCCEEDED")).toBe(false)
      expect(isValidTransition("SUCCEEDED", "EXECUTING")).toBe(false)
      expect(isValidTransition("SUCCEEDED", "COLLECTING")).toBe(false)
      expect(isValidTransition("CANCELLED", "COLLECTING")).toBe(false)
    })
  })

  describe("isTerminal", () => {
    it("returns true for terminal states", () => {
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
    it("returns true only for PLAN_READY", () => {
      expect(canConfirm("PLAN_READY")).toBe(true)
      expect(canConfirm("COLLECTING")).toBe(false)
      expect(canConfirm("INSPECTING")).toBe(false)
      expect(canConfirm("BLOCKED")).toBe(false)
      expect(canConfirm("CONFIRMED")).toBe(false)
      expect(canConfirm("EXECUTING")).toBe(false)
      expect(canConfirm("SUCCEEDED")).toBe(false)
      expect(canConfirm("FAILED")).toBe(false)
      expect(canConfirm("CANCELLED")).toBe(false)
    })
  })

  describe("canExecute", () => {
    it("returns true only for CONFIRMED", () => {
      expect(canExecute("CONFIRMED")).toBe(true)
      expect(canExecute("PLAN_READY")).toBe(false)
      expect(canExecute("COLLECTING")).toBe(false)
      expect(canExecute("INSPECTING")).toBe(false)
      expect(canExecute("BLOCKED")).toBe(false)
      expect(canExecute("EXECUTING")).toBe(false)
      expect(canExecute("SUCCEEDED")).toBe(false)
      expect(canExecute("FAILED")).toBe(false)
      expect(canExecute("CANCELLED")).toBe(false)
    })
  })

  describe("NON_TERMINAL", () => {
    it("contains exactly all 6 non-terminal statuses", () => {
      expect(NON_TERMINAL).toHaveLength(6)
      expect(NON_TERMINAL).toEqual([
        "COLLECTING",
        "INSPECTING",
        "BLOCKED",
        "PLAN_READY",
        "CONFIRMED",
        "EXECUTING",
      ])
    })
  })
})
