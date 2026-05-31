import { JenkinsJobConfig } from "./jenkins.types"

export interface JenkinsDslOptions {
  appStackSlug: string
  gitRepoUrl: string
  gitRepoBranch: string
  gitCredentialId: string
  phpVersion?: string
  nodeVersion?: string
  runNodeBuild?: boolean
  tagVersion?: string
  useAlpine?: boolean
  dockerImage?: string
  dockerRegistryUrl?: string
  dockerRegistryCredentialId?: string
  env?: "prod" | "dev"
  port?: number
  environmentVariables?: Record<string, string>
}

export function generatePhpDsl(options: JenkinsDslOptions): string {
  const {
    appStackSlug,
    gitRepoUrl,
    gitRepoBranch,
    gitCredentialId,
    phpVersion = "8.4",
    nodeVersion = "22",
    runNodeBuild = false,
    tagVersion = "latest",
    useAlpine = true,
    env = "dev",
  } = options

  return `// PHP Application Pipeline Job DSL
def helpers = evaluate(readFileFromWorkspace('jobs/common/parameterHelpers.groovy'))

pipelineJob('${appStackSlug}') {
    description('Jenkins builder for Repository ${gitRepoUrl}')

    properties {
        githubProjectProperty {
            projectUrlStr('${gitRepoUrl}')
        }
    }

    parameters helpers.laravelParameters(
        '${gitRepoUrl}',
        '${gitRepoBranch}',
        '${phpVersion}',
        '${nodeVersion}',
        '${runNodeBuild}',
        '${tagVersion}',
        ${useAlpine}
    )

    definition {
        cps {
            script("""
@Library('shared-library') _

laravelPipeline([
    codeRepo: '${gitRepoUrl}',
    codeGitCredentialsId: '${gitCredentialId}',
    codeBranch: '${gitRepoBranch}',
    dockerRepo: '${appStackSlug}',
    codeDeployPath: '${appStackSlug}',
    webhookEnv: '${env}',
])
            """)
            sandbox()
        }
    }

    with helpers.commonJobSettings()
}`
}

export function generateNodeDsl(options: JenkinsDslOptions): string {
  const {
    appStackSlug,
    gitRepoUrl,
    gitRepoBranch,
    gitCredentialId,
    nodeVersion = "22",
    tagVersion = "latest",
    useAlpine = true,
    env = "dev",
  } = options

  return `// Node.js Application Pipeline Job DSL
def helpers = evaluate(readFileFromWorkspace('jobs/common/parameterHelpers.groovy'))

pipelineJob('${appStackSlug}') {
    description('Jenkins builder for Repository ${gitRepoUrl}')

    properties {
        githubProjectProperty {
            projectUrlStr('${gitRepoUrl}')
        }
    }

    parameters helpers.nodejsParameters(
        '${gitRepoUrl}',
        '${gitRepoBranch}',
        '${nodeVersion}',
        'nodejs',
        '${tagVersion}',
        ${useAlpine}
    )

    definition {
        cps {
            script("""
@Library('shared-library') _

nodejsPipeline([
    codeRepo: '${gitRepoUrl}',
    codeGitCredentialsId: '${gitCredentialId}',
    codeBranch: '${gitRepoBranch}',
    dockerRepo: '${appStackSlug}',
    codeDeployPath: '${appStackSlug}',
    webhookEnv: '${env}',
])
            """)
            sandbox()
        }
    }

    with helpers.commonJobSettings()
}`
}

export function generateDockerDsl(options: JenkinsDslOptions): string {
  const {
    appStackSlug,
    dockerImage = appStackSlug,
    dockerRegistryUrl = "registry-apac.pfnapp.com",
    dockerRegistryCredentialId = "",
    tagVersion = "latest",
    env = "dev",
    port = 8000,
    environmentVariables = {},
  } = options

  const envVarsString = Object.entries(environmentVariables)
    .map(([key, value]) => `        '${key}': '${value}'`)
    .join(",\n")

  return `// Docker Image Pipeline Job DSL
def helpers = evaluate(readFileFromWorkspace('jobs/common/parameterHelpers.groovy'))

pipelineJob('${appStackSlug}') {
    description('Jenkins builder for Docker Image ${dockerImage}')

    parameters helpers.dockerParameters(
        '${dockerImage}',
        '${dockerRegistryUrl}',
        '${dockerRegistryCredentialId}',
        '${tagVersion}'
    )

    definition {
        cps {
            script("""
@Library('shared-library') _

dockerPipeline([
    dockerImage: '${dockerImage}',
    dockerRegistryUrl: '${dockerRegistryUrl}',
    dockerRegistryCredentialsId: '${dockerRegistryCredentialId}',
    dockerRepo: '${appStackSlug}',
    appName: '${appStackSlug}',
    environmentVariables: [
${envVarsString}
    ],
    port: ${port},
    targetNamespace: 'app-${appStackSlug}',
    webhookEnv: '${env}'
])
            """)
            sandbox()
        }
    }

    with helpers.commonJobSettings()
}`
}

export function generateJenkinsDsl(config: JenkinsJobConfig, options: Partial<JenkinsDslOptions> = {}): string {
  const dslOptions: JenkinsDslOptions = {
    appStackSlug: config.name,
    gitRepoUrl: config.repositoryUrl || "",
    gitRepoBranch: config.branch || "main",
    gitCredentialId: config.credentialId || "",
    ...options,
  }

  switch (config.type) {
    case "php":
      return generatePhpDsl(dslOptions)
    case "node":
      return generateNodeDsl(dslOptions)
    case "docker":
      return generateDockerDsl(dslOptions)
    default:
      throw new Error(`Unsupported job type: ${config.type}`)
  }
}
