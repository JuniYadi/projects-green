import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockFindMany = mock()
const mockFindFirst = mock()
const mockCreate = mock()
const mockUpdate = mock()
const mockDeleteMany = mock()
const mockConnectionFindFirst = mock()
const mockAgentFindFirst = mock()

mock.module("@/lib/prisma", () => ({
  prisma: {
    aiActionIntent: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
      deleteMany: mockDeleteMany,
    },
    aiIntegrationConnection: {
      findFirst: mockConnectionFindFirst,
    },
    aiAgentProfile: {
      findFirst: mockAgentFindFirst,
    },
  },
}))

const {
  createActionIntent,
  deleteActionIntent,
  getActionIntent,
  listActionIntents,
  updateActionIntent,
} = await import("./ai-action-intent.service")
const { parseActionSlots } = await import("./ai-action-intent.dto")

describe("ai-action-intent.service", () => {
  beforeEach(() => {
    mockFindMany.mockClear()
    mockFindFirst.mockClear()
    mockCreate.mockClear()
    mockUpdate.mockClear()
    mockDeleteMany.mockClear()
    mockConnectionFindFirst.mockClear()
    mockAgentFindFirst.mockClear()
  })

  it("parseActionSlots parses valid array and json strings", () => {
    const fromArray = parseActionSlots([
      { name: "resi", type: "STRING", required: true, inquiryQuestion: "Q1" },
      {
        name: "amount",
        type: "number",
        required: false,
        inquiryQuestion: "Q2",
      },
    ])
    expect(fromArray).toHaveLength(2)
    expect(fromArray[0].type).toBe("STRING")
    expect(fromArray[1].type).toBe("NUMBER")

    const fromJson = parseActionSlots(
      JSON.stringify([
        { name: "date", type: "DATE", required: true, inquiryQuestion: "Tgl?" },
      ])
    )
    expect(fromJson).toHaveLength(1)
    expect(fromJson[0].type).toBe("DATE")

    const fromInvalid = parseActionSlots(null)
    expect(fromInvalid).toEqual([])
  })

  it("listActionIntents queries prisma with orgId filter", async () => {
    const mockData = [
      {
        id: "act_1",
        organizationId: "org_1",
        agentProfileId: null,
        name: "Test Intent",
        description: "Test Desc",
        connectionId: null,
        subpath: "/",
        method: "GET",
        slots: [],
        requireCustomerConfirmation: false,
        enableMultimodalVision: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        connection: null,
      },
    ]
    mockFindMany.mockImplementationOnce(async () => mockData)

    const result = await listActionIntents({ organizationId: "org_1" })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("act_1")
    expect(result[0].name).toBe("Test Intent")
  })

  it("getActionIntent returns item if found", async () => {
    const mockData = {
      id: "act_1",
      organizationId: "org_1",
      agentProfileId: null,
      name: "Test",
      description: null,
      connectionId: null,
      subpath: "/",
      method: "GET",
      slots: [],
      requireCustomerConfirmation: false,
      enableMultimodalVision: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      connection: null,
    }
    mockFindFirst.mockImplementationOnce(async () => mockData)

    const result = await getActionIntent("act_1", "org_1")
    expect(result?.id).toBe("act_1")
  })

  it("createActionIntent validates connection and creates item", async () => {
    mockConnectionFindFirst.mockImplementationOnce(async () => ({
      id: "conn_1",
      organizationId: "org_1",
    }))
    mockCreate.mockImplementationOnce(async (args) => ({
      id: "act_created",
      organizationId: "org_1",
      agentProfileId: null,
      name: args.data.name,
      description: args.data.description,
      connectionId: args.data.connectionId,
      subpath: args.data.subpath,
      method: args.data.method,
      slots: args.data.slots,
      requireCustomerConfirmation: args.data.requireCustomerConfirmation,
      enableMultimodalVision: args.data.enableMultimodalVision,
      isActive: args.data.isActive,
      createdAt: new Date(),
      updatedAt: new Date(),
      connection: { name: "Sample Connection" },
    }))

    const result = await createActionIntent({
      organizationId: "org_1",
      name: "Cek Status",
      connectionId: "conn_1",
      requireCustomerConfirmation: true,
      enableMultimodalVision: true,
    })

    expect(result.id).toBe("act_created")
    expect(result.requireCustomerConfirmation).toBe(true)
    expect(result.enableMultimodalVision).toBe(true)
    expect(result.connectionName).toBe("Sample Connection")
  })

  it("updateActionIntent throws if record does not exist", async () => {
    mockFindFirst.mockImplementationOnce(async () => null)
    expect(
      updateActionIntent("missing", "org_1", { name: "New" })
    ).rejects.toThrow("Action intent not found")
  })

  it("deleteActionIntent returns true on deletion", async () => {
    mockDeleteMany.mockImplementationOnce(async () => ({ count: 1 }))
    const result = await deleteActionIntent("act_1", "org_1")
    expect(result).toBe(true)
  })
})
