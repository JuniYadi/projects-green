import type { DetectionResult } from "@/modules/deploy/deploy.types"
import type { DetectionResultDTO } from "@/modules/framework-detection/framework-detection.dto"

// --- Types ---

export type FrameworkDetectionInput = {
  installationId: number
  owner: string
  repo: string
  ref?: string
  subdir?: string
}

export type FrameworkDetectionResponse = {
  ok: true
} & DetectionResultDTO

export type FrameworkDetectionErrorResponse = {
  ok: false
  error: string
  message: string
  fieldErrors?: Record<string, string[]>
}

export class DetectionError extends Error {
  constructor(
    message: string,
    public readonly code: string = "DETECTION_FAILED"
  ) {
    super(message)
    this.name = "DetectionError"
  }
}

// --- Constants ---

const DETECTION_API_PATH = "/api/framework-detection/github"

const ECOSYSTEM_TO_LANGUAGE: Record<string, string> = {
  node: "Node.js",
  php: "PHP",
  python: "Python",
  ruby: "Ruby",
  java: "Java",
  go: "Go",
  rust: "Rust",
}

const KNOWN_BUILD_COMMANDS: Record<string, string> = {
  "Next.js": "npm run build",
  "React": "npm run build",
  "Vue.js": "npm run build",
  "Angular": "npm run build",
  "Svelte": "npm run build",
  "Express": "npm run build",
  "NestJS": "npm run build",
  "Fastify": "npm run build",
  "Django": "pip install -r requirements.txt && python manage.py collectstatic",
  "Flask": "pip install -r requirements.txt",
  "FastAPI": "pip install -r requirements.txt",
  "Laravel": "composer install --no-dev --optimize-autoloader",
  "Symfony": "composer install --no-dev --optimize-autoloader",
  "Rails": "bundle install && rails assets:precompile",
  "Spring Boot": "./mvnw package -DskipTests",
  "Gin": "go build -o main .",
  "Echo": "go build -o main .",
  "Actix Web": "cargo build --release",
  "Rocket": "cargo build --release",
}

// --- Helpers ---

const mapEcosystemToLanguage = (
  ecosystem: string | undefined | null
): string | null => {
  if (!ecosystem) return null
  return ECOSYSTEM_TO_LANGUAGE[ecosystem] ?? ecosystem
}

const mapDecisionStatus = (
  decisionStatus: string | undefined | null,
  _confidence: number
): DetectionResult["status"] => {
  if (decisionStatus === "success") return "success"
  if (decisionStatus === "low_confidence") return "low_confidence"
  // "blocked" or "unsupported" → failed
  return "failed"
}

const deriveBuildCommand = (
  frameworkName: string | null | undefined
): string | null => {
  if (!frameworkName) return null
  return KNOWN_BUILD_COMMANDS[frameworkName] ?? null
}

const detectDockerfileInEvidence = (
  evidence: DetectionResultDTO["evidence"]
): boolean => {
  return evidence.some((e) => e.type === "file" && /Dockerfile/i.test(e.value))
}

// --- Mapper ---

export const mapDetectionResultDTO = (
  dto: DetectionResultDTO
): DetectionResult => {
  const frameworkName = dto.primaryFramework?.name ?? null
  const ecosystem = dto.primaryFramework?.ecosystem ?? null
  const dockerfileDetected = detectDockerfileInEvidence(dto.evidence)

  return {
    language: mapEcosystemToLanguage(ecosystem),
    framework: frameworkName,
    dockerfileDetected,
    buildCommand: deriveBuildCommand(frameworkName),
    confidence: dto.confidence,
    status: mapDecisionStatus(dto.decision?.status, dto.confidence),
  }
}

// --- API Client ---

export const fetchFrameworkDetection = async (
  input: FrameworkDetectionInput,
  signal?: AbortSignal
): Promise<DetectionResult> => {
  let response: Response

  try {
    response = await fetch(DETECTION_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause
    }

    throw new DetectionError(
      cause instanceof Error
        ? cause.message
        : "Network error while contacting detection service.",
      "NETWORK_ERROR"
    )
  }

  if (!response.ok) {
    let errorBody: FrameworkDetectionErrorResponse | null = null

    try {
      errorBody = (await response.json()) as FrameworkDetectionErrorResponse
    } catch {
      // ignore parse failure
    }

    throw new DetectionError(
      errorBody?.message ??
        `Detection request failed with status ${response.status}.`,
      errorBody?.error ?? "API_ERROR"
    )
  }

  const body: FrameworkDetectionResponse = (await response.json()) as FrameworkDetectionResponse

  if (!body.ok || body.primaryFramework == null) {
    throw new DetectionError(
      "Detection returned an unexpected response.",
      "INVALID_RESPONSE"
    )
  }

  const blockedStatuses = ["blocked", "unsupported"]
  if (blockedStatuses.includes(body.decision.status)) {
    throw new DetectionError(
      body.decision.message ?? "Detection is not supported for this repository.",
      "DETECTION_BLOCKED"
    )
  }

  return mapDetectionResultDTO(body)
}
