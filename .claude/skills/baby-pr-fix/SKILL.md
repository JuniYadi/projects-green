---
name: baby-pr-fix
description: "Automated orchestrator to fix PR requested changes, inline review comments, and CI failures with strict zero-halu planning on the same branch until approved."
---

# 👶 Baby PR Fix ("Just Fix & Get Approved" - Zero Halu Orchestrator)

## Overview
Orchestrator otomatis untuk membereskan PR yang terkena **REQUEST_CHANGES**, **Inline Comments / Review Feedback**, atau **CI Failure**.

**Prinsip Inti:** *PR itu tujuannya merge & green, bukan pamer arsitektur baru. Tarik feedback nyata, susun plan konkrit, kerjakan di branch yang sama, buat CI hijau — termasuk codecov patch — dan selesaikan semua blocking comment sampai dapat APPROVE.*

---

## When to Use
- Trigger: `baby fix pr <N>`, `baby-pr-fix`, `fix PR <number>`, atau minta beresin review comments & CI gagal di PR.

---

## 🛑 4 Hukum Mati Baby PR Fix

1. **NO HALU (PULL REAL DATA FIRST)**
   - Dilarang mengira-ngira / berasumsi isi review atau penyebab CI fail.
   - Wajib tarik log terbaru via `pr://<N>`, GitHub tool / `gh pr view`, `gh run view --log-failed`, atau comments list.
   - Baca exact inline comment, line number, requested changes, dan log failure dari CI job.

2. **NO PLAN = NO FIX**
   - Sebelum menyentuh satu baris kode pun, WAJIB buat execution plan yang jelas:
     - Root cause per issue / comment
     - Target files & exact diff intention
     - Local validation command yang akan dijalankan
   - Tidak boleh fix "sambil jalan" tanpa roadmap.

3. **STAY ON SAME BRANCH & PR (HARAM BIKIN BRANCH / PR BARU)**
   - Semua perbaikan wajib di-checkout dan dikomit pada branch PR yang bersangkutan (`gh pr checkout <N>` / branch asli).
   - Jangan pernah bikin branch cabang baru, PR baru, atau rebase destruktif yang bikin reviewer bingung.

4. **GOAL: CI PASS + CODECOV PATCH ≥ TARGET + APPROVAL**
   - Fokus utama: fix build, lint, typecheck, unit test, **dan** codecov patch coverage.
   - **Codecov WAJIB difix**, bukan diabaikan. `codecov/patch/changed` failure = blocking.
   - Resolve setiap permintaan reviewer point-by-point hingga PR siap di-approve.

---

## 🔄 Execution Workflow

### Step 1: Ingest & Audit (No Halu)
1. Checkout branch PR:
   `gh pr checkout <N>`
2. Tarik review status & comments:
   - Baca PR overview & requested changes via `pr://<N>` atau `gh pr view <N> --json reviews,comments,reviewRequests`
   - Tarik inline comments: `gh api repos/{owner}/{repo}/pulls/<N>/comments`
3. Tarik CI failure logs:
   - `gh run list --branch <branch-name>`
   - `gh run view <run-id> --log-failed`
4. **Tarik codecov report** dari PR comment:
   - Cek `codecov/patch/changed` status di `statusCheckRollup`
   - Baca comment Codecov di PR untuk tahu file mana yang patch coverage-nya kurang dan berapa lines missing

### Step 2: Formulate Action Plan (No Plan = No Fix)
Outputkan plan ringkas ke user sebelum eksekusi:
```markdown
# 👶 BABY PR FIX PLAN: PR #<N>

### 1. 🔍 Review Feedback & CI Summary
- **Requested Changes / Comments:** [List per reviewer & file/line]
- **CI Failures:** [Exact failed step & error message]
- **Codecov:** patch X% (target Y%) — missing lines in [file list]

### 2. 🛠️ Action Items
- [ ] Item 1: [File] -> [Fix detail]
- [ ] Item 2: [File] -> [Fix detail]
- [ ] Coverage: [service/file].ts -> add service-level test (mock prisma + deps)

### 3. 🧪 Verification Target
- Local tests: `bun test <file>`
- Lint/Typecheck: `bun run scripts/typecheck-changed.ts`
- Coverage estimate: count changed lines vs. new test lines
```

### Step 3: Implement & Validate (KISS / Minimal Touch)
- Terapkan fix seminimal mungkin sesuai feedback (Keep It Simple, Stupid).
- Jangan refactor kode di luar scope comment/CI fail.
- Jalankan targeted local checks:
  `bun test <target.test.ts>`
  `bun run scripts/typecheck-changed.ts`

### Step 4: Fix Codecov Patch Coverage
Codecov `patch/changed` mengukur coverage dari **baris yang diubah** di PR ini saja (bukan project secara keseluruhan). Target biasanya 90%.

**Strategi wajib:**
1. **Identifikasi file dengan patch coverage rendah** dari Codecov comment (kolom "Patch %").
2. **Prioritaskan service files** (`*.service.ts`) karena biasanya yang paling banyak baris tanpa coverage.
3. **Buat paired service test** (`*.service.test.ts`) dengan pola:
   - `mock.module()` **sebelum** `await import()` (Bun test requirement)
   - Mock semua leaf dependencies: `prisma`, external API clients, third-party services
   - Jangan mock business logic — test justru untuk business logic itu
   - Cover: happy path, NOT_FOUND / error path, setiap branch condition penting
4. **Hitung estimasi coverage**: jumlah baris di file / baris yang tercover test ≥ 90%
5. **Untuk route files**: route test sudah ada tapi mungkin belum cover error 500 — tambahkan.
6. **UI/page-client files** tidak perlu dicover di service test — fokus ke logic files.

**Template mock pattern (Bun):**
```ts
// Mock modules FIRST before any import
const mockPrisma = {
  applicationStack: {
    findUnique: mock(() => Promise.resolve(mockRecord)),
    update: mock(() => Promise.resolve(mockRecord)),
    delete: mock(() => Promise.resolve(mockRecord)),
    count: mock(() => Promise.resolve(1)),
    findMany: mock(() => Promise.resolve([mockRecord])),
  },
  $transaction: mock((fn) => fn(mockPrisma)),
}

mock.module("server-only", () => ({}))
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("@/lib/workos-directory", () => ({
  getCachedOrganizations: mock(async (ids) => new Map(ids.map(id => [id, { id, name: "Acme Corp" }])))
}))
// ... other deps

const { myService } = await import("./my.service")

describe("myService", () => {
  beforeEach(() => {
    mockPrisma.applicationStack.findUnique.mockClear()
    mockPrisma.applicationStack.findUnique.mockResolvedValue(mockRecord)
    // reset all mocks to defaults
  })

  it("happy path", async () => { ... })
  it("throws NOT_FOUND when record missing", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValueOnce(null)
    await expect(myService("id")).rejects.toThrow("NOT_FOUND")
  })
})
```

### Step 5: Commit & Push to Same Branch
- Commit dengan pesan deskriptif mengacu pada feedback/fix:
  `git commit -m "fix(pr-<N>): address review feedback, bump codecov patch coverage"`
- Push langsung ke branch PR:
  `HUSKY=0 git push origin HEAD` (gunakan HUSKY=0 jika pre-push hook gagal karena pre-existing test failures)

### Step 6: Verify CI Status
- Pantau status run baru:
  `gh pr checks` atau `gh run watch`
- Pastikan `codecov/patch/changed` ✅ hijau.
- Semua blocking checks pass.

---

## 📊 Codecov Cheat Sheet

| Situasi | Tindakan |
|---------|----------|
| `codecov/patch/changed` FAIL | Tambah service test untuk file dengan patch% rendah |
| Service file 2-5% patch | Buat `*.service.test.ts` baru, mock semua deps, cover semua exported functions |
| Route file 80-85% patch | Tambah test untuk error paths (500, partial failure) yang belum dicover |
| UI/page-client file 0% | Skip — UI tidak perlu dicover di unit test |
| `codecov/project` FAIL | Coverage project turun drastis — butuh lebih banyak test atau ada regresi |
| `codecov/project` PASS | Project coverage aman, fokus ke patch saja |

> **Catatan penting:** `HUSKY=0 git push` dipakai kalau ada pre-existing test failures yang tidak berkaitan dengan PR (misal: DB tidak jalan di lokal, server tidak jalan di port tertentu). Ini bukan jalan pintas — CI tetap yang jadi gate utama.
