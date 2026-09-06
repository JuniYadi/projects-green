import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockAuthContext = {
  current: null as { organizationId: string } | null,
}

const mockDeviceFindMany = mock()
const mockDeviceFindFirst = mock()
const mockDeviceUpdate = mock()

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findMany: mockDeviceFindMany,
      findFirst: mockDeviceFindFirst,
      update: mockDeviceUpdate,
    },
  },
}))

const { whatsappWorkflowRoutes } = await import("./workflow.routes")

const validWorkflow = {
  id: "wf_1",
  organizationId: "org_1",
  name: "Support Bot",
  trigger: {
    id: "trig_1",
    type: "whatsapp_inbound",
    keywords: ["help"],
  },
  nodes: [
    {
      id: "node_1",
      type: "send_message",
      name: "Greeting",
      config: { text: "Hello!" },
    },
  ],
  edges: [],
  version: 1,
}

describe("whatsappWorkflowRoutes", () => {
  beforeEach(() => {
    mockAuthContext.current = { organizationId: "org_1" }
    mockDeviceFindMany.mockClear()
    mockDeviceFindFirst.mockClear()
    mockDeviceUpdate.mockClear()
  })

  describe("GET /workflows/", () => {
    it("returns 401 if unauthenticated", async () => {
      mockAuthContext.current = null
      const res = await whatsappWorkflowRoutes.handle(
        new Request("http://localhost/workflows/")
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data).toEqual({
        ok: false,
        error: "UNAUTHORIZED",
        message: "Organization required.",
      })
    })

    it("returns empty array when no devices have botWorkflow", async () => {
      mockDeviceFindMany.mockResolvedValueOnce([
        { id: "dev_1", phoneNumber: "628123456789", features: null },
      ])
      const res = await whatsappWorkflowRoutes.handle(
        new Request("http://localhost/workflows/")
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ ok: true, data: [] })
    })

    it("returns workflows from devices with valid botWorkflow", async () => {
      mockDeviceFindMany.mockResolvedValueOnce([
        {
          id: "dev_1",
          phoneNumber: "628123456789",
          features: { botWorkflow: validWorkflow },
        },
      ])
      const res = await whatsappWorkflowRoutes.handle(
        new Request("http://localhost/workflows/")
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.length).toBe(1)
      expect(data.data[0].id).toBe("wf_1")
      expect(data.data[0].device.phoneNumber).toBe("628123456789")
    })
  })

  describe("GET /workflows/:id", () => {
    it("returns 401 if unauthenticated", async () => {
      mockAuthContext.current = null
      const res = await whatsappWorkflowRoutes.handle(
        new Request("http://localhost/workflows/wf_1")
      )
      expect(res.status).toBe(401)
    })

    it("returns workflow details when workflow id is found", async () => {
      mockDeviceFindMany.mockResolvedValueOnce([
        {
          id: "dev_1",
          phoneNumber: "628123456789",
          features: { botWorkflow: validWorkflow },
        },
      ])
      const res = await whatsappWorkflowRoutes.handle(
        new Request("http://localhost/workflows/wf_1")
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.id).toBe("wf_1")
      expect(data.data.deviceId).toBe("dev_1")
    })

    it("returns error when workflow id is not found", async () => {
      mockDeviceFindMany.mockResolvedValueOnce([])
      const res = await whatsappWorkflowRoutes.handle(
        new Request("http://localhost/workflows/wf_nonexistent")
      )
      const data = await res.json()
      expect(data).toEqual({ ok: false, error: "Workflow not found" })
    })
  })

  describe("POST /workflows/save", () => {
    it("returns 401 if unauthenticated", async () => {
      mockAuthContext.current = null
      const res = await whatsappWorkflowRoutes.handle(
        new Request("http://localhost/workflows/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: "dev_1", workflow: validWorkflow }),
        })
      )
      expect(res.status).toBe(401)
    })

    it("returns error on invalid workflow schema", async () => {
      const res = await whatsappWorkflowRoutes.handle(
        new Request("http://localhost/workflows/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: "dev_1",
            workflow: { invalid: true },
          }),
        })
      )
      const data = await res.json()
      expect(data.ok).toBe(false)
      expect(data.error).toContain("Invalid workflow schema")
    })

    it("returns error when device is not found", async () => {
      mockDeviceFindFirst.mockResolvedValueOnce(null)
      const res = await whatsappWorkflowRoutes.handle(
        new Request("http://localhost/workflows/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: "dev_1", workflow: validWorkflow }),
        })
      )
      const data = await res.json()
      expect(data).toEqual({ ok: false, error: "WhatsApp Device not found" })
    })

    it("updates device features with workflow when valid", async () => {
      mockDeviceFindFirst.mockResolvedValueOnce({
        id: "dev_1",
        features: { existingProp: true },
      })
      mockDeviceUpdate.mockResolvedValueOnce({})

      const res = await whatsappWorkflowRoutes.handle(
        new Request("http://localhost/workflows/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: "dev_1", workflow: validWorkflow }),
        })
      )
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.id).toBe("wf_1")
      expect(mockDeviceUpdate).toHaveBeenCalledWith({
        where: { id: "dev_1" },
        data: {
          features: {
            existingProp: true,
            botWorkflow: expect.objectContaining({ id: "wf_1" }),
          },
        },
      })
    })
  })

  describe("POST /workflows/delete", () => {
    it("returns 401 if unauthenticated", async () => {
      mockAuthContext.current = null
      const res = await whatsappWorkflowRoutes.handle(
        new Request("http://localhost/workflows/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: "dev_1" }),
        })
      )
      expect(res.status).toBe(401)
    })

    it("returns error when device is not found", async () => {
      mockDeviceFindFirst.mockResolvedValueOnce(null)
      const res = await whatsappWorkflowRoutes.handle(
        new Request("http://localhost/workflows/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: "dev_1" }),
        })
      )
      const data = await res.json()
      expect(data).toEqual({ ok: false, error: "WhatsApp Device not found" })
    })

    it("removes botWorkflow from features and updates device", async () => {
      mockDeviceFindFirst.mockResolvedValueOnce({
        id: "dev_1",
        features: { botWorkflow: validWorkflow, keepThis: 123 },
      })
      mockDeviceUpdate.mockResolvedValueOnce({})

      const res = await whatsappWorkflowRoutes.handle(
        new Request("http://localhost/workflows/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: "dev_1" }),
        })
      )
      const data = await res.json()
      expect(data).toEqual({ ok: true })
      expect(mockDeviceUpdate).toHaveBeenCalledWith({
        where: { id: "dev_1" },
        data: {
          features: { keepThis: 123 },
        },
      })
    })
  })
})
