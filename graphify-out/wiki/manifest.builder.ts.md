# manifest.builder.ts

> 13 nodes · cohesion 0.29

## Key Concepts

- **manifest.builder.ts** (16 connections) — `modules/gitops/builders/manifest.builder.ts`
- **gitops.types.ts** (8 connections) — `modules/gitops/gitops.types.ts`
- **KubernetesResource** (6 connections) — `modules/gitops/gitops.types.ts`
- **YamlManifestGenerator** (6 connections) — `modules/gitops/yaml-manifest.service.ts`
- **AppManifest** (5 connections) — `modules/gitops/gitops.types.ts`
- **yaml-manifest.service.ts** (5 connections) — `modules/gitops/yaml-manifest.service.ts`
- **.generateAllManifests()** (5 connections) — `modules/gitops/yaml-manifest.service.ts`
- **.generateDeploymentYaml()** (3 connections) — `modules/gitops/yaml-manifest.service.ts`
- **.generateIngressYaml()** (3 connections) — `modules/gitops/yaml-manifest.service.ts`
- **.generateServiceYaml()** (3 connections) — `modules/gitops/yaml-manifest.service.ts`
- **HelmChart** (1 connections) — `modules/gitops/gitops.types.ts`
- **AppDescriptor** (1 connections) — `modules/gitops/yaml-manifest.service.ts`
- **.generateHelmChartYaml()** (1 connections) — `modules/gitops/yaml-manifest.service.ts`

## Relationships

- [builders/index.ts](builders-index.ts.md) (5 shared connections)
- [SecretBuilder](SecretBuilder.md) (5 shared connections)
- [ConfigMapBuilder](ConfigMapBuilder.md) (2 shared connections)
- [HpaBuilder](HpaBuilder.md) (2 shared connections)
- [AppManifestBuilder](AppManifestBuilder.md) (2 shared connections)
- [DeploymentBuilder](DeploymentBuilder.md) (1 shared connections)

## Source Files

- `modules/gitops/builders/manifest.builder.ts`
- `modules/gitops/gitops.types.ts`
- `modules/gitops/yaml-manifest.service.ts`

## Audit Trail

- EXTRACTED: 63 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*