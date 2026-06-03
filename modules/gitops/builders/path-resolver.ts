export interface ManifestPathResolverOptions {
  tenant: string
  stack: string
  container: string
  basePath?: string
}

export interface ManifestPath {
  kind: string
  path: string
}

export class ManifestPathResolver {
  private tenant: string
  private stack: string
  private container: string
  private basePath: string

  constructor(options: ManifestPathResolverOptions) {
    this.tenant = options.tenant
    this.stack = options.stack
    this.container = options.container
    this.basePath = options.basePath ?? "services-yaml"
  }

  private getDir(): string {
    return `${this.basePath}/${this.tenant}/${this.stack}/${this.container}`
  }

  getConfigMapPath(): string {
    return `${this.getDir()}/configmap.yml`
  }

  getSecretPath(): string {
    return `${this.getDir()}/secret.yml`
  }

  getDeploymentPath(): string {
    return `${this.getDir()}/deployment.yml`
  }

  getServicePath(): string {
    return `${this.getDir()}/service.yml`
  }

  getHPAPath(): string {
    return `${this.getDir()}/hpa.yml`
  }

  getIngressPath(): string {
    return `${this.getDir()}/ingress.yml`
  }

  getAllPaths(): ManifestPath[] {
    return [
      { kind: "ConfigMap", path: this.getConfigMapPath() },
      { kind: "Secret", path: this.getSecretPath() },
      { kind: "Deployment", path: this.getDeploymentPath() },
      { kind: "Service", path: this.getServicePath() },
      { kind: "HPA", path: this.getHPAPath() },
    ]
  }
}
