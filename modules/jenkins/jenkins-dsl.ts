import { JenkinsJobConfig } from "./jenkins.types"

// ─── Groovy String Escaping ──────────────────────────────────────────────────

/**
 * Escape a value for safe interpolation inside single-quoted Groovy strings.
 * Replaces literal single quotes per Groovy escaping rules: ' → '\''
 */
function escapeGroovy(value: string): string {
  return String(value).replace(/'/g, "'\\''")
}

// ─── DSL Generators ──────────────────────────────────────────────────────────

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

pipelineJob('${escapeGroovy(appStackSlug)}') {
    description('Jenkins builder for Repository ${escapeGroovy(gitRepoUrl)}')

    properties {
        githubProjectProperty {
            projectUrlStr('${escapeGroovy(gitRepoUrl)}')
        }
    }

    parameters helpers.laravelParameters(
        '${escapeGroovy(gitRepoUrl)}',
        '${escapeGroovy(gitRepoBranch)}',
        '${escapeGroovy(phpVersion)}',
        '${escapeGroovy(nodeVersion)}',
        '${runNodeBuild}',
        '${escapeGroovy(tagVersion)}',
        ${useAlpine}
    )

    definition {
        cps {
            script("""
@Library('shared-library') _

laravelPipeline([
    codeRepo: '${escapeGroovy(gitRepoUrl)}',
    codeGitCredentialsId: '${escapeGroovy(gitCredentialId)}',
    codeBranch: '${escapeGroovy(gitRepoBranch)}',
    dockerRepo: '${escapeGroovy(appStackSlug)}',
    codeDeployPath: '${escapeGroovy(appStackSlug)}',
    webhookEnv: '${escapeGroovy(env)}',
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

pipelineJob('${escapeGroovy(appStackSlug)}') {
    description('Jenkins builder for Repository ${escapeGroovy(gitRepoUrl)}')

    properties {
        githubProjectProperty {
            projectUrlStr('${escapeGroovy(gitRepoUrl)}')
        }
    }

    parameters helpers.nodejsParameters(
        '${escapeGroovy(gitRepoUrl)}',
        '${escapeGroovy(gitRepoBranch)}',
        '${escapeGroovy(nodeVersion)}',
        'nodejs',
        '${escapeGroovy(tagVersion)}',
        ${useAlpine}
    )

    definition {
        cps {
            script("""
@Library('shared-library') _

nodejsPipeline([
    codeRepo: '${escapeGroovy(gitRepoUrl)}',
    codeGitCredentialsId: '${escapeGroovy(gitCredentialId)}',
    codeBranch: '${escapeGroovy(gitRepoBranch)}',
    dockerRepo: '${escapeGroovy(appStackSlug)}',
    codeDeployPath: '${escapeGroovy(appStackSlug)}',
    webhookEnv: '${escapeGroovy(env)}',
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
    .map(([key, value]) => `        '${escapeGroovy(key)}': '${escapeGroovy(value)}'`)
    .join(",\n")

  return `// Docker Image Pipeline Job DSL
def helpers = evaluate(readFileFromWorkspace('jobs/common/parameterHelpers.groovy'))

pipelineJob('${escapeGroovy(appStackSlug)}') {
    description('Jenkins builder for Docker Image ${escapeGroovy(dockerImage)}')

    parameters helpers.dockerParameters(
        '${escapeGroovy(dockerImage)}',
        '${escapeGroovy(dockerRegistryUrl)}',
        '${escapeGroovy(dockerRegistryCredentialId)}',
        '${escapeGroovy(tagVersion)}'
    )

    definition {
        cps {
            script("""
@Library('shared-library') _

dockerPipeline([
    dockerImage: '${escapeGroovy(dockerImage)}',
    dockerRegistryUrl: '${escapeGroovy(dockerRegistryUrl)}',
    dockerRegistryCredentialsId: '${escapeGroovy(dockerRegistryCredentialId)}',
    dockerRepo: '${escapeGroovy(appStackSlug)}',
    appName: '${escapeGroovy(appStackSlug)}',
    environmentVariables: [
${envVarsString}
    ],
    port: ${port},
    targetNamespace: 'app-${escapeGroovy(appStackSlug)}',
    webhookEnv: '${escapeGroovy(env)}'
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
