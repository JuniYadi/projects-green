import { prisma } from "@/lib/prisma"
import type {
  Prisma,
  DetectorRule,
  DetectorRuntimeMapping,
  DetectorInspectionLog,
} from "@prisma/client"

// --- DetectorRule CRUD ---

export async function listDetectorRules(options?: {
  includeInactive?: boolean
}): Promise<DetectorRule[]> {
  return prisma.detectorRule.findMany({
    where: options?.includeInactive ? {} : { isActive: true },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  })
}

export async function getDetectorRuleById(
  id: string
): Promise<DetectorRule | null> {
  return prisma.detectorRule.findUnique({ where: { id } })
}

export async function createDetectorRule(data: {
  name: string
  description?: string
  patternJson: unknown
  implicationsJson: unknown
  confidenceWeight?: number
  priority?: number
}): Promise<DetectorRule> {
  return prisma.detectorRule.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      patternJson: data.patternJson as Prisma.InputJsonValue,
      implicationsJson: data.implicationsJson as Prisma.InputJsonValue,
      confidenceWeight: data.confidenceWeight ?? 1.0,
      priority: data.priority ?? 0,
    },
  })
}

export async function updateDetectorRule(
  id: string,
  data: {
    name?: string
    description?: string | null
    patternJson?: unknown
    implicationsJson?: unknown
    confidenceWeight?: number
    isActive?: boolean
    priority?: number
  }
): Promise<DetectorRule> {
  const updateData: Prisma.DetectorRuleUpdateInput = {}

  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.patternJson !== undefined)
    updateData.patternJson = data.patternJson as Prisma.InputJsonValue
  if (data.implicationsJson !== undefined)
    updateData.implicationsJson = data.implicationsJson as Prisma.InputJsonValue
  if (data.confidenceWeight !== undefined)
    updateData.confidenceWeight = data.confidenceWeight
  if (data.isActive !== undefined) updateData.isActive = data.isActive
  if (data.priority !== undefined) updateData.priority = data.priority

  return prisma.detectorRule.update({ where: { id }, data: updateData })
}

export async function deleteDetectorRule(id: string): Promise<DetectorRule> {
  return prisma.detectorRule.delete({ where: { id } })
}

// --- DetectorRuntimeMapping CRUD ---

export async function listRuntimeMappings(options?: {
  includeInactive?: boolean
}): Promise<DetectorRuntimeMapping[]> {
  return prisma.detectorRuntimeMapping.findMany({
    where: options?.includeInactive ? {} : { isActive: true },
    orderBy: [{ frameworkId: "asc" }, { priority: "desc" }],
  })
}

export async function getRuntimeMappingById(
  id: string
): Promise<DetectorRuntimeMapping | null> {
  return prisma.detectorRuntimeMapping.findUnique({ where: { id } })
}

export async function createRuntimeMapping(data: {
  frameworkId: string
  frameworkVersion?: string
  runtimeId: string
  runtimeVersion: string
  buildVersion?: string
  priority?: number
}): Promise<DetectorRuntimeMapping> {
  return prisma.detectorRuntimeMapping.create({
    data: {
      frameworkId: data.frameworkId,
      frameworkVersion: data.frameworkVersion ?? null,
      runtimeId: data.runtimeId,
      runtimeVersion: data.runtimeVersion,
      buildVersion: data.buildVersion ?? null,
      priority: data.priority ?? 0,
    },
  })
}

export async function updateRuntimeMapping(
  id: string,
  data: {
    frameworkId?: string
    frameworkVersion?: string | null
    runtimeId?: string
    runtimeVersion?: string
    buildVersion?: string | null
    isActive?: boolean
    priority?: number
  }
): Promise<DetectorRuntimeMapping> {
  const updateData: Prisma.DetectorRuntimeMappingUpdateInput = {}

  if (data.frameworkId !== undefined) updateData.frameworkId = data.frameworkId
  if (data.frameworkVersion !== undefined)
    updateData.frameworkVersion = data.frameworkVersion
  if (data.runtimeId !== undefined) updateData.runtimeId = data.runtimeId
  if (data.runtimeVersion !== undefined)
    updateData.runtimeVersion = data.runtimeVersion
  if (data.buildVersion !== undefined)
    updateData.buildVersion = data.buildVersion
  if (data.isActive !== undefined) updateData.isActive = data.isActive
  if (data.priority !== undefined) updateData.priority = data.priority

  return prisma.detectorRuntimeMapping.update({
    where: { id },
    data: updateData,
  })
}

export async function deleteRuntimeMapping(
  id: string
): Promise<DetectorRuntimeMapping> {
  return prisma.detectorRuntimeMapping.delete({ where: { id } })
}

// --- DetectorInspectionLog Queries ---

export async function listInspectionLogs(options?: {
  limit?: number
  offset?: number
  status?: string
  repoUrl?: string
  framework?: string
}): Promise<{ logs: DetectorInspectionLog[]; total: number }> {
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  const where: Prisma.DetectorInspectionLogWhereInput = {}

  if (options?.status) where.status = options.status
  if (options?.repoUrl) where.repoUrl = { contains: options.repoUrl }
  if (options?.framework)
    where.detectedFramework = { contains: options.framework }

  const [logs, total] = await Promise.all([
    prisma.detectorInspectionLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.detectorInspectionLog.count({ where }),
  ])

  return { logs, total }
}

export async function getInspectionLogById(
  id: string
): Promise<DetectorInspectionLog | null> {
  return prisma.detectorInspectionLog.findUnique({ where: { id } })
}

// --- AI Rule Recommendations ---

export type RuleRecommendation = {
  id: string
  suggestedName: string
  suggestedDescription: string
  suggestedPatternJson: unknown
  suggestedImplicationsJson: unknown
  suggestedConfidenceWeight: number
  suggestedPriority: number
  reasoning: string
  basedOnLogIds: string[]
}

export async function generateRuleRecommendations(): Promise<
  RuleRecommendation[]
> {
  // Fetch recent logs to analyze patterns
  const recentLogs = await prisma.detectorInspectionLog.findMany({
    where: { status: "success" },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  if (recentLogs.length === 0) {
    return []
  }

  // Group by detected framework to find patterns
  const frameworkGroups = new Map<
    string,
    { logs: typeof recentLogs; avgConfidence: number }
  >()

  for (const log of recentLogs) {
    const fw = log.detectedFramework ?? "unknown"
    const existing = frameworkGroups.get(fw) ?? {
      logs: [],
      avgConfidence: 0,
    }
    existing.logs.push(log)
    frameworkGroups.set(fw, existing)
  }

  // Calculate average confidence per framework
  for (const [fw, group] of frameworkGroups) {
    const confidences = group.logs
      .map((l) => l.confidence ?? 0)
      .filter((c) => c > 0)
    group.avgConfidence =
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0
    frameworkGroups.set(fw, group)
  }

  // Fetch existing rules to avoid duplicates
  const existingRules = await prisma.detectorRule.findMany({
    where: { isActive: true },
  })
  const existingFrameworks = new Set(
    existingRules.map((r) => {
      const impl = r.implicationsJson as { framework?: string } | null
      return impl?.framework
    })
  )
  const existingLaunchFrameworks = new Set(
    existingRules
      .filter((r) => {
        const impl = r.implicationsJson as {
          impact?: string
          framework?: string
        } | null
        return impl?.impact === "LAUNCH" && Boolean(impl.framework)
      })
      .map((r) => {
        const impl = r.implicationsJson as { framework?: string } | null
        return impl?.framework
      })
  )

  // Generate recommendations for frameworks that:
  //  - have enough detections to be meaningful
  //  - don't already have any rule (HINT path) OR have a high-confidence
  //    trend but no LAUNCH rule (LAUNCH path)
  const recommendations: RuleRecommendation[] = []
  let recId = 0

  for (const [fw, group] of frameworkGroups) {
    if (fw === "unknown") continue
    if (group.logs.length < 3) continue // Need enough data

    // LAUNCH promotion: high confidence, supported pattern emerging, but no
    // existing LAUNCH rule — recommend promoting the framework.
    if (group.avgConfidence >= 0.8 && !existingLaunchFrameworks.has(fw)) {
      recId++
      recommendations.push({
        id: `rec-${recId}`,
        suggestedName: `Promote ${fw} to Launchable`,
        suggestedDescription: `Promote ${fw} to LAUNCH status based on ${group.logs.length} high-confidence detections (avg ${(group.avgConfidence * 100).toFixed(0)}%).`,
        suggestedPatternJson: {
          frameworkId: fw,
        },
        suggestedImplicationsJson: {
          framework: fw,
          impact: "LAUNCH",
          minConfidence: 0.8,
        },
        suggestedConfidenceWeight: group.avgConfidence,
        suggestedPriority: 100,
        reasoning: `Detected ${fw} with high confidence (${(group.avgConfidence * 100).toFixed(0)}%). Consider promoting this to a supported launchable framework.`,
        basedOnLogIds: group.logs.map((l) => l.id),
      })
      continue
    }

    // HINT: framework is detected but has no rule at all — recommend a
    // detection hint rule to improve accuracy.
    if (existingFrameworks.has(fw)) continue

    recId++
    recommendations.push({
      id: `rec-${recId}`,
      suggestedName: `Auto-detect ${fw}`,
      suggestedDescription: `Rule based on ${group.logs.length} recent detections with avg confidence ${(group.avgConfidence * 100).toFixed(0)}%`,
      suggestedPatternJson: {
        files: [],
        dependencies: [],
      },
      suggestedImplicationsJson: {
        framework: fw,
        impact: "HINT",
      },
      suggestedConfidenceWeight: Math.max(0.5, group.avgConfidence),
      suggestedPriority: group.logs.length > 10 ? 10 : 5,
      reasoning: `Detected ${group.logs.length} inspections for ${fw} with average confidence ${(group.avgConfidence * 100).toFixed(0)}%. Consider adding a detection rule to improve accuracy.`,
      basedOnLogIds: group.logs.map((l) => l.id),
    })
  }

  return recommendations
}
