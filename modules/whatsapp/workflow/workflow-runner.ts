import { prisma } from "@/lib/prisma"
import { workflowSessionStore, type TemplateContext } from "./workflow-session"
import { executeWorkflowNode } from "./workflow-executor"
import {
  WorkflowDefinitionSchema,
  type WorkflowDefinition,
  type WorkflowNode,
} from "./workflow.schema"

export type ProcessWorkflowInboundOptions = {
  organizationId: string
  deviceId: string
  contactPhone: string
  inboundMessageText: string
  buttonPayload?: string
}

export type ProcessWorkflowInboundResult = {
  handled: boolean
  workflowId?: string
  reason?: string
}

/**
 * Main Workflow Runner Engine.
 * Coordinates trigger matching, session recovery, node graph iteration, and concurrency mutex.
 */
export async function processWhatsappWorkflowInbound(
  options: ProcessWorkflowInboundOptions
): Promise<ProcessWorkflowInboundResult> {
  const {
    organizationId,
    deviceId,
    contactPhone,
    inboundMessageText,
    buttonPayload,
  } = options
  const cleanText = (inboundMessageText || buttonPayload || "").trim()

  // 1. Acquire Distributed Mutex Lock (5s TTL) with owner token
  const lockToken = await workflowSessionStore.acquireLock(
    organizationId,
    contactPhone
  )
  if (!lockToken) {
    return {
      handled: true,
      reason: "CONCURRENCY_LOCKED",
    }
  }

  try {
    // 2. Global Bypass Commands check ("batal", "cancel", "reset", "menu")
    const lowerInput = cleanText.toLowerCase()
    if (["batal", "cancel", "reset"].includes(lowerInput)) {
      await workflowSessionStore.clearSession(organizationId, contactPhone)
      return {
        handled: true,
        reason: "SESSION_RESET_BY_USER",
      }
    }

    // 3. Check for existing active session in Redis
    let session = await workflowSessionStore.getSession(
      organizationId,
      contactPhone
    )
    let workflow: WorkflowDefinition | null = null
    let isResume = false

    if (session && session.status === "PAUSED" && session.currentNodeId) {
      isResume = true
      // Find workflow definition from database / cache
      const dbWorkflow = await prisma.whatsappDevice.findUnique({
        where: { id: deviceId },
        select: { features: true },
      })

      const features = dbWorkflow?.features as Record<string, unknown> | null
      if (features?.botWorkflow) {
        workflow = WorkflowDefinitionSchema.parse(features.botWorkflow)
      }
    }

    // 4. If no active session, find matching trigger keyword on this device's workflow
    if (!session || !workflow) {
      isResume = false
      const dbDevice = await prisma.whatsappDevice.findUnique({
        where: { id: deviceId },
        select: { features: true },
      })

      const features = dbDevice?.features as Record<string, unknown> | null
      if (!features?.botWorkflow) {
        return { handled: false, reason: "NO_WORKFLOW_CONFIGURED" }
      }

      const parsedWf = WorkflowDefinitionSchema.parse(features.botWorkflow)
      if (!parsedWf.isActive) {
        return { handled: false, reason: "WORKFLOW_INACTIVE" }
      }

      // Check trigger matching
      const trigger = parsedWf.trigger
      let matched = false
      if (trigger.type === "whatsapp_inbound") {
        matched = true
      } else if (trigger.type === "keyword_match" && trigger.keywords.length) {
        matched = trigger.keywords.some((kw) =>
          lowerInput.includes(kw.toLowerCase().trim())
        )
      } else if (trigger.type === "button_payload" && buttonPayload) {
        matched = trigger.keywords.includes(buttonPayload)
      }

      if (!matched) {
        return { handled: false, reason: "TRIGGER_NOT_MATCHED" }
      }

      workflow = parsedWf
      const firstNode = workflow.nodes[0]
      if (!firstNode) {
        return { handled: false, reason: "EMPTY_WORKFLOW" }
      }

      session = {
        sessionId: `wf_${contactPhone}_${Date.now()}`,
        organizationId,
        phoneNumber: contactPhone,
        workflowId: workflow.id,
        currentNodeId: firstNode.id,
        variables: {},
        stepOutputs: {},
        status: "ACTIVE",
        updatedAt: new Date().toISOString(),
      }
    }

    // 5. Execute Graph Loop
    let currentNodeId: string | null = session.currentNodeId
    const maxSteps = 20
    let stepCount = 0

    while (currentNodeId && stepCount < maxSteps) {
      stepCount++
      const node: WorkflowNode | undefined = workflow.nodes.find(
        (n) => n.id === currentNodeId
      )
      if (!node) break

      const templateContext: TemplateContext = {
        variables: session.variables,
        steps: session.stepOutputs,
        session: {
          phone_number: contactPhone,
          organization_id: organizationId,
          device_id: deviceId,
        },
      }

      const executionResult = await executeWorkflowNode({
        organizationId,
        deviceId,
        phoneNumber: contactPhone,
        node,
        templateContext,
        inboundAnswer: isResume ? cleanText : undefined,
      })

      // Only the initial step on resume consumes the inbound answer
      isResume = false

      // Update captured variables and step outputs
      if (executionResult.capturedVariable) {
        session.variables[executionResult.capturedVariable.name] =
          executionResult.capturedVariable.value
      }
      if (executionResult.stepOutput) {
        session.stepOutputs[node.id] = executionResult.stepOutput
      }

      // If node pauses for user input, save session and break loop
      if (executionResult.status === "PAUSED") {
        session.currentNodeId = node.id
        session.status = "PAUSED"
        session.updatedAt = new Date().toISOString()
        await workflowSessionStore.saveSession(session)
        return {
          handled: true,
          workflowId: workflow.id,
          reason: "PAUSED_AT_INPUT",
        }
      }

      // Find next edge from current node with exact matching outputPort, or fallback to default
      const outgoingEdge =
        workflow.edges.find(
          (e) =>
            e.sourceNodeId === node.id &&
            e.sourcePort === executionResult.outputPort
        ) ||
        workflow.edges.find(
          (e) => e.sourceNodeId === node.id && e.sourcePort === "default"
        )

      if (!outgoingEdge) {
        // Reached terminal end of graph
        await workflowSessionStore.clearSession(organizationId, contactPhone)
        return {
          handled: true,
          workflowId: workflow.id,
          reason: "WORKFLOW_COMPLETED",
        }
      }

      currentNodeId = outgoingEdge.targetNodeId
    }

    await workflowSessionStore.clearSession(organizationId, contactPhone)
    return {
      handled: true,
      workflowId: workflow.id,
      reason: "WORKFLOW_COMPLETED",
    }
  } finally {
    if (lockToken) {
      await workflowSessionStore.releaseLock(
        organizationId,
        contactPhone,
        lockToken
      )
    }
  }
}
