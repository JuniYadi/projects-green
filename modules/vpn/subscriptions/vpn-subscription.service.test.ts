import { describe, it, expect, beforeEach, mock } from "bun:test"

import {
  VpnDuplicateSubscriptionError,
  VpnInsufficientBalanceError,
  VpnPackageUnavailableError,
  VpnSubscriptionService,
  buildAccountUsername,
} from "./vpn-subscription.service"

type AnyFn = (...args: any[]) => any

const pkgFindUnique = mock<AnyFn>(async () => null)
const subFindFirst = mock<AnyFn>(async () => null)
const subCreate = mock<AnyFn>(async () => ({}))
const subUpdate = mock<AnyFn>(async () => ({}))
const debitServiceBalance = mock<AnyFn>(async () => ({}))
const dispatch = mock<AnyFn>(async () => {})

const prismaMock = {
  vpnPackage: { findUnique: pkgFindUnique },
  vpnSubscription: {
    findFirst: subFindFirst,
    create: subCreate,
    update: subUpdate,
  },
} as any

const transactions = { debitServiceBalance } as any

const service = new VpnSubscriptionService(prismaMock, {
  transactions,
  dispatch,
})

const activePackage = {
  id: "pkg-1",
  name: "Global Bundle",
  isActive: true,
  price: { toString: () => "100000" },
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
  serverAccounts: [
    { id: "sa-1" },
    { id: "sa-2" },
    { id: "sa-3" },
  ],
}

beforeEach(() => {
  pkgFindUnique.mockClear()
  subFindFirst.mockClear()
  subCreate.mockClear()
  subUpdate.mockClear()
  debitServiceBalance.mockClear()
  dispatch.mockClear()
  pkgFindUnique.mockResolvedValue(activePackage)
  subFindFirst.mockResolvedValue(null)
  subCreate.mockResolvedValue(createdSub)
  subUpdate.mockResolvedValue(createdSub)
  debitServiceBalance.mockResolvedValue({})
})

describe("buildAccountUsername", () => {
  it("follows the vpn-{org}-{server}-{protocol} scheme", () => {
    expect(buildAccountUsername("org_abc", "srv1", "OPENVPN")).toBe(
      "vpn-orgabc-srv1-openvpn"
    )
  })
})

describe("VpnSubscriptionService.purchase", () => {
  it("creates one account per enabled protocol per server", async () => {
    await service.purchase({ organizationId: "org-1", packageId: "pkg-1" })
    const accounts = subCreate.mock.calls[0][0].data.serverAccounts.create
    // srv-1: OpenVPN + WireGuard, srv-2: Proxy = 3 accounts
    expect(accounts).toHaveLength(3)
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

  it("rejects a duplicate active subscription", async () => {
    subFindFirst.mockResolvedValue({ id: "existing" })
    await expect(
      service.purchase({ organizationId: "org-1", packageId: "pkg-1" })
    ).rejects.toBeInstanceOf(VpnDuplicateSubscriptionError)
    expect(subCreate).not.toHaveBeenCalled()
  })

  it("maps INSUFFICIENT_BALANCE and leaves subscription suspended", async () => {
    debitServiceBalance.mockRejectedValue(new Error("INSUFFICIENT_BALANCE"))
    await expect(
      service.purchase({ organizationId: "org-1", packageId: "pkg-1" })
    ).rejects.toBeInstanceOf(VpnInsufficientBalanceError)
    expect(dispatch).not.toHaveBeenCalled()
    // No activation update happened
    expect(subUpdate).not.toHaveBeenCalled()
  })
})
