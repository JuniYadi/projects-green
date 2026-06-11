import { describe, expect, it, mock } from "bun:test"

import { createConsoleVoucherRoutes } from "./console-vouchers.route"

function createDeps() {
  return {
    authenticate: mock(() => ({
      user: { id: "user_1", email: "user@test.com" },
      organizationId: "org_1",
      role: "member",
      roles: ["member"],
    })),
    service: {
      redeemVoucher: mock(() => ({
        claimId: "claim_1",
        voucherCode: "TEST1234",
        amount: "50000",
        currency: "IDR",
        adjustmentId: "adj_1",
      })),
      getUserClaims: mock(() => []),
    },
  }
}

const toApp = (deps: ReturnType<typeof createDeps>) =>
  createConsoleVoucherRoutes(deps)

describe("Console Voucher Routes", () => {
  describe("POST /redeem", () => {
    it("returns 401 when unauthenticated", async () => {
      const deps = createDeps()
      deps.authenticate = mock(() => ({ user: null }))

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "TEST1234" }),
        }),
      )

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when no organization", async () => {
      const deps = createDeps()
      deps.authenticate = mock(() => ({
        user: { id: "user_1", email: "user@test.com" },
        organizationId: null,
        role: null,
        roles: null,
      }))

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "TEST1234" }),
        }),
      )

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("redeems a valid code successfully", async () => {
      const deps = createDeps()

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "TEST1234" }),
        }),
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.voucherCode).toBe("TEST1234")
      expect(body.data.amount).toBe("50000")
    })

    it("normalizes code to uppercase", async () => {
      const deps = createDeps()

      await toApp(deps).handle(
        new Request("http://localhost/vouchers/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "test1234" }),
        }),
      )

      expect(deps.service.redeemVoucher).toHaveBeenCalledWith(
        expect.objectContaining({ code: "TEST1234" }),
      )
    })

    it("rejects empty code", async () => {
      const res = await toApp(createDeps()).handle(
        new Request("http://localhost/vouchers/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "" }),
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe("GET /claims", () => {
    it("returns 401 when unauthenticated", async () => {
      const deps = createDeps()
      deps.authenticate = mock(() => ({ user: null }))

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/claims"),
      )

      expect(res.status).toBe(401)
    })

    it("returns claim history for authenticated user", async () => {
      const deps = createDeps()
      deps.service.getUserClaims = mock(() => [
        {
          id: "claim_1",
          voucherId: "v_1",
          workosUserId: "user_1",
          organizationId: "org_1",
          billingAdjustmentId: "adj_1",
          claimedAt: new Date(),
          voucher: {
            code: "TEST1234",
            amount: { toFixed: () => "50000" },
            currency: "IDR",
          },
        },
      ])

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/claims"),
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].voucher.code).toBe("TEST1234")
    })
  })
})
