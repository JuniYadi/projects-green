import { buildWithParameters, jenkinsApiFetch } from "./jenkins-api"
import type { JenkinsApiConfig } from "./jenkins-api"
export type { JenkinsApiConfig }
import type { JenkinsBuild } from "./jenkins.types"

export interface JenkinsBuildDispatcherArgs {
  eventId: string
  jobName: string
  parameters: Record<string, string | boolean | number>
  config?: JenkinsApiConfig
}

export type JenkinsBuildDispatcher = (
  args: JenkinsBuildDispatcherArgs
) => Promise<void>

/**
 * Factory for Jenkins build dispatcher.
 * Returns a dispatcher compatible with the webhook module's GithubBuildDispatcher type.
 */
export const createJenkinsBuildDispatcher = (): JenkinsBuildDispatcher => {
  return async ({ jobName, parameters, config }) => {
    await buildWithParameters(jobName, parameters, config)
  }
}

export async function getJenkinsJobStatus(
  jobName: string,
  config?: JenkinsApiConfig
): Promise<JenkinsBuild | null> {
  try {
    const data = (await jenkinsApiFetch(
      `job/${jobName}/lastBuild/api/json`,
      {},
      config
    )) as {
      id: string
      number: number
      result: string | null
      building: boolean
      url: string
      timestamp: number
    }

    return {
      id: data.id,
      jobName,
      buildNumber: data.number,
      status:
        (data.result as JenkinsBuild["status"]) ??
        (data.building ? "BUILDING" : "PENDING"),
      url: data.url,
      timestamp: data.timestamp,
    }
  } catch {
    return null
  }
}

export async function triggerJenkinsJob(
  jobName: string,
  parameters: Record<string, string | boolean | number> = {},
  config?: JenkinsApiConfig
): Promise<void> {
  await buildWithParameters(jobName, parameters, config)
}

export async function listJenkinsJobs(
  config?: JenkinsApiConfig
): Promise<string[]> {
  const data = (await jenkinsApiFetch(
    "api/json?tree=jobs[name]",
    {},
    config
  )) as {
    jobs: Array<{ name: string }>
  }
  return data.jobs.map((j) => j.name)
}
