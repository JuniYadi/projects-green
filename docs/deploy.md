# Kubernetes App Lifecycle Dummy UX Specification

## Objective

Implement a dummy Kubernetes lifecycle workspace at `/console/app/deploy` that
covers day-0 deployment and day-1/day-2 operations with local state only.

The UX is App Developer focused and models `dev -> staging -> prod` with
GitOps-style change flow.

## UX Architecture

The page is organized into three lifecycle views:

1. **Deploy**: existing source/build/environment/monitor wizard.
2. **Operate**: post-deploy runtime controls.
3. **Observe**: post-deploy telemetry and rollout visibility.

Route remains unchanged: `/console/app/deploy`.

## Data Contracts

Lifecycle state extends deploy module internals with:

- Environment topology: `dev`, `staging`, `prod`
- Deployment inventory per environment
- Config resources (`configmap`, `secret`)
- Volume mount mappings
- Resource tuning profiles (CPU/memory requests and limits, replicas)
- Rollout history entries
- Staged GitOps changes with statuses (`draft`, `committed`, `applied`)
- Environment sync status (`synced`, `drifted`, `reconciling`)
- Resource usage and pod health snapshots

No backend, API, or Prisma contracts are changed.

## Interaction Flows

### Deploy (Day-0)

1. Select source repository and branch.
2. Confirm build strategy.
3. Configure domain/env/resource plan.
4. Start deploy and monitor initial rollout.

### Operate (Day-1)

1. Select environment and deployment target.
2. Inspect ConfigMap/Secret inventory and volume mounts.
3. Tune resources:
   - CPU request/limit (`m`)
   - Memory request/limit (`Mi`)
   - Replica count
4. Stage changes with summary.
5. Create commit (simulated Git commit boundary).
6. Apply commit and reconcile environment state.
7. Promote to next environment or rollback from rollout history.

### Observe (Day-2)

1. Select environment and deployment.
2. Monitor CPU/memory usage against limits.
3. Review pod health (ready vs total, restarts).
4. Filter rollout events and inspect deployment timeline outcomes.
5. Check environment drift/reconcile status across dev/staging/prod.

## Validation States

Validation rules include:

- Staged changes require at least one non-empty summary entry.
- Resource requests and limits require strict format:
  - CPU: `<number>m`
  - Memory: `<number>Mi`
- Resource request must not exceed limit.
- Replicas must be positive integer.
- Rollback target must belong to selected deployment.
- Promotion allowed only when a next environment exists.

## Test Matrix

### Unit

- `validateResourceConfig`
- `validateStagedChanges`
- promotion guard (`dev -> staging -> prod`)
- rollback target validation
- lifecycle transition helpers:
  - stage
  - commit
  - apply
  - promote
  - rollback

### Component

- `StepOperate`:
  - deployment inventory and config/volume surfaces render
  - stage/commit/apply/promote/reconcile controls fire handlers
- `StepObserve`:
  - resource/pod/rollout views render
  - timeline filter states update

### Integration

- `DeployWizard`:
  - lifecycle tab switching works (`Deploy`, `Operate`, `Observe`)
  - staged change lifecycle transitions `draft -> committed -> applied`
  - observe view telemetry and event filter behavior

## Out of Scope

- Real Kubernetes API integration
- Persistent configuration storage
- Incident management workflows
- Cost optimization and compliance governance surfaces
