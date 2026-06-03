export interface EnvVar {
  name: string
  value?: string
  valueFrom?: {
    configMapKeyRef?: { name: string; key: string; optional?: boolean }
    secretKeyRef?: { name: string; key: string; optional?: boolean }
  }
}

export interface EnvFromSource {
  configMapRef?: { name: string; items?: Array<{ key: string; optional?: boolean }> }
  secretRef?: { name: string; items?: Array<{ key: string; optional?: boolean }> }
}

export class EnvBuilder {
  private envVars: EnvVar[] = []
  private envFromSources: EnvFromSource[] = []

  addVar(name: string, value: string): this {
    this.envVars.push({ name, value })
    return this
  }

  addFromConfigMap(
    configMapName: string,
    items: Array<{ key: string; optional?: boolean }>
  ): this {
    this.envFromSources.push({
      configMapRef: {
        name: configMapName,
        items: items.map((item) => ({ key: item.key, optional: item.optional })),
      },
    })
    return this
  }

  addFromSecret(
    secretName: string,
    items: Array<{ key: string; optional?: boolean }>
  ): this {
    this.envFromSources.push({
      secretRef: {
        name: secretName,
        items: items.map((item) => ({ key: item.key, optional: item.optional })),
      },
    })
    return this
  }

  build(): EnvVar[] {
    return this.envVars
  }

  buildEnvFrom(): EnvFromSource[] {
    return this.envFromSources
  }
}