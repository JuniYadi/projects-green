/**
 * Deterministic, explainable traffic classification. Per the Traffic
 * Visitor Intelligence issue's classification contract: thresholds live
 * here (not hidden in UI conditions), every result carries reasons[] and a
 * confidence, and "unknown" is a real outcome, not a hidden default.
 *
 * This does not identify a person -- it separates human-like navigation
 * patterns from automated/bot-like ones using aggregate evidence.
 */

export const CLASSIFICATION_VERSION = "v1"

export type ClassificationLabel =
  "likely_human" | "mixed" | "likely_automated" | "unknown"

export interface ClassificationInput {
  totalRequests: number
  /** Requests with a known bot/CLI User-Agent, or a missing one. */
  automatedUaRequests: number
  /** 2xx + 3xx requests. */
  successRequests: number
  /** 4xx + 5xx requests. */
  errorRequests: number
  /** Requests to known scanner/secret-probe paths (e.g. /.env, /.git/config). */
  probePathRequests: number
}

export interface ClassificationResult {
  label: ClassificationLabel
  confidence: number
  reasons: string[]
}

// Named thresholds, not magic numbers buried in the function body.
const MIN_EVIDENCE_REQUESTS = 3
const AUTOMATED_UA_RATIO_THRESHOLD = 0.6
const HUMAN_SUCCESS_RATIO_THRESHOLD = 0.9
const HIGH_ERROR_RATIO_THRESHOLD = 0.5
const PROBE_PATH_RATIO_THRESHOLD = 0.1

export function classifyTraffic(
  input: ClassificationInput
): ClassificationResult {
  const {
    totalRequests,
    automatedUaRequests,
    successRequests,
    errorRequests,
    probePathRequests,
  } = input

  if (totalRequests < MIN_EVIDENCE_REQUESTS) {
    return {
      label: "unknown",
      confidence: 0,
      reasons: [
        `Only ${totalRequests} request(s) -- too little evidence to classify`,
      ],
    }
  }

  const automatedRatio = automatedUaRequests / totalRequests
  const successRatio = successRequests / totalRequests
  const errorRatio = errorRequests / totalRequests
  const probeRatio = probePathRequests / totalRequests

  const reasons: string[] = []
  let automatedScore = 0
  let humanScore = 0

  if (automatedRatio >= AUTOMATED_UA_RATIO_THRESHOLD) {
    automatedScore += 2
    reasons.push(
      `${Math.round(automatedRatio * 100)}% of requests used a known bot/CLI client or a missing User-Agent`
    )
  }

  if (probeRatio >= PROBE_PATH_RATIO_THRESHOLD) {
    automatedScore += 2
    reasons.push(
      `${probePathRequests} request(s) hit known scanner/secret-probe paths`
    )
  }

  if (errorRatio >= HIGH_ERROR_RATIO_THRESHOLD) {
    automatedScore += 1
    reasons.push(
      `${Math.round(errorRatio * 100)}% of requests returned an error status`
    )
  }

  if (
    successRatio >= HUMAN_SUCCESS_RATIO_THRESHOLD &&
    automatedRatio < AUTOMATED_UA_RATIO_THRESHOLD
  ) {
    humanScore += 2
    reasons.push(
      `${Math.round(successRatio * 100)}% of requests were normal 2xx/3xx navigation`
    )
  }

  if (automatedScore > 0 && humanScore > 0) {
    return {
      label: "mixed",
      confidence: 50,
      reasons: [...reasons, "Conflicting evidence -- possibly a shared/NAT IP"],
    }
  }
  if (automatedScore >= 2) {
    return {
      label: "likely_automated",
      confidence: Math.min(50 + automatedScore * 10, 95),
      reasons,
    }
  }
  if (humanScore >= 2) {
    return {
      label: "likely_human",
      confidence: Math.min(50 + humanScore * 10, 95),
      reasons,
    }
  }
  return {
    label: "unknown",
    confidence: 20,
    reasons:
      reasons.length > 0 ? reasons : ["No distinguishing evidence either way"],
  }
}
