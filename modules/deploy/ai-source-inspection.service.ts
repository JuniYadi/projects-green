import {
  Prisma,
  type AiDeploymentSession,
  type PrismaClient,
} from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  AiDeploymentSessionService,
  type AiDeploymentSessionActor,
} from "@/modules/deploy/ai-deployment-session.service"
import {
  AI_MANUAL_OVERRIDE_FIELDS,
  type AiManualOverrideField,
  type AiSourceInspectionAccessDTO,
  type AiSourceInspectionManualOverrideDTO,
  type AiSourceInspectionReasonCode,
  type AiSourceInspectionRequestDTO,
  type AiSourceInspectionResult,
  type AiSourceInspectionSourceDTO,
} from "@/modules/deploy/ai-source-inspection.dto"
import {
  toDeploymentPlanDTO,
  type DeploymentPlanDTO,
} from "@/modules/deploy/deployment-plan.dto"
import { LOW_CONFIDENCE_THRESHOLD } from "@/modules/deploy/deploy.constants"
import { recommendPlan } from "@/modules/deploy/deploy-recommendation"
import { parsePublicGitUrl } from "@/modules/deploy/public-source"
import {
  checkPublicSourceAccess,
  type PublicSourceAccessResult,
} from "@/modules/deploy/public-source.service"
import {
  detectFrameworkFromGitRepo,
  detectFrameworkFromGithubApi,
  evaluateSupportDecision,
  FrameworkDetectionError,
  type DetectorRuleRecord,
  type GithubApiDetectorDependencies,
} from "@/modules/framework-detection/framework-detection.service"
import type {
  DetectionResult,
  FrameworkDetectionInput,
} from "@/modules/framework-detection/framework-detection.types"
import {
  GithubApiError,
  GithubReconnectRequiredError,
} from "@/modules/github/github.service"

const POLICY_UNAVAILABLE_MESSAGE =
  "Policy evaluation is not available for file-based detection."

const SOURCE_NOT_SUPPORTED_MESSAGE =
  "Only normalized GitHub HTTPS repository sources are supported."

const SAFE_ACCESS_MESSAGES: Record<
  | "ACCESS_REQUIRED"
  | "ACCESS_DENIED"
  | "SOURCE_REF_NOT_FOUND"
  | "SOURCE_UNAVAILABLE",
  string
> = {
  ACCESS_REQUIRED:
    "Connect GitHub access for this repository before inspection.",
  ACCESS_DENIED:
    "GitHub denied access to this repository. Reconnect GitHub and try again.",
  SOURCE_REF_NOT_FOUND: "The selected GitHub ref could not be found.",
  SOURCE_UNAVAILABLE:
    "GitHub could not be reached to verify this repository. Try again later.",
}

const SAFE_DETECTION_MESSAGES: Record<
  Exclude<
    AiSourceInspectionReasonCode,
    | "ACCESS_REQUIRED"
    | "ACCESS_DENIED"
    | "SOURCE_REF_NOT_FOUND"
    | "SOURCE_UNAVAILABLE"
    | "DETECTION_BLOCKED"
    | "DETECTION_UNSUPPORTED"
    | "DETECTION_LOW_CONFIDENCE"
    | "PLAN_UNRESOLVED"
    | "PLAN_INVALID"
  >,
  string
> = {
  DETECTION_CONFIG_ERROR:
    "Automatic detection is not configured. Complete the build settings manually.",
  DETECTION_SCHEMA_ERROR:
    "Automatic detection returned an invalid result. Complete the build settings manually.",
  DETECTION_PROVIDER_ERROR:
    "The detection provider failed. Complete the build settings manually.",
  DETECTION_TRANSIENT_PROVIDER_ERROR:
    "The detection provider is temporarily unavailable. Complete the build settings manually.",
  NETWORK_ERROR:
    "The repository could not be inspected because the network was unavailable.",
  DETECTION_FAILED:
    "The repository could not be inspected. Complete the build settings manually.",
}

const SAFE_PLAN_MESSAGES: Record<"PLAN_UNRESOLVED" | "PLAN_INVALID", string> = {
  PLAN_UNRESOLVED:
    "The deployment plan needs additional build settings before it is ready.",
  PLAN_INVALID: "The inspected deployment plan could not be validated safely.",
}

type SessionGateway = Pick<
  AiDeploymentSessionService,
  "create" | "get" | "transition"
>

type GithubRepositoryConnection = Prisma.GithubRepositoryConnectionGetPayload<{
  select: {
    id: true
    enabled: true
    defaultBranch: true
    isPrivate: true
    installation: {
      select: {
        githubInstallationId: true
        organizationId: true
        status: true
      }
    }
  }
}>

export type NormalizedGithubSource = AiSourceInspectionSourceDTO

export type GithubSourceNormalization =
  | { ok: true; source: NormalizedGithubSource }
  | { ok: false; message: string }

export type AiSourceInspectionServiceDependencies = {
  db?: PrismaClient
  sessions?: SessionGateway
  checkPublicAccess?: (input: {
    url: string
    ref?: string | null
  }) => Promise<PublicSourceAccessResult>
  detectPublic?: typeof detectFrameworkFromGitRepo
  detectGithub?: typeof detectFrameworkFromGithubApi
  now?: () => Date
}

export class AiSourceInspectionError extends Error {
  constructor(
    readonly code:
      | "SESSION_SOURCE_MISMATCH"
      | "INSPECTION_IN_PROGRESS"
      | "SESSION_NOT_RESUMABLE"
  ) {
    super(code)
  }
}

const isSafeRef = (value: string): boolean => {
  return (
    value.length > 0 && value.length <= 255 && !/[\u0000-\u001f]/.test(value)
  )
}

const normalizeSubdir = (value: string): string | null => {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "")
  if (!trimmed) return null
  if (trimmed.includes("\\")) return null

  const segments = trimmed.split("/")
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === ".."
    )
  ) {
    return null
  }

  return segments.join("/")
}

const decodePathSegment = (value: string): string | null => {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

export function normalizeGithubSource(input: {
  sourceUrl: string
  ref?: string
  subdir?: string
}): GithubSourceNormalization {
  const sourceUrl = input.sourceUrl.trim()
  if (!sourceUrl) {
    return { ok: false, message: SOURCE_NOT_SUPPORTED_MESSAGE }
  }

  const publicUrl = parsePublicGitUrl(sourceUrl)
  if ("error" in publicUrl) {
    return { ok: false, message: SOURCE_NOT_SUPPORTED_MESSAGE }
  }

  let parsed: URL
  try {
    parsed = new URL(publicUrl.url)
  } catch {
    return { ok: false, message: SOURCE_NOT_SUPPORTED_MESSAGE }
  }

  if (parsed.hostname.toLowerCase() !== "github.com" || parsed.port) {
    return { ok: false, message: SOURCE_NOT_SUPPORTED_MESSAGE }
  }

  const segments = parsed.pathname.split("/").filter(Boolean)
  if (segments.length !== 2) {
    return { ok: false, message: SOURCE_NOT_SUPPORTED_MESSAGE }
  }

  const owner = decodePathSegment(segments[0] ?? "")
  const rawRepo = decodePathSegment(segments[1] ?? "")
  if (!owner || !rawRepo) {
    return { ok: false, message: SOURCE_NOT_SUPPORTED_MESSAGE }
  }

  const repo = rawRepo.replace(/\.git$/i, "")
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(owner) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(repo)
  ) {
    return { ok: false, message: SOURCE_NOT_SUPPORTED_MESSAGE }
  }

  for (const key of parsed.searchParams.keys()) {
    if (key !== "ref") {
      return { ok: false, message: SOURCE_NOT_SUPPORTED_MESSAGE }
    }
  }

  const requestedRef = input.ref?.trim() || parsed.searchParams.get("ref")
  if (requestedRef !== null && requestedRef !== undefined) {
    if (!isSafeRef(requestedRef)) {
      return { ok: false, message: SOURCE_NOT_SUPPORTED_MESSAGE }
    }
  }

  const subdir = input.subdir ? normalizeSubdir(input.subdir) : null
  if (input.subdir && subdir === null) {
    return { ok: false, message: SOURCE_NOT_SUPPORTED_MESSAGE }
  }

  return {
    ok: true,
    source: {
      url: `https://github.com/${owner}/${repo}`,
      host: "github.com",
      owner,
      repo,
      ref: requestedRef || null,
      subdir,
    },
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const readStoredSource = (
  session: AiDeploymentSession
): NormalizedGithubSource | null => {
  if (!isObject(session.serverContext)) return null
  const source = session.serverContext.source
  if (!isObject(source)) return null
  if (
    typeof source.url !== "string" ||
    source.host !== "github.com" ||
    typeof source.owner !== "string" ||
    typeof source.repo !== "string"
  ) {
    return null
  }

  return {
    url: source.url,
    host: "github.com",
    owner: source.owner,
    repo: source.repo,
    ref: typeof source.ref === "string" ? source.ref : null,
    subdir: typeof source.subdir === "string" ? source.subdir : null,
  }
}

const sameSource = (
  left: NormalizedGithubSource | null,
  right: NormalizedGithubSource
): boolean => {
  return Boolean(
    left &&
    left.url === right.url &&
    left.ref === right.ref &&
    left.subdir === right.subdir
  )
}

const uniqueReferences = (values: Array<string | null | undefined>) => {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

const detectionReferences = (detection: DetectionResult | null) => {
  if (!detection) return []
  return uniqueReferences([
    detection.inspectionLogId
      ? `inspection-log:${detection.inspectionLogId}`
      : null,
    ...detection.evidence.map((entry) => entry.value),
  ])
}

const toReasonCode = (value: string): AiSourceInspectionReasonCode => {
  if (
    value === "DETECTION_CONFIG_ERROR" ||
    value === "DETECTION_SCHEMA_ERROR" ||
    value === "DETECTION_PROVIDER_ERROR" ||
    value === "DETECTION_TRANSIENT_PROVIDER_ERROR" ||
    value === "NETWORK_ERROR" ||
    value === "DETECTION_FAILED"
  ) {
    return value
  }
  return "DETECTION_FAILED"
}

const isGithubAccessFailure = (error: unknown): boolean => {
  if (error instanceof GithubReconnectRequiredError) return true
  if (error instanceof GithubApiError) {
    return [401, 403, 404].includes(error.statusCode ?? 0)
  }
  if (!(error instanceof Error)) return false
  return /access denied|forbidden|repository not found|reconnect github/i.test(
    error.message
  )
}

const toDetectionFailureCode = (
  error: unknown
): AiSourceInspectionReasonCode => {
  if (error instanceof FrameworkDetectionError) {
    return toReasonCode(error.code)
  }
  if (
    error instanceof Error &&
    /network|timeout|fetch|connection/i.test(error.message)
  ) {
    return "NETWORK_ERROR"
  }
  return "DETECTION_FAILED"
}

const isManualOverrideReason = (
  reasonCode: AiSourceInspectionReasonCode
): boolean => {
  return (
    reasonCode !== "DETECTION_BLOCKED" &&
    reasonCode !== "ACCESS_REQUIRED" &&
    reasonCode !== "ACCESS_DENIED" &&
    reasonCode !== "SOURCE_REF_NOT_FOUND" &&
    reasonCode !== "SOURCE_UNAVAILABLE"
  )
}

const getSafeReasonMessage = (reasonCode: AiSourceInspectionReasonCode) => {
  if (reasonCode in SAFE_ACCESS_MESSAGES) {
    return SAFE_ACCESS_MESSAGES[reasonCode as keyof typeof SAFE_ACCESS_MESSAGES]
  }
  if (reasonCode === "DETECTION_BLOCKED") {
    return "This repository is blocked by the active deployment policy."
  }
  if (reasonCode === "DETECTION_UNSUPPORTED") {
    return "The inspected framework is not currently supported. Complete the build settings manually."
  }
  if (reasonCode === "DETECTION_LOW_CONFIDENCE") {
    return "The framework detection confidence is low. Verify the build settings manually."
  }
  if (reasonCode === "PLAN_UNRESOLVED" || reasonCode === "PLAN_INVALID") {
    return SAFE_PLAN_MESSAGES[reasonCode]
  }
  return SAFE_DETECTION_MESSAGES[
    reasonCode as keyof typeof SAFE_DETECTION_MESSAGES
  ]
}

const toManualOverride = ({
  reasonCode,
  evidenceReferences,
}: {
  reasonCode: AiSourceInspectionReasonCode
  evidenceReferences: string[]
}): AiSourceInspectionManualOverrideDTO => ({
  required: true,
  reasonCode,
  message: getSafeReasonMessage(reasonCode),
  fields: [...AI_MANUAL_OVERRIDE_FIELDS] as AiManualOverrideField[],
  evidenceReferences,
})

type AccessResolution = {
  access: AiSourceInspectionAccessDTO
  connection: GithubRepositoryConnection | null
  source: NormalizedGithubSource
  reasonCode: AiSourceInspectionReasonCode | null
}

const tenantInstallationWhere = (actor: AiDeploymentSessionActor) => ({
  OR: [
    { organizationId: actor.organizationId },
    { organizationId: null, workosUserId: actor.userId },
  ],
})

export class AiSourceInspectionService {
  private readonly db: PrismaClient
  private readonly sessions: SessionGateway
  private readonly checkPublicAccess: NonNullable<
    AiSourceInspectionServiceDependencies["checkPublicAccess"]
  >
  private readonly detectPublic: typeof detectFrameworkFromGitRepo
  private readonly detectGithub: typeof detectFrameworkFromGithubApi
  private readonly now: () => Date

  constructor(dependencies: AiSourceInspectionServiceDependencies = {}) {
    this.db = dependencies.db ?? prisma
    this.sessions =
      dependencies.sessions ?? new AiDeploymentSessionService({ db: this.db })
    this.checkPublicAccess =
      dependencies.checkPublicAccess ?? checkPublicSourceAccess
    this.detectPublic = dependencies.detectPublic ?? detectFrameworkFromGitRepo
    this.detectGithub =
      dependencies.detectGithub ?? detectFrameworkFromGithubApi
    this.now = dependencies.now ?? (() => new Date())
  }

  async inspect({
    actor,
    request,
  }: {
    actor: AiDeploymentSessionActor
    request: AiSourceInspectionRequestDTO
  }): Promise<AiSourceInspectionResult> {
    const normalized = normalizeGithubSource(request)
    if (!normalized.ok) {
      return {
        status: "not_supported",
        source: null,
        access: null,
        detection: null,
        plan: null,
        manualOverride: null,
        evidenceReferences: [],
        session: null,
      }
    }

    const access = await this.resolveAccess(actor, normalized.source)
    let session = await this.prepareSession(
      actor,
      request.sessionId,
      access.source,
      access.reasonCode === null
    )

    if (session.status === "PLAN_READY") {
      return {
        status: "plan_ready",
        source: access.source,
        access: access.access,
        detection: null,
        plan: toDeploymentPlanDTO(session.plan),
        manualOverride: null,
        evidenceReferences: this.readContextReferences(session),
        session,
      }
    }

    const inspectingContext = this.buildContext({
      source: access.source,
      access: access.access,
      outcome: "inspecting",
      reasonCode: null,
      detection: null,
    })
    session = await this.sessions.transition({
      actor,
      sessionId: session.id,
      status: "INSPECTING",
      serverContext: inspectingContext,
    })

    if (access.reasonCode) {
      const evidenceReferences: string[] = []
      return this.blockSession({
        actor,
        session,
        source: access.source,
        access: access.access,
        detection: null,
        reasonCode: access.reasonCode,
        evidenceReferences,
      })
    }

    let detection: DetectionResult
    try {
      detection = await this.detectSource(access.source, access.connection)
    } catch (error) {
      if (access.connection && isGithubAccessFailure(error)) {
        return this.blockSession({
          actor,
          session,
          source: access.source,
          access: {
            state: "denied",
            displayLabel: "GitHub access denied",
          },
          detection: null,
          reasonCode: "ACCESS_DENIED",
          evidenceReferences: [],
        })
      }

      const reasonCode = toDetectionFailureCode(error)
      return this.blockSession({
        actor,
        session,
        source: access.source,
        access: access.access,
        detection: null,
        reasonCode,
        evidenceReferences: [
          ...(error instanceof FrameworkDetectionError && error.inspectionLogId
            ? [`inspection-log:${error.inspectionLogId}`]
            : []),
        ],
      })
    }

    const evidenceReferences = detectionReferences(detection)
    const decisionReason = this.getDecisionReason(detection)
    if (decisionReason) {
      return this.blockSession({
        actor,
        session,
        source: access.source,
        access: access.access,
        detection,
        reasonCode: decisionReason,
        evidenceReferences,
      })
    }

    const candidate = this.buildPlanCandidate({
      source: access.source,
      access: access.access,
      connection: access.connection,
      detection,
    })
    const readyContext = this.buildContext({
      source: access.source,
      access: access.access,
      outcome: "plan_ready",
      reasonCode: null,
      detection,
    })

    try {
      session = await this.sessions.transition({
        actor,
        sessionId: session.id,
        status: "PLAN_READY",
        plan: candidate,
        serverContext: readyContext,
      })
    } catch (error) {
      const reasonCode: AiSourceInspectionReasonCode =
        error instanceof Error && error.message === "PLAN_UNRESOLVED"
          ? "PLAN_UNRESOLVED"
          : error instanceof Error && error.message === "PLAN_INVALID"
            ? "PLAN_INVALID"
            : "PLAN_INVALID"

      return this.blockSession({
        actor,
        session,
        source: access.source,
        access: access.access,
        detection,
        reasonCode,
        evidenceReferences,
      })
    }

    return {
      status: "plan_ready",
      source: access.source,
      access: access.access,
      detection,
      plan: toDeploymentPlanDTO(session.plan),
      manualOverride: null,
      evidenceReferences,
      session,
    }
  }

  private async resolveAccess(
    actor: AiDeploymentSessionActor,
    source: NormalizedGithubSource
  ): Promise<AccessResolution> {
    let publicAccess: PublicSourceAccessResult
    try {
      publicAccess = await this.checkPublicAccess({
        url: source.url,
        ref: source.ref,
      })
    } catch {
      publicAccess = { accessible: false, reason: "unavailable" }
    }

    if (publicAccess.accessible) {
      return {
        access: {
          state: "public",
          displayLabel: "Public GitHub repository",
        },
        connection: null,
        source,
        reasonCode: null,
      }
    }

    const connection = await this.findConnection(actor, source)
    const isActive = Boolean(
      connection?.enabled && connection.installation.status === "active"
    )
    const resolvedSource = {
      ...source,
      ref: source.ref ?? connection?.defaultBranch ?? null,
    }

    if (publicAccess.reason === "ref_not_found") {
      return {
        access: {
          state: "denied",
          displayLabel: "GitHub ref unavailable",
        },
        connection,
        source: resolvedSource,
        reasonCode: "SOURCE_REF_NOT_FOUND",
      }
    }

    if (isActive && connection) {
      return {
        access: {
          state: "credential",
          displayLabel: "Connected GitHub repository",
        },
        connection,
        source: resolvedSource,
        reasonCode: null,
      }
    }

    if (connection || publicAccess.reason === "unavailable") {
      return {
        access: {
          state: "denied",
          displayLabel: "GitHub access unavailable",
        },
        connection,
        source: resolvedSource,
        reasonCode:
          publicAccess.reason === "unavailable"
            ? "SOURCE_UNAVAILABLE"
            : "ACCESS_DENIED",
      }
    }

    return {
      access: {
        state: "connection_required",
        displayLabel: "GitHub connection required",
      },
      connection: null,
      source: resolvedSource,
      reasonCode: "ACCESS_REQUIRED",
    }
  }

  private async findConnection(
    actor: AiDeploymentSessionActor,
    source: NormalizedGithubSource
  ): Promise<GithubRepositoryConnection | null> {
    return this.db.githubRepositoryConnection.findFirst({
      where: {
        fullName: {
          equals: `${source.owner}/${source.repo}`,
          mode: "insensitive",
        },
        installation: tenantInstallationWhere(actor),
      },
      select: {
        id: true,
        enabled: true,
        defaultBranch: true,
        isPrivate: true,
        installation: {
          select: {
            githubInstallationId: true,
            organizationId: true,
            status: true,
          },
        },
      },
    })
  }

  private async prepareSession(
    actor: AiDeploymentSessionActor,
    requestedSessionId: string | undefined,
    source: NormalizedGithubSource,
    reuseReadyPlan: boolean
  ): Promise<AiDeploymentSession> {
    let session = requestedSessionId
      ? await this.sessions.get(actor, requestedSessionId)
      : await this.sessions.create({ actor, sourceType: "SOURCE" })

    if (session.sourceType !== "SOURCE") {
      throw new AiSourceInspectionError("SESSION_SOURCE_MISMATCH")
    }

    const storedSource = readStoredSource(session)
    if (
      session.status === "PLAN_READY" &&
      reuseReadyPlan &&
      sameSource(storedSource, source)
    ) {
      return session
    }

    if (session.status === "INSPECTING") {
      throw new AiSourceInspectionError("INSPECTION_IN_PROGRESS")
    }

    if (
      session.status === "CONFIRMED" ||
      session.status === "EXECUTING" ||
      session.status === "SUCCEEDED" ||
      session.status === "CANCELLED"
    ) {
      throw new AiSourceInspectionError("SESSION_NOT_RESUMABLE")
    }

    if (session.status === "PLAN_READY") {
      session = await this.sessions.transition({
        actor,
        sessionId: session.id,
        status: "COLLECTING",
      })
    } else if (
      session.status === "BLOCKED" &&
      !sameSource(storedSource, source)
    ) {
      session = await this.sessions.transition({
        actor,
        sessionId: session.id,
        status: "COLLECTING",
      })
    } else if (session.status === "FAILED") {
      session = await this.sessions.transition({
        actor,
        sessionId: session.id,
        status: "COLLECTING",
      })
    }

    return session
  }

  private async detectSource(
    source: NormalizedGithubSource,
    connection: GithubRepositoryConnection | null
  ): Promise<DetectionResult> {
    if (connection) {
      return this.detectGithub(
        {
          installationId: Number(connection.installation.githubInstallationId),
          owner: source.owner,
          repo: source.repo,
          ref: source.ref ?? undefined,
          subdir: source.subdir ?? undefined,
        },
        { prisma: this.db } satisfies GithubApiDetectorDependencies
      )
    }

    const result = await this.detectPublic({
      repoUrl: source.url,
      ref: source.ref ?? undefined,
      subdir: source.subdir ?? undefined,
    } satisfies FrameworkDetectionInput)

    if (result.decision.message !== POLICY_UNAVAILABLE_MESSAGE) {
      return result
    }

    const rules = (await this.db.detectorRule.findMany({
      where: { isActive: true },
      orderBy: { priority: "desc" },
    })) as DetectorRuleRecord[]

    return {
      ...result,
      decision: evaluateSupportDecision(result, rules),
    }
  }

  private getDecisionReason(
    detection: DetectionResult
  ): AiSourceInspectionReasonCode | null {
    if (detection.confidence < LOW_CONFIDENCE_THRESHOLD / 100) {
      return "DETECTION_LOW_CONFIDENCE"
    }
    if (
      detection.warnings.some((warning) =>
        /ai (provider|fallback)|provider (failed|unavailable)|network/i.test(
          warning
        )
      )
    ) {
      return "DETECTION_PROVIDER_ERROR"
    }
    if (
      detection.decision.status === "success" &&
      detection.decision.isLaunchable
    ) {
      return null
    }
    if (detection.decision.status === "blocked") return "DETECTION_BLOCKED"
    if (detection.decision.status === "low_confidence") {
      return "DETECTION_LOW_CONFIDENCE"
    }
    return "DETECTION_UNSUPPORTED"
  }

  private buildPlanCandidate({
    source,
    access,
    connection,
    detection,
  }: {
    source: NormalizedGithubSource
    access: AiSourceInspectionAccessDTO
    connection: GithubRepositoryConnection | null
    detection: DetectionResult
  }): Record<string, unknown> {
    const primaryRuntime =
      detection.requiredDependencies.find(
        (dependency) => dependency.kind === "runtime"
      ) ?? detection.requiredDependencies[0]
    const recommendation = recommendPlan({
      framework: detection.primaryFramework?.id ?? null,
      secondaryEngine:
        detection.requiredDependencies.find(
          (dependency) => dependency.kind === "toolchain"
        )?.id ?? null,
    })
    const evidence = detection.evidence.map((entry) => ({
      kind: entry.type,
      summary: entry.detail ?? entry.value,
      reference: entry.type === "ai" ? null : entry.value,
    }))
    const inspectionReference = detection.inspectionLogId
      ? `inspection-log:${detection.inspectionLogId}`
      : null

    return {
      version: 1,
      source: {
        kind: "git",
        url: source.url,
        host: source.host,
        ref: source.ref,
        templateId: null,
        repositoryConnectionId: connection?.id ?? null,
      },
      access: {
        state: access.state === "public" ? "public" : "verified",
        displayLabel: access.displayLabel,
        credentialRef: null,
      },
      detection: {
        runtime: primaryRuntime?.id ?? null,
        framework: detection.primaryFramework?.id ?? null,
        version: detection.frameworkVersion ?? null,
        commands: [],
        port: detection.defaultPort ?? null,
        confidence: detection.confidence,
        evidence,
      },
      configuration: {
        appName: source.repo,
        branchOrRef: source.ref,
        environment: "production",
        envRequirements: [],
      },
      dependencies: [],
      resources: {
        package: recommendation.resourcePlanId,
        server: null,
        region: null,
        cpu: recommendation.cpu ?? null,
        memory: recommendation.memory ?? null,
        storage: null,
      },
      domain: {
        mode: "auto",
        hostname: null,
        tls: true,
      },
      billing: {
        quoteReference: null,
        currency: null,
        estimate: null,
        interval: null,
      },
      execution: {
        ready: true,
        steps: [
          {
            key: "resolve_source",
            label: "Source verified",
            status: "ready",
            evidenceReference: source.url,
          },
          {
            key: "inspect_runtime",
            label: "Runtime inspected",
            status: "ready",
            evidenceReference: inspectionReference,
          },
          {
            key: "validate_plan",
            label: "Plan validated",
            status: "ready",
            evidenceReference: null,
          },
          {
            key: "await_confirmation",
            label: "Awaiting confirmation",
            status: "pending",
            evidenceReference: null,
          },
        ],
      },
      unresolved: [],
      provenance: {
        analyzer: "framework-detector",
        sourceReference: detection.inspectionLogId ?? null,
        analyzedAt: this.now().toISOString(),
      },
    }
  }

  private buildContext({
    source,
    access,
    outcome,
    reasonCode,
    detection,
    evidenceReferences,
  }: {
    source: NormalizedGithubSource
    access: AiSourceInspectionAccessDTO
    outcome: "inspecting" | "plan_ready" | "blocked"
    reasonCode: AiSourceInspectionReasonCode | null
    detection: DetectionResult | null
    evidenceReferences?: string[]
  }): Prisma.InputJsonValue {
    return {
      version: 1,
      source: {
        url: source.url,
        host: source.host,
        owner: source.owner,
        repo: source.repo,
        ref: source.ref,
        subdir: source.subdir,
      },
      access: { state: access.state },
      inspection: {
        outcome,
        reasonCode,
        inspectionLogId: detection?.inspectionLogId ?? null,
        evidenceReferences:
          evidenceReferences ?? detectionReferences(detection),
      },
    }
  }

  private readContextReferences(session: AiDeploymentSession): string[] {
    if (!isObject(session.serverContext)) return []
    const inspection = session.serverContext.inspection
    if (
      !isObject(inspection) ||
      !Array.isArray(inspection.evidenceReferences)
    ) {
      return []
    }
    return inspection.evidenceReferences.filter(
      (value): value is string => typeof value === "string"
    )
  }

  private async blockSession({
    actor,
    session,
    source,
    access,
    detection,
    reasonCode,
    evidenceReferences,
  }: {
    actor: AiDeploymentSessionActor
    session: AiDeploymentSession
    source: NormalizedGithubSource
    access: AiSourceInspectionAccessDTO
    detection: DetectionResult | null
    reasonCode: AiSourceInspectionReasonCode
    evidenceReferences: string[]
  }): Promise<AiSourceInspectionResult> {
    const message = getSafeReasonMessage(reasonCode)
    const serverContext = this.buildContext({
      source,
      access,
      outcome: "blocked",
      reasonCode,
      detection,
      evidenceReferences,
    })
    const updated = await this.sessions.transition({
      actor,
      sessionId: session.id,
      status: "BLOCKED",
      blockedReason: message,
      serverContext,
    })
    const manualOverride = isManualOverrideReason(reasonCode)
      ? toManualOverride({ reasonCode, evidenceReferences })
      : null

    return {
      status: manualOverride ? "manual_override_required" : "blocked",
      source,
      access,
      detection,
      plan: null,
      manualOverride,
      evidenceReferences,
      session: updated,
    }
  }
}

export const __aiSourceInspectionTestables = {
  normalizeGithubSource,
  detectionReferences,
}
