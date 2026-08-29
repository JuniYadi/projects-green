---
name: baby-pr-fix
description: "Automated orchestrator to fix PR requested changes, inline review comments, and CI failures with strict zero-halu planning on the same branch until approved."
---

# 👶 Baby PR Fix ("Just Fix & Get Approved" - Zero Halu Orchestrator)

## Overview
Orchestrator otomatis untuk membereskan PR yang terkena **REQUEST_CHANGES**, **Inline Comments / Review Feedback**, atau **CI Failure**.

**Prinsip Inti:** *PR itu tujuannya merge & green, bukan pamer arsitektur baru. Tarik feedback nyata, susun plan konkrit, kerjakan di branch yang sama, buat CI hijau, dan selesaikan semua blocking comment sampai dapat APPROVE.*

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

4. **GOAL: CI PASS & APPROVAL (IGNORE CODECOV)**
   - Fokus utama: fix build, lint, typecheck, dan unit test yang fail.
   - Abaikan flakiness Codecov jika checks utama sudah hijau.
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

### Step 2: Formulate Action Plan (No Plan = No Fix)
Outputkan plan ringkas ke user sebelum eksekusi:
```markdown
# 👶 BABY PR FIX PLAN: PR #<N>

### 1. 🔍 Review Feedback & CI Summary
- **Requested Changes / Comments:** [List per reviewer & file/line]
- **CI Failures:** [Exact failed step & error message]

### 2. 🛠️ Action Items
- [ ] Item 1: [File] -> [Fix detail]
- [ ] Item 2: [File] -> [Fix detail]

### 3. 🧪 Verification Target
- Local tests: `bun test <file>`
- Lint/Typecheck: `bun run lint -- <files>`
```

### Step 3: Implement & Validate (KISS / Minimal Touch)
- Terapkan fix seminimal mungkin sesuai feedback (Keep It Simple, Stupid).
- Jangan refactor kode di luar scope comment/CI fail.
- Jalankan targeted local checks:
  `bun test <target.test.ts>`
  `bun run lint -- <target-files>`

### Step 4: Commit & Push to Same Branch
- Commit dengan pesan deskriptif mengacu pada feedback/fix:
  `git commit -m "fix(pr-<N>): address review feedback and ci failures"`
- Push langsung ke branch PR:
  `git push origin HEAD`

### Step 5: Verify CI Status
- Pantau status run baru:
  `gh run watch` atau `gh pr checks`
- Pastikan semua blocking checks pass.
