import { describe, expect, it } from "bun:test"

import {
  buildDeployTimelineItems,
  mapStackStatusToDeployStatus,
  resolveStackBillingState,
  toDeployEventDTOs,
  toDeployLogLines,
  toDeploymentStatusDTO,
  toStackSummaryDTO,
} from "./deploy-monitor.dto"

describe("deploy-monitor.dto", () => {
  describe("mapStackStatusToDeployStatus", () => {
    it("maps each persisted status to the UI status", () => {
      expect(mapStackStatusToDeployStatus("QUEUED")).toBe("queued")
      expect(mapStackStatusToDeployStatus("BUILDING")).toBe("building")
      expect(mapStackStatusToDeployStatus("DEPLOYING")).toBe("deploying")
      expect(mapStackStatusToDeployStatus("RUNNING")).toBe("running")
      expect(mapStackStatusToDeployStatus("FAILED")).toBe("failed")
      expect(mapStackStatusToDeployStatus("IDLE")).toBe("idle")
    })

    it("falls back to idle for unknown values", () => {
      expect(mapStackStatusToDeployStatus("UNKNOWN")).toBe("idle")
    })
  })

  describe("toDeploymentStatusDTO", () => {
    it("maps a persisted deployment into the status DTO", () => {
      const startedAt = new Date("2026-06-05T10:00:00.000Z")
      const completedAt = new Date("2026-06-05T10:05:00.000Z")

      const dto = toDeploymentStatusDTO({
        id: "deploy-1",
        status: "RUNNING",
        attempt: 2,
        manifestPushed: true,
        argocdSynced: true,
        failureReason: null,
        startedAt,
        completedAt,
      })

      expect(dto).toEqual({
        id: "deploy-1",
        status: "running",
        attempt: 2,
        manifestPushed: true,
        argocdSynced: true,
        failureReason: null,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
      })
    })

    it("clamps attempt to a minimum of 1 and tolerates null timestamps", () => {
      const dto = toDeploymentStatusDTO({
        id: "deploy-2",
        status: "QUEUED",
        attempt: 0,
        manifestPushed: false,
        argocdSynced: false,
        failureReason: "boom",
        startedAt: null as unknown as Date,
        completedAt: null as unknown as Date,
      })

      expect(dto.attempt).toBe(1)
      expect(dto.startedAt).toBeNull()
      expect(dto.completedAt).toBeNull()
      expect(dto.failureReason).toBe("boom")
    })
  })

  describe("toDeployLogLines", () => {
    it("returns an empty array for no logs (honest no-data state)", () => {
      expect(toDeployLogLines([])).toEqual([])
    })

    it("normalizes scope and lifecycle status", () => {
      const lines = toDeployLogLines([
        { id: "l1", scope: "build", status: "BUILDING", message: "compiling" },
        { id: "l2", scope: "runtime", status: "RUNNING", message: "ready" },
        { id: "l3", scope: "other", status: "info", message: "note" },
      ])

      expect(lines).toEqual([
        { id: "l1", scope: "build", status: "building", message: "compiling" },
        { id: "l2", scope: "runtime", status: "running", message: "ready" },
        { id: "l3", scope: "runtime", status: "deploying", message: "note" },
      ])
    })
  })

  describe("toDeployEventDTOs", () => {
    it("labels known event types and preserves order", () => {
      const createdAt = new Date("2026-06-05T10:00:00.000Z")
      const events = toDeployEventDTOs([
        {
          id: "e1",
          type: "QUEUED",
          message: null,
          metadataJson: null,
          createdAt,
        },
        {
          id: "e2",
          type: "DEPLOY_FAILED" as const,
          message: "lockfile",
          metadataJson: null,
          createdAt,
        },
        {
          id: "e3",
          type: "IMAGE_TAG_RECEIVED" as const,
          message: null,
          metadataJson: { imageTag: "187" },
          createdAt,
        },
        {
          id: "e4",
          type: "CUSTOM" as unknown as never,
          message: "x",
          metadataJson: null,
          createdAt,
        },
      ])

      expect(events[0]?.label).toBe("Queued")
      expect(events[1]?.label).toBe("Deploy failed")
      expect(events[1]?.message).toBe("lockfile")
      expect(events[2]?.label).toBe("Image tag received")
      expect(events[2]?.metadataJson).toEqual({ imageTag: "187" })
      expect(events[3]?.label).toBe("CUSTOM")
      expect(events[0]?.createdAt).toBe(createdAt.toISOString())
    })

    it("labels all new Jenkins and image events", () => {
      const createdAt = new Date("2026-06-05T10:00:00.000Z")
      const labels = toDeployEventDTOs([
        {
          id: "j1",
          type: "JENKINS_JOB_TRIGGERED",
          message: null,
          metadataJson: null,
          createdAt,
        },
        {
          id: "j2",
          type: "JENKINS_BUILD_QUEUED",
          message: null,
          metadataJson: null,
          createdAt,
        },
        {
          id: "j3",
          type: "JENKINS_BUILD_RUNNING",
          message: null,
          metadataJson: null,
          createdAt,
        },
        {
          id: "j4",
          type: "JENKINS_BUILD_COMPLETED",
          message: null,
          metadataJson: null,
          createdAt,
        },
        {
          id: "i1",
          type: "IMAGE_TAG_RECEIVED",
          message: null,
          metadataJson: null,
          createdAt,
        },
        {
          id: "g1",
          type: "GITOPS_COMMIT_CREATED",
          message: null,
          metadataJson: null,
          createdAt,
        },
        {
          id: "p1",
          type: "POD_READY",
          message: null,
          metadataJson: null,
          createdAt,
        },
      ]).map((e) => e.label)
      expect(labels).toEqual([
        "Jenkins job triggered",
        "Jenkins build queued",
        "Jenkins build running",
        "Jenkins build completed",
        "Image tag received",
        "GitOps commit created",
        "Pods ready",
      ])
    })
  })

  describe("buildDeployTimelineItems", () => {
    it("returns the 13 canonical ordered steps", () => {
      expect(buildDeployTimelineItems().map((item) => item.id)).toEqual([
        "queued",
        "monitor-wait",
        "monitor-picked-up",
        "jenkins-triggered",
        "jenkins-queued",
        "jenkins-running",
        "image-pushed",
        "image-tag-received",
        "gitops-committed",
        "argocd-sync-started",
        "argocd-synced",
        "pods-ready",
        "live",
      ])
    })
  })

  describe("resolveStackBillingState", () => {
    it("defaults to ACTIVE for missing/unknown metadata", () => {
      expect(resolveStackBillingState(null)).toBe("ACTIVE")
      expect(resolveStackBillingState({})).toBe("ACTIVE")
      expect(resolveStackBillingState({ billingState: "OTHER" })).toBe("ACTIVE")
    })

    it("surfaces grace and suspended states", () => {
      expect(resolveStackBillingState({ billingState: "PAYMENT_GRACE" })).toBe(
        "PAYMENT_GRACE"
      )
      expect(resolveStackBillingState({ billingState: "SUSPENDED" })).toBe(
        "SUSPENDED"
      )
    })
  })

  describe("toStackSummaryDTO", () => {
    it("maps a stack with its latest deployment id and billing state", () => {
      const lastDeployedAt = new Date("2026-06-05T10:00:00.000Z")
      const dto = toStackSummaryDTO({
        id: "stack-1",
        name: "console-next-app",
        slug: "console-next-app",
        status: "RUNNING",
        framework: "Next.js",
        branchName: "main",
        subdomain: "console-next-app.pfn.app",
        customDomain: null,
        resourcePlanId: "payg",
        billingMode: "PAYG",
        metadataJson: { billingState: "PAYMENT_GRACE" },
        lastDeployedAt,
        deployments: [{ id: "deploy-9" }, { id: "deploy-8" }],
      })

      expect(dto.status).toBe("running")
      expect(dto.billingState).toBe("PAYMENT_GRACE")
      expect(dto.latestDeploymentId).toBe("deploy-9")
      expect(dto.lastDeployedAt).toBe(lastDeployedAt.toISOString())
    })

    it("tolerates a stack with no deployments", () => {
      const dto = toStackSummaryDTO({
        id: "stack-2",
        name: "idle-app",
        slug: "idle-app",
        status: "IDLE",
        framework: null,
        branchName: "main",
        subdomain: null,
        customDomain: null,
        resourcePlanId: null,
        billingMode: null,
        metadataJson: null,
        lastDeployedAt: null,
      })

      expect(dto.status).toBe("idle")
      expect(dto.billingState).toBe("ACTIVE")
      expect(dto.latestDeploymentId).toBeNull()
      expect(dto.lastDeployedAt).toBeNull()
    })
  })
})
