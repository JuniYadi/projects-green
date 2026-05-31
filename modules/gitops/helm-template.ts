import type { AppManifest, KubernetesResource } from "./gitops.types"
import * as jsYaml from "js-yaml"

export class HelmChartRenderer {
  render(chartName: string, values: any): string {
    return jsYaml.dump(values)
  }
}

