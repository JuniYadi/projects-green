# Tenant Navigation and Admin Surface Rollout

## Scope
- Removed tenant management UI from `app/portal/documentations` to keep documentation routes focused on docs registry workflows.
- Preserved documentation module scope by keeping `DocumentationForm` in portal docs and adding a clear handoff link to tenant admin in console.
- Clarified sidebar and console entry points:
  - `Console -> Tenant Management` (`/console/organization`)
  - `Documentation -> Registry` (`/portal/documentations`)

## Required Verification Commands
Run all commands from repo root with Bun:

```bash
bun run test
bun run lint
bun run typecheck
```

## QA Checklist

### Owner Persona
- Sign in as tenant owner and open `/console/organization`.
- Confirm member actions appear: promote to admin, promote to owner, demote, transfer ownership, remove member.
- Confirm destructive prompts appear and block action when cancelled:
  - transfer ownership
  - remove member
  - revoke invitation
  - delete organization
- Confirm success feedback banners/messages render after successful actions.
- Confirm `/portal/documentations` shows docs form and links to console tenant admin.

### Admin Persona
- Sign in as tenant admin and open `/console/organization`.
- Confirm owner-only actions are hidden or blocked:
  - transfer ownership
  - promote to owner
  - delete organization
- Confirm allowed admin actions still work with visible success feedback:
  - invite member
  - promote member to admin
  - demote admin

### Member Persona
- Sign in as tenant member and open `/console/organization`.
- Confirm management actions are unavailable.
- Confirm permission messaging is shown in members/invitations views.
- Confirm invitation controls are disabled and no destructive actions are exposed.

## Regression Focus
- Sidebar labels and links route correctly for docs vs tenant admin.
- Portal docs route remains docs-only and no longer renders tenant role/state controls.
- API authorization/action responses still align with tenant policy matrix.
