import * as jsYaml from "js-yaml"

export class HelmChartRenderer {
  render(chartName: string, values: Record<string, unknown>): string {
    return jsYaml.dump(values)
  }
}

