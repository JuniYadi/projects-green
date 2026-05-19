import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { remediateCreatorMembershipTenantRole } from "@/modules/tenants/services/tenant-workos.service"

type RemediationTarget = {
  organizationId: string
  creatorUserId: string
}

const args = process.argv.slice(2)

const getArgValue = (name: string) => {
  const match = args.find((item) => item.startsWith(`${name}=`))
  if (!match) {
    return null
  }

  const [, rawValue] = match.split("=")
  const value = rawValue?.trim()
  return value ? value : null
}

const applyChanges = args.includes("--apply")
const inputPath = getArgValue("--input")
const organizationId = getArgValue("--organization-id")
const creatorUserId = getArgValue("--creator-user-id")

const parseTargetsFromInput = async (
  absolutePath: string
): Promise<RemediationTarget[]> => {
  const inputRaw = await readFile(absolutePath, "utf8")
  const parsed = JSON.parse(inputRaw) as unknown

  if (!Array.isArray(parsed)) {
    throw new Error("Input file must be a JSON array.")
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Input item #${index + 1} must be an object.`)
    }

    const target = item as Partial<RemediationTarget>
    const normalizedOrganizationId = target.organizationId?.trim()
    const normalizedCreatorUserId = target.creatorUserId?.trim()

    if (!normalizedOrganizationId || !normalizedCreatorUserId) {
      throw new Error(
        `Input item #${index + 1} requires organizationId and creatorUserId.`
      )
    }

    return {
      organizationId: normalizedOrganizationId,
      creatorUserId: normalizedCreatorUserId,
    }
  })
}

const resolveTargets = async (): Promise<RemediationTarget[]> => {
  const targets: RemediationTarget[] = []

  if (inputPath) {
    const absolutePath = resolve(process.cwd(), inputPath)
    const fromFile = await parseTargetsFromInput(absolutePath)
    targets.push(...fromFile)
  }

  if (organizationId || creatorUserId) {
    if (!organizationId || !creatorUserId) {
      throw new Error(
        "Use --organization-id and --creator-user-id together for single-target mode."
      )
    }

    targets.push({
      organizationId,
      creatorUserId,
    })
  }

  if (targets.length === 0) {
    throw new Error(
      "Provide targets with --input=<json_file> or with --organization-id and --creator-user-id."
    )
  }

  const deduped = new Map<string, RemediationTarget>()
  for (const target of targets) {
    deduped.set(`${target.organizationId}:${target.creatorUserId}`, target)
  }

  return [...deduped.values()]
}

try {
  const workosApiKey = process.env.WORKOS_API_KEY?.trim()
  if (!workosApiKey) {
    throw new Error("Missing required environment variable: WORKOS_API_KEY")
  }

  const targets = await resolveTargets()
  const results = []

  for (const target of targets) {
    const result = await remediateCreatorMembershipTenantRole({
      organizationId: target.organizationId,
      creatorUserId: target.creatorUserId,
      dryRun: !applyChanges,
    })
    results.push(result)
  }

  const summary = {
    mode: applyChanges ? "apply" : "dry-run",
    targetCount: targets.length,
    remediatedCount: results.filter((result) => result.status === "REMEDIATED")
      .length,
    missingRoleDetectedCount: results.filter(
      (result) => result.status === "MISSING_ROLE_DETECTED"
    ).length,
    alreadyValidCount: results.filter((result) => result.status === "ALREADY_VALID")
      .length,
    membershipNotFoundCount: results.filter(
      (result) => result.status === "MEMBERSHIP_NOT_FOUND"
    ).length,
  }

  console.log("Creator tenant-role remediation completed.")
  console.log(
    "Detection query: list memberships by organization, then find creator membership with an unmapped role."
  )
  console.log(
    JSON.stringify(
      {
        summary,
        results,
      },
      null,
      2
    )
  )
} catch (error) {
  console.error("Creator tenant-role remediation failed.")
  if (error instanceof Error) {
    console.error(error.message)
  }
  process.exit(1)
}
