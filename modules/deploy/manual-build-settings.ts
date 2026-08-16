import {
  MANUAL_FRAMEWORK_OPTIONS,
  MANUAL_LANGUAGE_OPTIONS,
} from "@/modules/deploy/deploy.constants"
import { AiDeploymentSessionError } from "@/modules/deploy/ai-deployment-session.service"

export type ManualBuildSettingsInput = {
  language: string
  framework: string
  runtimeVersion: string
  packageManager: string
  buildCommand: string
  startCommand: string
  port: number
  useDockerfile: boolean
  dockerfilePath: string | null
}

const isRepositoryRelativePath = (value: string): boolean => {
  return (
    /^[\w./-]+$/.test(value) &&
    !value.startsWith("/") &&
    !value.includes("://") &&
    !value.split("/").includes("..")
  )
}

export const parseManualBuildSettings = (
  settings: ManualBuildSettingsInput
): ManualBuildSettingsInput => {
  const validLanguage = MANUAL_LANGUAGE_OPTIONS.includes(
    settings.language as (typeof MANUAL_LANGUAGE_OPTIONS)[number]
  )
  const validFramework = MANUAL_FRAMEWORK_OPTIONS.includes(
    settings.framework as (typeof MANUAL_FRAMEWORK_OPTIONS)[number]
  )
  const validCommands =
    settings.buildCommand.trim().length > 0 &&
    settings.startCommand.trim().length > 0
  const validPort =
    Number.isInteger(settings.port) &&
    settings.port >= 1 &&
    settings.port <= 65535
  const validDockerfile =
    !settings.useDockerfile ||
    (settings.dockerfilePath !== null &&
      isRepositoryRelativePath(settings.dockerfilePath))

  if (
    !validLanguage ||
    !validFramework ||
    !validCommands ||
    !validPort ||
    !validDockerfile
  ) {
    throw new AiDeploymentSessionError("MANUAL_SETTINGS_INVALID")
  }

  return settings
}
