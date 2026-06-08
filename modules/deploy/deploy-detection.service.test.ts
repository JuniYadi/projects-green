import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test"
import {
  DetectionError,
  fetchFrameworkDetection,
  mapDetectionResultDTO,
} from "@/modules/deploy/deploy-detection.service"
import type { DetectionResultDTO } from "@/modules/framework-detection/framework-detection.dto"

// ─── Fixtures ───

const SUCCESS_DTO: DetectionResultDTO = {
  primaryFramework: {
    id: "nextjs-v14",
    name: "Next.js",
    ecosystem: "node",
    confidence: 95,
    reasons: ["Found next.config.js", "Found package.json with next"],
  },
  requiredDependencies: [],
  alternatives: [],
  confidence: 95,
  decision: {
    status: "success",
    message: "Framework detected successfully.",
    isLaunchable: true,
  },
  evidence: [
    { type: "file", value: "next.config.js", detail: "root" },
    { type: "file", value: "package.json", detail: "contains next dependency" },
  ],
  warnings: [],
  source: { repoUrl: "https://github.com/test/next-app" },
}

const LOW_CONFIDENCE_DTO: DetectionResultDTO = {
  primaryFramework: {
    id: "generic-node",
    name: "Node.js",
    ecosystem: "node",
    confidence: 45,
    reasons: ["Found package.json"],
  },
  requiredDependencies: [],
  alternatives: [],
  confidence: 45,
  decision: {
    status: "low_confidence",
    message: "Low confidence detection.",
    isLaunchable: true,
  },
  evidence: [{ type: "file", value: "package.json", detail: "root" }],
  warnings: [],
  source: { repoUrl: "https://github.com/test/node-app" },
}

const FAILED_DTO: DetectionResultDTO = {
  primaryFramework: null,
  requiredDependencies: [],
  alternatives: [],
  confidence: 0,
  decision: {
    status: "unsupported",
    message: "No known framework detected.",
    isLaunchable: false,
  },
  evidence: [],
  warnings: ["No recognizable framework markers found."],
  source: { repoUrl: "https://github.com/test/unknown-app" },
}

const DOCKERFILE_DTO: DetectionResultDTO = {
  ...SUCCESS_DTO,
  primaryFramework: { ...SUCCESS_DTO.primaryFramework!, name: "Django" },
  evidence: [
    { type: "file", value: "Dockerfile", detail: "root" },
    { type: "file", value: "requirements.txt", detail: "root" },
  ],
}

const LARAVEL_DTO: DetectionResultDTO = {
  ...SUCCESS_DTO,
  primaryFramework: { ...SUCCESS_DTO.primaryFramework!, name: "Laravel", ecosystem: "php" },
  evidence: [
    { type: "file", value: "artisan", detail: "root" },
  ],
}

// ─── mapDetectionResultDTO ───

describe("mapDetectionResultDTO", () => {
  it("maps framework name from primaryFramework", () => {
    const result = mapDetectionResultDTO(SUCCESS_DTO)
    expect(result.framework).toBe("Next.js")
  })

  it("maps ecosystem to language", () => {
    const result = mapDetectionResultDTO(SUCCESS_DTO)
    expect(result.language).toBe("Node.js")
  })

  it("maps language for unknown ecosystem as-is", () => {
    const dto: DetectionResultDTO = {
      ...SUCCESS_DTO,
      primaryFramework: { ...SUCCESS_DTO.primaryFramework!, ecosystem: "elixir" },
    }
    const result = mapDetectionResultDTO(dto)
    expect(result.language).toBe("elixir")
  })

  it("maps null primaryFramework to null language and framework", () => {
    const result = mapDetectionResultDTO(FAILED_DTO)
    expect(result.language).toBeNull()
    expect(result.framework).toBeNull()
  })

  it("maps status=success", () => {
    const result = mapDetectionResultDTO(SUCCESS_DTO)
    expect(result.status).toBe("success")
  })

  it("maps status=low_confidence", () => {
    const result = mapDetectionResultDTO(LOW_CONFIDENCE_DTO)
    expect(result.status).toBe("low_confidence")
  })

  it("maps decision blocked/unsupported to failed", () => {
    const result = mapDetectionResultDTO(FAILED_DTO)
    expect(result.status).toBe("failed")
  })

  it("detects Dockerfile in evidence", () => {
    const result = mapDetectionResultDTO(DOCKERFILE_DTO)
    expect(result.dockerfileDetected).toBe(true)
  })

  it("returns false dockerfileDetected when no Dockerfile evidence", () => {
    const result = mapDetectionResultDTO(SUCCESS_DTO)
    expect(result.dockerfileDetected).toBe(false)
  })

  it("derives known build command from framework", () => {
    const result = mapDetectionResultDTO(SUCCESS_DTO)
    expect(result.buildCommand).toBe("npm run build")
  })

  it("derives known build command for Laravel", () => {
    const result = mapDetectionResultDTO(LARAVEL_DTO)
    expect(result.buildCommand).toBe(
      "composer install --no-dev --optimize-autoloader"
    )
  })

  it("returns null buildCommand for unknown framework", () => {
    const dto: DetectionResultDTO = {
      ...SUCCESS_DTO,
      primaryFramework: { ...SUCCESS_DTO.primaryFramework!, name: "CustomFW" },
    }
    const result = mapDetectionResultDTO(dto)
    expect(result.buildCommand).toBeNull()
  })

  it("returns null buildCommand when primaryFramework is null", () => {
    const result = mapDetectionResultDTO(FAILED_DTO)
    expect(result.buildCommand).toBeNull()
  })

  it("carries confidence from DTO", () => {
    const result = mapDetectionResultDTO(SUCCESS_DTO)
    expect(result.confidence).toBe(95)
  })
})

// ─── fetchFrameworkDetection ───

describe("fetchFrameworkDetection", () => {
  const mockFetch = mock()

  beforeEach(() => {
    mockFetch.mockReset()
    // @ts-expect-error - global fetch mock
    global.fetch = mockFetch
  })

  const INPUT = {
    installationId: 12345,
    owner: "test-user",
    repo: "my-app",
    ref: "main",
    subdir: undefined,
  }

  it("sends POST to /api/framework-detection/github with correct body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, ...SUCCESS_DTO }),
    })

    await fetchFrameworkDetection(INPUT)

    expect(mockFetch).toHaveBeenCalledTimes(1)

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toContain("/api/framework-detection/github")
    expect(options.method).toBe("POST")
    expect(options.headers["Content-Type"]).toBe("application/json")

    const body = JSON.parse(options.body)
    expect(body.installationId).toBe(12345)
    expect(body.owner).toBe("test-user")
    expect(body.repo).toBe("my-app")
  })

  it("returns mapped DetectionResult on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, ...SUCCESS_DTO }),
    })

    const result = await fetchFrameworkDetection(INPUT)
    expect(result.framework).toBe("Next.js")
    expect(result.status).toBe("success")
  })

  it("throws DetectionError on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Detection service unavailable.",
      }),
    })

    try {
      await fetchFrameworkDetection(INPUT)
      expect.unreachable("Should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(DetectionError)
      expect((err as DetectionError).message).toBe(
        "Detection service unavailable."
      )
    }
  })

  it("throws DetectionError with fallback message when error body is unparseable", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("Invalid JSON")
      },
    })

    try {
      await fetchFrameworkDetection(INPUT)
      expect.unreachable("Should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(DetectionError)
      expect((err as DetectionError).message).toContain("502")
    }
  })

  it("throws DetectionError on network error", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"))

    try {
      await fetchFrameworkDetection(INPUT)
      expect.unreachable("Should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(DetectionError)
      expect((err as DetectionError).message).toContain("Failed to fetch")
    }
  })

  it("re-throws AbortError on abort", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError")
    mockFetch.mockRejectedValue(abortError)

    try {
      await fetchFrameworkDetection(INPUT)
      expect.unreachable("Should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(DOMException)
      expect((err as DOMException).name).toBe("AbortError")
    }
  })

  it("passes signal to fetch when provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, ...SUCCESS_DTO }),
    })

    const controller = new AbortController()
    await fetchFrameworkDetection(INPUT, controller.signal)

    const [, options] = mockFetch.mock.calls[0]
    expect(options.signal).toBe(controller.signal)
  })
})
