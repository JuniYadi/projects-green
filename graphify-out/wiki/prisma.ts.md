# prisma.ts

> 111 nodes · cohesion 0.04

## Key Concepts

- **prisma.ts** (179 connections) — `lib/prisma.ts`
- **cluster-integration.service.ts** (37 connections) — `modules/deploy/cluster-integration.service.ts`
- **deploy.route.ts** (26 connections) — `modules/deploy/api/deploy.route.ts`
- **deploy-submit.route.ts** (25 connections) — `modules/deploy/api/routes/deploy-submit.route.ts`
- **deploy-builder.service.ts** (18 connections) — `modules/deploy/deploy-builder.service.ts`
- **deploy-trigger.route.ts** (17 connections) — `modules/deploy/api/routes/deploy-trigger.route.ts`
- **deploy-monitor.service.ts** (15 connections) — `modules/deploy/deploy-monitor.service.ts`
- **jenkins-image-ready.service.ts** (15 connections) — `modules/deploy/jenkins-image-ready.service.ts`
- **deploy-event.service.ts** (14 connections) — `modules/deploy/deploy-event.service.ts`
- **deploy-pipeline.service.ts** (13 connections) — `modules/deploy/deploy-pipeline.service.ts`
- **pod-status.service.ts** (13 connections) — `modules/deploy/pod-status.service.ts`
- **resolveClusterIntegration()** (12 connections) — `modules/deploy/cluster-integration.service.ts`
- **argocd-rollout.service.ts** (10 connections) — `modules/deploy/argocd-rollout.service.ts`
- **github-push-dispatcher.ts** (10 connections) — `modules/github/github-push-dispatcher.ts`
- **deploy-pipeline.route.ts** (8 connections) — `modules/deploy/api/routes/deploy-pipeline.route.ts`
- **recordDeployEventOnce()** (8 connections) — `modules/deploy/deploy-event.service.ts`
- **jenkins-image-ready.route.ts** (7 connections) — `modules/deploy/api/routes/jenkins-image-ready.route.ts`
- **buildTypedConfig()** (7 connections) — `modules/deploy/cluster-integration.service.ts`
- **handleJenkinsImageReady()** (7 connections) — `modules/deploy/jenkins-image-ready.service.ts`
- **routes/jenkins-webhook.route.ts** (6 connections) — `modules/deploy/api/routes/jenkins-webhook.route.ts`
- **readString()** (6 connections) — `modules/deploy/cluster-integration.service.ts`
- **monitorActiveDeployments()** (6 connections) — `modules/deploy/deploy-monitor.service.ts`
- **helm-values.builder.ts** (6 connections) — `modules/deploy/helm-values.builder.ts`
- **github-push-dispatcher.test.ts** (6 connections) — `modules/github/__tests__/github-push-dispatcher.test.ts`
- **pod-status.route.ts** (5 connections) — `modules/deploy/api/routes/pod-status.route.ts`
- *... and 86 more nodes in this community*

## Relationships

- [app-credential.service.ts](app-credential.service.ts.md) (12 shared connections)
- [getPlatformRoleForUser](getPlatformRoleForUser.md) (10 shared connections)
- [fieldErrorMapFromIssues](fieldErrorMapFromIssues.md) (10 shared connections)
- [deploy-monitor.dto.ts](deploy-monitor.dto.ts.md) (9 shared connections)
- [tenant-workos.service.ts](tenant-workos.service.ts.md) (9 shared connections)
- [AppHostingBillingService](AppHostingBillingService.md) (8 shared connections)
- [jenkins.route.ts](jenkins.route.ts.md) (7 shared connections)
- [payment/api/topup.route.ts](payment-api-topup.route.ts.md) (7 shared connections)
- [BillingTransactionService](BillingTransactionService.md) (7 shared connections)
- [webhooks.service.ts](webhooks.service.ts.md) (7 shared connections)
- [workers.ts](workers.ts.md) (6 shared connections)
- [billing/api/index.ts](billing-api-index.ts.md) (6 shared connections)

## Source Files

- `lib/prisma.ts`
- `modules/deploy/api/deploy.route.ts`
- `modules/deploy/api/routes/app-stacks.route.ts`
- `modules/deploy/api/routes/deploy-pipeline.route.ts`
- `modules/deploy/api/routes/deploy-submit.route.ts`
- `modules/deploy/api/routes/deploy-trigger.route.ts`
- `modules/deploy/api/routes/environment-variables.route.ts`
- `modules/deploy/api/routes/jenkins-image-ready.route.ts`
- `modules/deploy/api/routes/jenkins-webhook.route.ts`
- `modules/deploy/api/routes/monitoring.route.ts`
- `modules/deploy/api/routes/pod-status.route.ts`
- `modules/deploy/api/routes/public-source.route.ts`
- `modules/deploy/argocd-rollout.service.ts`
- `modules/deploy/cluster-integration.service.ts`
- `modules/deploy/deploy-builder.service.ts`
- `modules/deploy/deploy-event.service.ts`
- `modules/deploy/deploy-monitor.service.ts`
- `modules/deploy/deploy-pipeline.service.ts`
- `modules/deploy/deploy-rollback.service.ts`
- `modules/deploy/helm-values.builder.test.ts`

## Audit Trail

- EXTRACTED: 660 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*