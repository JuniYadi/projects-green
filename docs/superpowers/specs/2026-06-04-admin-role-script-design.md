# Admin Role Script Design

## Context
The repository currently has multiple overlapping scripts for platform super-admin management:
- `scripts/grant-super-admin.mjs`
- `scripts/seed-super-admin.ts`
- `scripts/bootstrap-super-admin.ts`

The current manual flow is confusing, and the existing `grant` flow is reported as not working reliably. The desired outcome is one canonical Bun-based script for manual platform super-admin management.

This work is limited to platform role management through CLI scripts. It does not include UI admin management, API changes, or broader role-system redesign.

## Goal
Replace the current scattered manual super-admin scripts with one canonical script that can list, add, and delete platform super admins using either email or WorkOS user ID.

## Chosen approach
Use a single canonical Bun script with action flags:
- `--list`
- `--add`
- `--delete`

This is preferred over compatibility wrappers or a generic role manager because it matches the requested UX, keeps scope tight, and removes overlap.

## CLI contract
### Command
- `bun run admin:role --list`
- `bun run admin:role --add --email <email>`
- `bun run admin:role --add --workos-user-id <id>`
- `bun run admin:role --delete --email <email>`
- `bun run admin:role --delete --workos-user-id <id>`

### Rules
- Exactly one action flag is required: `--list`, `--add`, or `--delete`
- `--add` and `--delete` require exactly one identifier:
  - `--email`
  - or `--workos-user-id`
- `--add` auto-creates the `platformUserRole` row if no matching record exists
- `--delete` removes the matching `platformUserRole` row entirely
- This script only manages the `SUPER_ADMIN` role

### Output behavior
- Human-readable success and error messages
- Non-zero exit code for invalid input or runtime failure
- `--list` prints current super admins in a readable table-like format

## Data behavior
The script will operate directly on `prisma.platformUserRole` and use generated Prisma types from `@prisma/client` only.

### `--list`
- Query all rows where `role = SUPER_ADMIN`
- Print key fields for each row:
  - `id`
  - `email`
  - `workosUserId`
  - `createdAt` if present on the model
- If no records exist, print `No super admins found.`

### `--add`
- Normalize identifier input before lookup:
  - `email` => trim + lowercase
  - `workosUserId` => trim
- Lookup by the provided identifier
- If a matching record exists and is already `SUPER_ADMIN`, print an idempotent success message
- If a matching record exists but role differs, update it to `SUPER_ADMIN`
- If no matching record exists, create a new `platformUserRole` row with the provided identifier and `role = SUPER_ADMIN`

### `--delete`
- Normalize identifier input before lookup
- Lookup by the provided identifier
- If no matching row exists, print a clear not-found message and exit with a non-zero status so the command behaves predictably in automation
- If a matching row exists, delete that exact row

## Validation and safety
Reject the following invalid combinations:
- multiple action flags
- no action flag
- both identifiers at once
- no identifier for `--add` or `--delete`
- empty values after normalization

The script should fail fast with a clear usage message when arguments are invalid.

## Repository changes
### New file
- `scripts/admin-role.ts`

### Package command
Add one canonical package script:
- `admin:role`

### Replacement policy
Make `admin:role` the only supported manual platform super-admin management command.

Remove overlapping manual commands and their scripts from normal use:
- `grant:super-admin`
- `seed:super-admin`
- `scripts/grant-super-admin.mjs`
- `scripts/seed-super-admin.ts`

### Bootstrap script decision
`bootstrap-super-admin.ts` should only remain if it serves a distinct environment/bootstrap purpose, such as first-run provisioning from env vars. If it only overlaps with manual role management, remove it as well.

## Implementation notes
To keep the script testable and simple, separate logic into small units inside the script or a nearby helper module:
- argument parsing
- input normalization
- action dispatch
- prisma operations
- output formatting

This allows focused tests without relying entirely on shell-level process execution.

## Testing strategy
Add focused tests for parsing and behavior:
- `--list` with no records
- `--list` with existing records
- `--add --email`
- `--add --workos-user-id`
- `--add` when record already exists as super admin
- `--add` when record exists but needs promotion
- `--delete` when record exists
- `--delete` when record does not exist
- invalid flag combinations
- normalization of email and WorkOS user ID

Follow existing Bun mocking rules by mocking infrastructure only and avoiding cross-file pollution.

## Manual verification
After implementation:
- `bun run admin:role --list`
- `bun run admin:role --add --email pfnjyadi@gmail.com`
- `bun run admin:role --list`
- `bun run admin:role --delete --email pfnjyadi@gmail.com` if cleanup is needed

## Success criteria
- One canonical script handles list/add/delete
- Script supports both `--email` and `--workos-user-id`
- `--add` auto-creates missing records
- `--delete` removes the row entirely
- Script uses Prisma generated types only
- Bun command works consistently
- Old overlapping manual scripts are removed or no longer exposed
- Error messages are clear and actionable
- The target user can be promoted to `SUPER_ADMIN` successfully

## Out of scope
- In-app admin management UI
- API endpoints for platform role management
- Generalized multi-role platform administration
- Changes to tenant/org role behavior
