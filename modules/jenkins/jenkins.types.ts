export interface JenkinsServer {
  url: string
  username: string
  apiToken: string
}

export interface JenkinsJobConfig {
  name: string
  type: "php" | "node" | "docker"
  repositoryUrl?: string
  branch?: string
  credentialId?: string
  parameters?: Record<string, string | boolean | number>
}

export interface JenkinsBuild {
  id: string
  jobName: string
  buildNumber: number
  status: "SUCCESS" | "FAILURE" | "UNSTABLE" | "ABORTED" | "BUILDING" | "PENDING"
  url: string
  timestamp: number
}

export class JenkinsApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseText?: string
  ) {
    super(message)
    this.name = "JenkinsApiError"
  }
}

export class JenkinsConnectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "JenkinsConnectionError"
  }
}

export class JenkinsAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "JenkinsAuthError"
  }
}