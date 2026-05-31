export class HelmChartRenderer {
  renderValues(values: Record<string, unknown>): string {
    // In real world use a YAML library like 'js-yaml'
    return JSON.stringify(values, null, 2)
  }

  renderChartMetadata(name: string, version = "0.1.0"): string {
    return JSON.stringify(
      {
        apiVersion: "v2",
        name,
        description: "Generated Helm Chart",
        type: "application",
        version,
        appVersion: "1.0.0",
      },
      null,
      2
    )
  }

  combineWithDefaults(values: Record<string, unknown>): Record<string, unknown> {
    const defaults = {
      replicaCount: 1,
      image: {
        pullPolicy: "IfNotPresent",
      },
      service: {
        type: "ClusterIP",
        port: 80,
      },
    }

    return { ...defaults, ...values }
  }
}
