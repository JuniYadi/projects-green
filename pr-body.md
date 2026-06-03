# feat: App Hosting - Env/Secret Update into Helm Chart (PGREEN-041)

## Summary

Implements env/secret management for containers in the app hosting feature - generating ConfigMaps, Secrets, env vars, volume mounts, and auto-reload support for Kubernetes manifests.

## Changes

### New Kubernetes Resource Builders

Created `modules/gitops/builders/` with composable TypeScript builders:

- **ConfigMapBuilder** (`configmap.builder.ts`) - Generates K8s ConfigMap with data, binary data, labels, and annotations
- **SecretBuilder** (`secret.builder.ts`) - Generates K8s Secret with base64 encoding, TLS secret support, and reloader annotations
- **EnvBuilder** (`env.builder.ts`) - Implements HasEnv, HasEnvFromSecret, HasEnvFromConfigMap traits for env var composition
- **VolumeBuilder** / **VolumeMountBuilder** (`volume.builder.ts`) - Generates ConfigMap, Secret, PVC volumes and mount configurations
- **HPABuilder** (`hpa.builder.ts`) - Generates Horizontal Pod Autoscaler with CPU/memory metrics
- **DeploymentBuilder** (`deployment.builder.ts`) - Full deployment spec builder with envFrom, volumeMounts, and reloader annotation support
- **AppManifestBuilder** (`manifest.builder.ts`) - Orchestrates full manifest generation with all resource types
- **ManifestPathResolver** (`path-resolver.ts`) - Generates per-container manifest paths in `services-yaml/{tenant}/{stack}/{container}/`

### Key Features

- **ConfigMap Generation** - Creates K8s ConfigMap per container with data and binary data support
- **Secret Generation** - Base64 encoding for regular secrets, TLS secrets with cert/key structure
- **Env Vars** - Fluent API for HasEnv, HasEnvFromSecret, HasEnvFromConfigMap patterns
- **Volume Mounts** - ConfigMap volumes, Secret volumes, PVC volumes with mount paths
- **Reloader Integration** - `reloader.stakater.com/auto` annotation for auto-restart on ConfigMap/Secret changes
- **HPA Support** - Auto-generates HPA manifest with CPU/memory target metrics

## Test Evidence

```
bun test modules/gitops/builders/
32 pass, 0 fail
```

## Files Changed

```
modules/gitops/builders/*.ts (8 new files)
modules/gitops/builders/*.test.ts (8 new files)
```

## Linked Task

PGREEN-041: App Hosting - Env/Secret Update into Helm Chart
