import { describe, it, expect, mock, beforeEach } from "bun:test"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"

const mockFindUniqueInvoice = mock()
const mockFindFirstInvoice = mock()
const mockUpdateInvoice = mock()
const mockFindUniqueAccount = mock()
const mockCreateAllocation = mock()
const mockUpdateAllocation = mock()
const mockFindManyAllocation = mock()
const mockQueryRaw = mock(async () => [])

const transactionClient = {
  $queryRaw: mockQueryRaw,
  billingInvoice: {
    findFirst: mockFindFirstInvoice,
    findUnique: mockFindUniqueInvoice,
    update: mockUpdateInvoice,
  },
  billingAccount: {
    findUnique: mockFindUniqueAccount,
  },
  billingInvoicePaymentAllocation: {
    create: mockCreateAllocation,
    update: mockUpdateAllocation,
    findMany: mockFindManyAllocation,
  },
}

const mockTransaction = mock(
  async (fn: (client: typeof transactionClient) => Promise<unknown>) =>
    fn(transactionClient)
)

mock.module("@/lib/prisma", () => ({
  prisma: {
    ...transactionClient,
    $transaction: mockTransaction,
  },
}))

const mockDebitBalance = mock(() => Promise.resolve({}))
mock.module("@/modules/billing/billing-transaction.service", () => ({
  BillingTransactionService: mock(() => ({
    debitBalance: mockDebitBalance,
  })),
}))

const mockSettleOrders = mock(() => Promise.resolve())
mock.module("@/modules/billing/orders/payment-settlement", () => ({
  settleProductOrdersForInvoice: mockSettleOrders,
}))

const mockSendEmail = mock(() => Promise.resolve())
mock.module("./payment.service", () => ({
  PaymentService: mock(() => ({
    sendInvoicePaidEmail: mockSendEmail,
  })),
}))

const mockDuitkuCreatePayment = mock()
mock.module("./duitku.service", () => ({
  DuitkuService: mock(() => ({
    createPayment: mockDuitkuCreatePayment,
  })),
}))

const mockFindByTypeForCurrency = mock()
const mockGetDecryptedConfig = mock()
mock.module("./gateway.service", () => ({
  GatewayService: mock(() => ({
    findByTypeForCurrency: mockFindByTypeForCurrency,
    getDecryptedConfig: mockGetDecryptedConfig,
  })),
}))

const { InvoiceAllocationService } =
  await import("./invoice-allocation.service")

/** Assert the invoice row is locked before any allocation is read. */
function expectInvoiceLocked(invoiceId: string) {
  expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  const [query] = mockQueryRaw.mock.calls[0] as unknown as [
    { text: string; values: unknown[] },
  ]
  expect(query.text).toContain("FOR UPDATE")
  expect(query.values).toEqual([invoiceId])
  const queryOrder = mockQueryRaw.mock.invocationCallOrder[0]
  const readOrder =
    mockFindFirstInvoice.mock.invocationCallOrder[0] ??
    mockFindUniqueInvoice.mock.invocationCallOrder[0]
  if (readOrder !== undefined) {
    expect(queryOrder).toBeLessThan(readOrder)
  }
}

describe("InvoiceAllocationService", () => {
  let service: InstanceType<typeof InvoiceAllocationService>

  beforeEach(() => {
    mock.clearAllMocks()
    service = new InvoiceAllocationService()
  })

  describe("calculateRemainingDue", () => {
    it("calculates remaining due when no allocations exist", async () => {
      mockFindUniqueInvoice.mockResolvedValueOnce({
        id: "inv-1",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        allocations: [],
      })

      const res = await service.calculateRemainingDue("inv-1")
      expect(res.totalAmount).toBe(100000)
      expect(res.totalPaid).toBe(0)
      expect(res.remainingDue).toBe(100000)
    })

    it("calculates remaining due after partial completed allocations", async () => {
      mockFindUniqueInvoice.mockResolvedValueOnce({
        id: "inv-1",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        allocations: [{ amount: new Decimal(40000), status: "COMPLETED" }],
      })

      const res = await service.calculateRemainingDue("inv-1")
      expect(res.totalAmount).toBe(100000)
      expect(res.totalPaid).toBe(40000)
      expect(res.remainingDue).toBe(60000)
    })
  })

  describe("payPartialWithBalance", () => {
    it("rejects amount <= 0", async () => {
      await expect(
        service.payPartialWithBalance({
          invoiceId: "inv-1",
          organizationId: "org-1",
          amountToUse: 0,
        })
      ).rejects.toThrow("Amount must be greater than zero")
      expect(mockTransaction).not.toHaveBeenCalled()
    })

    it("rejects when invoice is not found", async () => {
      mockFindFirstInvoice.mockResolvedValueOnce(null)

      await expect(
        service.payPartialWithBalance({
          invoiceId: "inv-missing",
          organizationId: "org-1",
          amountToUse: 50000,
        })
      ).rejects.toThrow("Invoice not found")
    })

    it("rejects when invoice is not payable", async () => {
      mockFindFirstInvoice.mockResolvedValueOnce({
        id: "inv-1",
        status: "PAID",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        allocations: [],
      })

      await expect(
        service.payPartialWithBalance({
          invoiceId: "inv-1",
          organizationId: "org-1",
          amountToUse: 50000,
        })
      ).rejects.toThrow("Invoice is not open for payment")
      expect(mockDebitBalance).not.toHaveBeenCalled()
    })

    it("rejects when amount to use exceeds remaining due", async () => {
      mockFindFirstInvoice.mockResolvedValueOnce({
        id: "inv-1",
        status: "OPEN",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        allocations: [{ amount: new Decimal(80000), status: "COMPLETED" }],
      })

      await expect(
        service.payPartialWithBalance({
          invoiceId: "inv-1",
          organizationId: "org-1",
          amountToUse: 50000,
        })
      ).rejects.toThrow("exceeds remaining due")
      expect(mockDebitBalance).not.toHaveBeenCalled()
    })

    it("counts a pending gateway allocation against the remaining due", async () => {
      mockFindFirstInvoice.mockResolvedValueOnce({
        id: "inv-1",
        status: "PARTIALLY_PAID",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        allocations: [
          { amount: new Decimal(40000), status: "COMPLETED" },
          {
            amount: new Decimal(60000),
            status: "PENDING",
            source: "GATEWAY_DUITKU",
          },
        ],
      })

      await expect(
        service.payPartialWithBalance({
          invoiceId: "inv-1",
          organizationId: "org-1",
          amountToUse: 1000,
        })
      ).rejects.toThrow("Invoice is already fully paid")
      expect(mockDebitBalance).not.toHaveBeenCalled()
      expect(mockCreateAllocation).not.toHaveBeenCalled()
    })

    it("rejects when account balance is insufficient", async () => {
      mockFindFirstInvoice.mockResolvedValueOnce({
        id: "inv-1",
        status: "OPEN",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        allocations: [],
      })
      mockFindUniqueAccount.mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal(20000),
      })

      await expect(
        service.payPartialWithBalance({
          invoiceId: "inv-1",
          organizationId: "org-1",
          amountToUse: 50000,
        })
      ).rejects.toThrow("Insufficient balance")
      expect(mockDebitBalance).not.toHaveBeenCalled()
      expect(mockCreateAllocation).not.toHaveBeenCalled()
    })

    it("locks the invoice before reading allocations and debits in one transaction", async () => {
      mockFindFirstInvoice.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-001",
        status: "OPEN",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        allocations: [],
      })
      mockFindUniqueAccount.mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal(60000),
      })
      mockCreateAllocation.mockResolvedValueOnce({ id: "alloc-1" })
      mockUpdateInvoice.mockResolvedValueOnce({})

      await service.payPartialWithBalance({
        invoiceId: "inv-1",
        organizationId: "org-1",
        amountToUse: 40000,
      })

      expectInvoiceLocked("inv-1")
      expect(mockTransaction).toHaveBeenCalledTimes(1)
      expect(mockDebitBalance).toHaveBeenCalledTimes(1)
      expect(mockDebitBalance.mock.calls[0][1]).toBe(transactionClient)
    })

    it("successfully applies partial balance and transitions invoice to PARTIALLY_PAID", async () => {
      mockFindFirstInvoice.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-001",
        status: "OPEN",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        allocations: [],
      })
      mockFindUniqueAccount.mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal(60000),
      })
      mockCreateAllocation.mockResolvedValueOnce({ id: "alloc-1" })
      mockUpdateInvoice.mockResolvedValueOnce({})

      const result = await service.payPartialWithBalance({
        invoiceId: "inv-1",
        organizationId: "org-1",
        amountToUse: 40000,
      })

      expect(result.ok).toBe(true)
      expect(result.invoiceStatus).toBe("PARTIALLY_PAID")
      expect(result.allocatedAmount).toBe(40000)
      expect(result.totalPaid).toBe(40000)
      expect(result.remainingDue).toBe(60000)
      expect(mockDebitBalance).toHaveBeenCalled()
      expect(mockUpdateInvoice).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: { status: "PARTIALLY_PAID", paidAt: undefined },
      })
      expect(mockSettleOrders).not.toHaveBeenCalled()
    })

    it("transitions invoice to PAID when partial payment covers entire remaining due", async () => {
      mockFindFirstInvoice.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-001",
        status: "PARTIALLY_PAID",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        allocations: [{ amount: new Decimal(40000), status: "COMPLETED" }],
      })
      mockFindUniqueAccount.mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal(80000),
      })
      mockCreateAllocation.mockResolvedValueOnce({ id: "alloc-2" })
      mockUpdateInvoice.mockResolvedValueOnce({})

      const result = await service.payPartialWithBalance({
        invoiceId: "inv-1",
        organizationId: "org-1",
        amountToUse: 60000,
      })

      expect(result.ok).toBe(true)
      expect(result.invoiceStatus).toBe("PAID")
      expect(result.totalPaid).toBe(100000)
      expect(result.remainingDue).toBe(0)
      expect(mockSettleOrders).toHaveBeenCalledWith("inv-1", expect.anything())
    })

    it("stays PARTIALLY_PAID while a pending gateway allocation still owes the rest", async () => {
      mockFindFirstInvoice.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-001",
        status: "OPEN",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        allocations: [
          {
            amount: new Decimal(60000),
            status: "PENDING",
            source: "GATEWAY_DUITKU",
          },
        ],
      })
      mockFindUniqueAccount.mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal(50000),
      })
      mockCreateAllocation.mockResolvedValueOnce({ id: "alloc-3" })
      mockUpdateInvoice.mockResolvedValueOnce({})

      const result = await service.payPartialWithBalance({
        invoiceId: "inv-1",
        organizationId: "org-1",
        amountToUse: 40000,
      })

      expect(result.invoiceStatus).toBe("PARTIALLY_PAID")
      expect(result.totalPaid).toBe(40000)
      expect(result.remainingDue).toBe(60000)
      expect(mockSettleOrders).not.toHaveBeenCalled()
    })
  })

  describe("initiateGatewayPayment", () => {
    it("creates Duitku payment specifically for remaining due", async () => {
      mockFindFirstInvoice.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-001",
        status: "PARTIALLY_PAID",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        billingAccountId: "acc-1",
        allocations: [{ amount: new Decimal(40000), status: "COMPLETED" }],
        metadata: {},
      })
      mockFindByTypeForCurrency.mockResolvedValueOnce({ id: "gw-1" })
      mockGetDecryptedConfig.mockResolvedValueOnce({ checkoutMode: "POP" })
      mockDuitkuCreatePayment.mockResolvedValueOnce({
        reference: "duitku_ref_split",
        mode: "POP",
        clientScriptUrl: "https://duitku.test/lib.js",
        paymentUrl: "https://duitku.test/pay",
      })
      mockCreateAllocation.mockResolvedValueOnce({ id: "alloc-pending" })
      mockUpdateInvoice.mockResolvedValueOnce({})

      const result = await service.initiateGatewayPayment({
        invoiceId: "inv-1",
        organizationId: "org-1",
      })

      expect(result.ok).toBe(true)
      expect(result.remainingDue).toBe(60000)
      expect(result.reference).toBe("duitku_ref_split")
      expect(mockDuitkuCreatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 60000,
          paymentMethod: "",
        })
      )
      expect(mockCreateAllocation).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: "GATEWAY_DUITKU",
          status: "PENDING",
          amount: expect.anything(),
          referenceId: "duitku_ref_split",
        }),
      })
      const [allocationArg] = mockCreateAllocation.mock.calls[0] as [
        { data: { amount: { toNumber: () => number } } },
      ]
      expect(allocationArg.data.amount.toNumber()).toBe(60000)
    })

    it("serializes on the invoice row lock and reserves the session in one transaction", async () => {
      mockFindFirstInvoice.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-001",
        status: "OPEN",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        billingAccountId: "acc-1",
        allocations: [],
        metadata: {},
      })
      mockFindByTypeForCurrency.mockResolvedValueOnce({ id: "gw-1" })
      mockGetDecryptedConfig.mockResolvedValueOnce({ checkoutMode: "REDIRECT" })
      mockDuitkuCreatePayment.mockResolvedValueOnce({
        reference: "duitku_ref_serialized",
        mode: "REDIRECT",
        paymentUrl: "https://duitku.test/pay",
      })
      mockCreateAllocation.mockResolvedValueOnce({ id: "alloc-pending" })
      mockUpdateInvoice.mockResolvedValueOnce({})

      await service.initiateGatewayPayment({
        invoiceId: "inv-1",
        organizationId: "org-1",
        paymentMethod: "QRIS",
      })

      expectInvoiceLocked("inv-1")
      expect(mockTransaction).toHaveBeenCalledTimes(1)
      // Checkout session and its reservation are created together
      expect(mockDuitkuCreatePayment).toHaveBeenCalledWith(
        expect.objectContaining({ paymentMethod: "QR" })
      )
      expect(mockUpdateInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-1" },
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              reference: "duitku_ref_serialized",
            }),
          }),
        })
      )
    })

    it("never reserves more than the invoice total when remaining due has fractions", async () => {
      mockFindFirstInvoice.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-001",
        status: "PARTIALLY_PAID",
        totalAmount: new Decimal("105.60"),
        currency: "USD",
        billingAccountId: "acc-1",
        allocations: [],
        metadata: {},
      })
      mockFindByTypeForCurrency.mockResolvedValueOnce({ id: "gw-1" })
      mockGetDecryptedConfig.mockResolvedValueOnce({ checkoutMode: "POP" })
      mockDuitkuCreatePayment.mockResolvedValueOnce({
        reference: "usd_ref",
        mode: "POP",
        paymentUrl: "https://duitku.test/pay",
      })
      mockCreateAllocation.mockResolvedValueOnce({ id: "alloc-pending" })
      mockUpdateInvoice.mockResolvedValueOnce({})

      const result = await service.initiateGatewayPayment({
        invoiceId: "inv-1",
        organizationId: "org-1",
      })

      // 105.60 must not round up to a session worth 106
      expect(result.remainingDue).toBe(105)
      expect(mockDuitkuCreatePayment).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 105 })
      )
      const [allocationArg] = mockCreateAllocation.mock.calls[0] as [
        { data: { amount: { toNumber: () => number } } },
      ]
      expect(allocationArg.data.amount.toNumber()).toBe(105)
    })

    it("reuses existing active pending gateway session instead of creating duplicate", async () => {
      mockFindFirstInvoice.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-001",
        status: "OPEN",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        billingAccountId: "acc-1",
        allocations: [
          {
            amount: new Decimal(100000),
            status: "PENDING",
            source: "GATEWAY_DUITKU",
            referenceId: "duitku_ref_existing",
          },
        ],
        metadata: {
          mode: "POP",
          reference: "duitku_ref_existing",
          paymentUrl: "https://duitku.test/pay",
          clientScriptUrl: "https://duitku.test/lib.js",
        },
      })

      const result = await service.initiateGatewayPayment({
        invoiceId: "inv-1",
        organizationId: "org-1",
      })

      expect(result.ok).toBe(true)
      expect(result.reference).toBe("duitku_ref_existing")
      expect(result.remainingDue).toBe(100000)
      expectInvoiceLocked("inv-1")
      expect(mockDuitkuCreatePayment).not.toHaveBeenCalled()
      expect(mockCreateAllocation).not.toHaveBeenCalled()
      expect(mockUpdateInvoice).not.toHaveBeenCalled()
    })

    it("rejects when the invoice is already covered by completed allocations", async () => {
      mockFindFirstInvoice.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-001",
        status: "PARTIALLY_PAID",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        billingAccountId: "acc-1",
        allocations: [{ amount: new Decimal(100000), status: "COMPLETED" }],
        metadata: {},
      })

      await expect(
        service.initiateGatewayPayment({
          invoiceId: "inv-1",
          organizationId: "org-1",
        })
      ).rejects.toThrow("Invoice is already fully paid")
      expect(mockDuitkuCreatePayment).not.toHaveBeenCalled()
    })
  })

  describe("processGatewayCallback", () => {
    it("updates pending allocation to COMPLETED and marks invoice PAID if full", async () => {
      mockFindUniqueInvoice.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-001",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        billingAccountId: "acc-1",
        billingAccount: { organizationId: "org-1" },
        allocations: [
          {
            id: "alloc-pending",
            status: "PENDING",
            source: "GATEWAY_DUITKU",
            amount: new Decimal(60000),
            referenceId: "duitku_ref_1",
          },
        ],
      })
      // Only allocations settled before this callback
      mockFindManyAllocation.mockResolvedValueOnce([
        { amount: new Decimal(40000), status: "COMPLETED" },
      ])
      mockUpdateAllocation.mockResolvedValueOnce({})
      mockUpdateInvoice.mockResolvedValueOnce({})

      const result = await service.processGatewayCallback({
        merchantOrderId: "inv-1",
        reference: "duitku_ref_1",
        amount: 60000,
      })

      expect(result.ok).toBe(true)
      expect(result.status).toBe("PAID")
      expect(result.totalPaid).toBe(100000)
      expect(mockTransaction).toHaveBeenCalledTimes(1)
      expectInvoiceLocked("inv-1")
      expect(mockUpdateAllocation).toHaveBeenCalledWith({
        where: { id: "alloc-pending" },
        data: expect.objectContaining({
          status: "COMPLETED",
          referenceId: "duitku_ref_1",
        }),
      })
      expect(mockUpdateInvoice).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: expect.objectContaining({ status: "PAID" }),
      })
      expect(mockSettleOrders).toHaveBeenCalledWith("inv-1", expect.anything())
    })

    it("completes the allocation and the invoice status atomically in one transaction", async () => {
      mockFindUniqueInvoice.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-001",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        billingAccountId: "acc-1",
        billingAccount: { organizationId: "org-1" },
        allocations: [
          {
            id: "alloc-pending",
            status: "PENDING",
            source: "GATEWAY_DUITKU",
            amount: new Decimal(50000),
            referenceId: "duitku_ref_1",
          },
        ],
      })
      mockFindManyAllocation.mockResolvedValueOnce([])
      mockUpdateAllocation.mockResolvedValueOnce({})
      mockUpdateInvoice.mockResolvedValueOnce({})

      const result = await service.processGatewayCallback({
        merchantOrderId: "inv-1",
        reference: "duitku_ref_1",
        amount: 50000,
      })

      expect(result.status).toBe("PARTIALLY_PAID")
      expect(result.totalPaid).toBe(50000)
      // Allocation completion is written before the invoice status flip, both
      // through the transaction client.
      expect(mockUpdateAllocation.mock.invocationCallOrder[0]).toBeLessThan(
        mockUpdateInvoice.mock.invocationCallOrder[0]
      )
      expect(mockSettleOrders).not.toHaveBeenCalled()
    })

    it("accepts a callback whose amount matches to decimal precision", async () => {
      mockFindUniqueInvoice.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-001",
        totalAmount: new Decimal("105.25"),
        currency: "USD",
        billingAccountId: "acc-1",
        billingAccount: { organizationId: "org-1" },
        allocations: [
          {
            id: "alloc-pending",
            status: "PENDING",
            source: "GATEWAY_DUITKU",
            amount: new Decimal("105.25"),
            referenceId: "usd_ref",
          },
        ],
      })
      mockFindManyAllocation.mockResolvedValueOnce([])
      mockUpdateAllocation.mockResolvedValueOnce({})
      mockUpdateInvoice.mockResolvedValueOnce({})

      const result = await service.processGatewayCallback({
        merchantOrderId: "inv-1",
        reference: "usd_ref",
        amount: 105.25,
      })

      expect(result.ok).toBe(true)
      expect(result.status).toBe("PAID")
      const [updateArg] = mockUpdateAllocation.mock.calls[0] as [
        { data: { amount: { toString: () => string } } },
      ]
      expect(updateArg.data.amount.toString()).toBe("105.25")
    })

    it("treats a retried callback for an already completed allocation as success", async () => {
      mockFindUniqueInvoice.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-001",
        status: "PAID",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        billingAccountId: "acc-1",
        billingAccount: { organizationId: "org-1" },
        allocations: [
          {
            id: "alloc-done",
            status: "COMPLETED",
            source: "GATEWAY_DUITKU",
            amount: new Decimal(60000),
            referenceId: "duitku_ref_1",
          },
        ],
      })
      mockFindManyAllocation.mockResolvedValueOnce([
        { amount: new Decimal(100000), status: "COMPLETED" },
      ])

      const result = await service.processGatewayCallback({
        merchantOrderId: "inv-1",
        reference: "duitku_ref_1",
        amount: 60000,
      })

      expect(result.ok).toBe(true)
      expect(result.totalPaid).toBe(100000)
      // No second settlement
      expect(mockUpdateAllocation).not.toHaveBeenCalled()
      expect(mockUpdateInvoice).not.toHaveBeenCalled()
      expect(mockSettleOrders).not.toHaveBeenCalled()
    })

    it("rejects callback when pending allocation does not exist", async () => {
      mockFindUniqueInvoice.mockResolvedValueOnce({
        id: "inv-1",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        billingAccountId: "acc-1",
        billingAccount: { organizationId: "org-1" },
        allocations: [],
      })

      const result = await service.processGatewayCallback({
        merchantOrderId: "inv-1",
        reference: "unknown_ref",
        amount: 60000,
      })

      expect(result.ok).toBe(false)
      expect((result as { error?: string }).error).toBe(
        "PENDING_ALLOCATION_NOT_FOUND"
      )
      expect(mockUpdateAllocation).not.toHaveBeenCalled()
      expect(mockUpdateInvoice).not.toHaveBeenCalled()
      expect(mockSettleOrders).not.toHaveBeenCalled()
    })

    it("rejects callback when the invoice is unknown", async () => {
      mockFindUniqueInvoice.mockResolvedValueOnce(null)

      const result = await service.processGatewayCallback({
        merchantOrderId: "inv-missing",
        reference: "duitku_ref_1",
        amount: 60000,
      })

      expect(result.ok).toBe(false)
      expect((result as { error?: string }).error).toBe("INVOICE_NOT_FOUND")
      expect(mockUpdateAllocation).not.toHaveBeenCalled()
    })

    it("rejects callback when callback amount mismatches pending allocation amount", async () => {
      mockFindUniqueInvoice.mockResolvedValueOnce({
        id: "inv-1",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        billingAccountId: "acc-1",
        billingAccount: { organizationId: "org-1" },
        allocations: [
          {
            id: "alloc-pending",
            status: "PENDING",
            source: "GATEWAY_DUITKU",
            amount: new Decimal(60000),
            referenceId: "duitku_ref_1",
          },
        ],
      })

      const result = await service.processGatewayCallback({
        merchantOrderId: "inv-1",
        reference: "duitku_ref_1",
        amount: 10000, // significantly less than 60000
      })

      expect(result.ok).toBe(false)
      expect((result as { error?: string }).error).toBe("AMOUNT_MISMATCH")
      expect(mockUpdateAllocation).not.toHaveBeenCalled()
      expect(mockUpdateInvoice).not.toHaveBeenCalled()
      expect(mockSettleOrders).not.toHaveBeenCalled()
    })

    it("rejects a sub-unit amount difference instead of tolerating it", async () => {
      mockFindUniqueInvoice.mockResolvedValueOnce({
        id: "inv-1",
        totalAmount: new Decimal("105.25"),
        currency: "USD",
        billingAccountId: "acc-1",
        billingAccount: { organizationId: "org-1" },
        allocations: [
          {
            id: "alloc-pending",
            status: "PENDING",
            source: "GATEWAY_DUITKU",
            amount: new Decimal("105.25"),
            referenceId: "usd_ref",
          },
        ],
      })

      const result = await service.processGatewayCallback({
        merchantOrderId: "inv-1",
        reference: "usd_ref",
        amount: 105.2501,
      })

      expect(result.ok).toBe(false)
      expect((result as { error?: string }).error).toBe("AMOUNT_MISMATCH")
      expect(mockUpdateAllocation).not.toHaveBeenCalled()
    })

    it("handles multiple sequential callbacks for different attempts on same invoice", async () => {
      // First attempt callback arrives: only partial payment
      mockFindUniqueInvoice.mockResolvedValueOnce({
        id: "inv-1",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        billingAccountId: "acc-1",
        billingAccount: { organizationId: "org-1" },
        allocations: [
          {
            id: "alloc-attempt-1",
            status: "PENDING",
            source: "GATEWAY_DUITKU",
            amount: new Decimal(50000),
            referenceId: "ref-attempt-1",
          },
          {
            id: "alloc-attempt-2",
            status: "PENDING",
            source: "GATEWAY_DUITKU",
            amount: new Decimal(50000),
            referenceId: "ref-attempt-2",
          },
        ],
      })
      mockFindManyAllocation.mockResolvedValueOnce([])
      mockUpdateAllocation.mockResolvedValueOnce({})
      mockUpdateInvoice.mockResolvedValueOnce({})

      const result1 = await service.processGatewayCallback({
        merchantOrderId: "inv-1",
        reference: "ref-attempt-1",
        amount: 50000,
      })

      expect(result1.ok).toBe(true)
      expect(result1.status).toBe("PARTIALLY_PAID")
      expect(result1.totalPaid).toBe(50000)
      expect(mockUpdateAllocation).toHaveBeenCalledWith({
        where: { id: "alloc-attempt-1" },
        data: expect.objectContaining({
          status: "COMPLETED",
          referenceId: "ref-attempt-1",
        }),
      })

      // Later attempt callback arrives for the same invoice: completes remaining due
      mockFindUniqueInvoice.mockResolvedValueOnce({
        id: "inv-1",
        totalAmount: new Decimal(100000),
        currency: "IDR",
        billingAccountId: "acc-1",
        billingAccount: { organizationId: "org-1" },
        allocations: [
          {
            id: "alloc-attempt-1",
            status: "COMPLETED",
            source: "GATEWAY_DUITKU",
            amount: new Decimal(50000),
            referenceId: "ref-attempt-1",
          },
          {
            id: "alloc-attempt-2",
            status: "PENDING",
            source: "GATEWAY_DUITKU",
            amount: new Decimal(50000),
            referenceId: "ref-attempt-2",
          },
        ],
      })
      mockFindManyAllocation.mockResolvedValueOnce([
        { amount: new Decimal(50000), status: "COMPLETED" },
      ])
      mockUpdateAllocation.mockResolvedValueOnce({})
      mockUpdateInvoice.mockResolvedValueOnce({})

      const result2 = await service.processGatewayCallback({
        merchantOrderId: "inv-1",
        reference: "ref-attempt-2",
        amount: 50000,
      })

      expect(result2.ok).toBe(true)
      expect(result2.status).toBe("PAID")
      expect(result2.totalPaid).toBe(100000)
      expect(mockUpdateAllocation).toHaveBeenCalledWith({
        where: { id: "alloc-attempt-2" },
        data: expect.objectContaining({
          status: "COMPLETED",
          referenceId: "ref-attempt-2",
        }),
      })
      expect(mockSettleOrders).toHaveBeenCalledWith("inv-1", expect.anything())
    })
  })
})
