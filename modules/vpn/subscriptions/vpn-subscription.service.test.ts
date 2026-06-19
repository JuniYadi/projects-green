import { describe, it, expect, beforeEach, mock } from "bun:test"
import { Prisma } from "@prisma/client"

import {
  VpnBillingAccountNotFoundError,
  VpnInsufficientBalanceError,
  VpnPackageUnavailableError,
  VpnSubscriptionService,
  buildAccountUsername,
} from "./vpn-subscription.service"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any

const pkgFindUnique = mock<AnyFn>(async () => null)
const subFindFirst = mock<AnyFn>(async () => null)
const subCreate = mock<AnyFn>(async () => ({}))
const subUpdate = mock<AnyFn>(async () => ({}))
const subDelete = mock<AnyFn>(async () => ({}))
const debitServiceBalance = mock<AnyFn>(async () => ({}))
const dispatch = mock<AnyFn>(async () => {})

const prismaMock = {
  vpnPackage: { findUnique: pkgFindUnique },
  vpnSubscription: {
    findFirst: subFindFirst,
    create: subCreate,
    update: subUpdate,
    delete: subDelete,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transactions = { debitServiceBalance } as any

const service = new VpnSubscriptionService(prismaMock, {
  transactions,
  dispatch,
})

function decimal(value: string) {
  return new Prisma.Decimal(value)
}

const activePackage = {
  id: "pkg-1",
  name: "Global Bundle",
  isActive: true,
  price: decimal("100000"),
  currency: "IDR",
  servers: [
    {
      server: {
        id: "srv-1",
        hasOpenVpn: true,
        hasWireGuard: true,
        hasProxy: false,
      },
    },
    {
      server: {
        id: "srv-2",
        hasOpenVpn: false,
        hasWireGuard: false,
        hasProxy: true,
      },
    },
  ],
}

const createdSub = {
  id: "sub-1",
  serverAccounts: [{ id: "sa-1" }, { id: "sa-2" }, { id: "sa-3" }],
}

beforeEach(() => {
  pkgFindUnique.mockClear()
  subFindFirst.mockClear()
  subCreate.mockClear()
  subUpdate.mockClear()
  subDelete.mockClear()
  debitServiceBalance.mockClear()
  dispatch.mockClear()
  pkgFindUnique.mockResolvedValue(activePackage)
  subFindFirst.mockResolvedValue(null)
  subCreate.mockResolvedValue(createdSub)
  subUpdate.mockResolvedValue(createdSub)
  subDelete.mockResolvedValue(createdSub)
  debitServiceBalance.mockResolvedValue({})
})

describe("buildAccountUsername", () => {
  it("follows the vpn-{org}-{server}-{protocol}-{suffix} scheme with random suffix", () => {
    const result = buildAccountUsername("org_abc", "srv1", "OPENVPN")
    expect(result).toMatch(/^vpn-orgabc-srv1-openvpn-[0-9a-f]{4}$/)
  })
})

describe("VpnSubscriptionService.purchase", () => {
  it("creates one account per enabled protocol per server", async () => {
    await service.purchase({ organizationId: "org-1", packageId: "pkg-1" })
    const accounts = subCreate.mock.calls[0][0].data.serverAccounts.create
    // srv-1: OpenVPN + WireGuard, srv-2: Proxy = 3 accounts
    expect(accounts).toHaveLength(3)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(accounts.map((a: any) => a.protocol).sort()).toEqual([
      "OPENVPN",
      "PROXY",
      "WIREGUARD",
    ])
  })

  it("debits balance then activates and dispatches provisioning", async () => {
    await service.purchase({ organizationId: "org-1", packageId: "pkg-1" })
    expect(debitServiceBalance).toHaveBeenCalledTimes(1)
    expect(subUpdate.mock.calls[0][0].data).toEqual({ status: "ACTIVE" })
    expect(dispatch).toHaveBeenCalledTimes(3)
  })

  it("rejects an inactive or missing package", async () => {
    pkgFindUnique.mockResolvedValue({ ...activePackage, isActive: false })
    await expect(
      service.purchase({ organizationId: "org-1", packageId: "pkg-1" })
    ).rejects.toBeInstanceOf(VpnPackageUnavailableError)
    expect(subCreate).not.toHaveBeenCalled()
  })

  it("maps INSUFFICIENT_BALANCE and cleans up the orphaned subscription", async () => {
    debitServiceBalance.mockRejectedValue(new Error("INSUFFICIENT_BALANCE"))
    await expect(
      service.purchase({ organizationId: "org-1", packageId: "pkg-1" })
    ).rejects.toBeInstanceOf(VpnInsufficientBalanceError)
    expect(dispatch).not.toHaveBeenCalled()
    // No activation update happened
    expect(subUpdate).not.toHaveBeenCalled()
    // Failed charge must not leave an orphaned subscription behind.
    expect(subDelete).toHaveBeenCalledTimes(1)
    expect(subDelete.mock.calls[0][0]).toEqual({ where: { id: "sub-1" } })
  })

  it("maps BILLING_ACCOUNT_NOT_FOUND and cleans up the orphaned subscription", async () => {
    debitServiceBalance.mockRejectedValue(
      new Error("BILLING_ACCOUNT_NOT_FOUND")
    )
    await expect(
      service.purchase({ organizationId: "org-1", packageId: "pkg-1" })
    ).rejects.toBeInstanceOf(VpnBillingAccountNotFoundError)
    expect(dispatch).not.toHaveBeenCalled()
    expect(subUpdate).not.toHaveBeenCalled()
    expect(subDelete).toHaveBeenCalledTimes(1)
  })

  it("charges full amount when purchased on the 1st of the month", async () => {
    // June 1, 2026 — full month, no pro-rata
    const june1 = new Date("2026-06-01T00:00:00Z")
    await service.purchase({
      organizationId: "org-1",
      packageId: "pkg-1",
      now: june1,
    })

    expect(debitServiceBalance).toHaveBeenCalled()
    const { amount, line } = debitServiceBalance.mock.calls[0][0]
    expect(amount.toString()).toBe("100000")
    expect(line.quantity.toString()).toBe("1")
    expect(line.description).toBe('VPN package "Global Bundle" — 2026-06')
  })

  it("charges pro-rated amount for mid-month purchase", async () => {
    // June 14, 2026 — 17 days remaining, charge = 17/30 × 100000 = 56666.66
    const june14 = new Date("2026-06-14T00:00:00Z")
    await service.purchase({
      organizationId: "org-1",
      packageId: "pkg-1",
      now: june14,
    })

    expect(debitServiceBalance).toHaveBeenCalled()
    const { amount, line } = debitServiceBalance.mock.calls[0][0]

    // 17/30 = 0.5666... × 100000 = 56666.66, ROUND_DOWN → 56666.66
    expect(amount.toString()).toBe("56666.66")
    expect(line.description).toBe(
      'VPN package "Global Bundle" — 17/30 month (2026-06)'
    )
    expect(line.unitPrice.toString()).toBe("100000")
  })

  it("charges pro-rated amount for end-of-month purchase", async () => {
    // June 30, 2026 — 1 day remaining, charge = 1/30 × 100000 = 3333.33
    const june30 = new Date("2026-06-30T00:00:00Z")
    await service.purchase({
      organizationId: "org-1",
      packageId: "pkg-1",
      now: june30,
    })

    expect(debitServiceBalance).toHaveBeenCalled()
    const { amount, line } = debitServiceBalance.mock.calls[0][0]

    expect(amount.toString()).toBe("3333.33")
    expect(line.description).toBe(
      'VPN package "Global Bundle" — 1/30 month (2026-06)'
    )
  })

  it("subscription period aligns to calendar month end", async () => {
    // June 14 purchase → periodEnd = June 30, not July 14
    const june14 = new Date("2026-06-14T00:00:00Z")
    await service.purchase({
      organizationId: "org-1",
      packageId: "pkg-1",
      now: june14,
    })

    const createdData = subCreate.mock.calls[0][0].data
    const expectedEnd = new Date(Date.UTC(2026, 6, 0, 23, 59, 59, 999))
    expect(createdData.currentPeriodEnd.getTime()).toBe(expectedEnd.getTime())
  })
})
