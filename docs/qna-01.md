# task: app-operations-dashboard

## Context
The existing `operate` surface needed to become an MVP operations console for
deployed apps, with no backend integration yet. The requested scope is a
question-driven UX: users must be able to answer 14 operational questions
directly from one page (`/console/app/deploy/operate`) using realistic dummy
data that can be swapped with API responses later.

## Goal
Ship an MVP app-operations page that answers all 14 questions with interactive
controls, plus a tracker that maps each question to implementation status.

## Scope of work
1. `[x]` Q1 App management hub:
   - Add operations tabs and environment switcher.
   - Add app status summary and lifecycle controls.
2. `[x]` Q2 Custom domain + DNS:
   - Add custom domain input and domain list.
   - Add DNS setup table for A/CNAME records.
3. `[x]` Q3 Add environment variables:
   - Add create/delete env variable controls with secret masking.
   - Add bulk `.env` import simulator.
4. `[x]` Q4 Mount private key:
   - Add secure mount form with path/content/mode fields.
   - Add forbidden-path guardrails and read-only guidance.
5. `[x]` Q5 Rebuild after repository update:
   - Add `Rebuild & Deploy` simulation with staged build logs.
6. `[x]` Q6 App status/inaccessibility diagnosis:
   - Add diagnostics simulation modes and remediation notes.
7. `[x]` Q7 Slow app + metrics visibility:
   - Add telemetry cards (CPU, RAM, network) and recommendations.
8. `[x]` Q8 Expired SSL:
   - Add certificate status indicators and renewal action surface.
9. `[x]` Q9 Cloudflare SSL cannot activate:
   - Add Cloudflare proxy guidance (`DNS only` for validation).
10. `[x]` Q10 Cloudflare redirect loop:
    - Add SSL mode guidance (`Flexible` vs `Full/Strict`).
11. `[x]` Q11 Proxy shows local IP:
    - Add trust-proxy toggle and header forwarding explanation.
12. `[x]` Q12 Custom resource sizing:
    - Add CPU/RAM request-limit controls for runtime tuning.
13. `[x]` Q13 Replicas/HPA/VPA configuration:
    - Add manual replicas control and HPA/VPA settings.
14. `[x]` Q14 App logs (Opensearch):
    - Add searchable/filterable simulated log viewer with live tail.

## Validation
- Run targeted test: `bun run test 'app/[lang]/console/app/deploy/operate/page.test.tsx'`
- Ensure the FAQ/Troubleshooter renders and contains all 14 questions.
- Ensure each question has a corresponding interactive surface on the page
  (tab section, control, or diagnostics panel).

## Acceptance criteria
1. `/console/app/deploy/operate` renders an operations-focused MVP page with
   tabbed management surfaces and mock state.
2. All 14 user questions are explicitly present in the Troubleshooter and
   mapped to usable controls.
3. User actions update local UI state (for example env vars, domains, mounts,
   scaling values, rebuild simulation, log filtering).
4. No migration, database, or backend API integration is introduced.
5. Dummy data is realistic and structured to be replaceable by API responses.

## Constraints
- Use `bun` for commands.
- Keep this as frontend-only MVP and avoid migrations/new APIs.
- Preserve TypeScript compatibility and existing project structure.
- Keep implementation and tracking in-repo (`docs` + page/test files).

## Deliverables
- Tracker and breakdown document: `/docs/qna-01.md`
- MVP operations page: `/app/[lang]/console/app/deploy/operate/page.tsx`
- Page tests: `/app/[lang]/console/app/deploy/operate/page.test.tsx`
