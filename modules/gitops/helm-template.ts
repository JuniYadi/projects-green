import * as jsYaml from "js-yaml"

export class HelmChartRenderer {
  renderValues(values: Record<string, unknown>): string {
    return jsYaml.dump(values, { indent: 2, lineWidth: -1, noRefs: true })
  }

  renderChartMetadata(name: string, version = "0.1.0"): string {
    return jsYaml.dump(
      {
        apiVersion: "v2",
        name,
        description: "Generated Helm Chart",
        type: "application",
        version,
        appVersion: "1.0.0",
      },
      { indent: 2, lineWidth: -1, noRefs: true }
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
