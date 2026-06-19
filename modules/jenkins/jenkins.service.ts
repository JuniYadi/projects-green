import { buildWithParameters, jenkinsApiFetch } from "./jenkins-api"
import type { JenkinsBuild } from "./jenkins.types"

export interface JenkinsBuildDispatcherArgs {
  eventId: string
  jobName: string
  parameters: Record<string, string | boolean | number>
}

export type JenkinsBuildDispatcher = (
  args: JenkinsBuildDispatcherArgs
) => Promise<void>

/**
 * Factory for Jenkins build dispatcher.
 * Returns a dispatcher compatible with the webhook module's GithubBuildDispatcher type.
 */
export const createJenkinsBuildDispatcher = (): JenkinsBuildDispatcher => {
  return async ({ jobName, parameters }) => {
    await buildWithParameters(jobName, parameters)
  }
}

export async function getJenkinsJobStatus(
  jobName: string
): Promise<JenkinsBuild | null> {
  try {
    const data = (await jenkinsApiFetch(
      `job/${jobName}/lastBuild/api/json`
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
  parameters: Record<string, string | boolean | number> = {}
): Promise<void> {
  await buildWithParameters(jobName, parameters)
}

export async function listJenkinsJobs(): Promise<string[]> {
  const data = (await jenkinsApiFetch("api/json?tree=jobs[name]")) as {
    jobs: Array<{ name: string }>
  }
  return data.jobs.map((job) => job.name)
}
