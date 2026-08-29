---
name: baby-pr-review
description: Review Pull Requests with mandatory strict typecheck & test log execution to eliminate hallucinated fixes and overengineering.
---

# 👶 Baby PR Review ("Just Feed The Baby" - Strict PR Review & Verification)

## Overview
Review pull request untuk mendeteksi overthinking, premature abstraction, bloat complexity, serta **menolak klaim selesai tanpa bukti verifikasi log typecheck & test yang nyata**.

**Prinsip Inti:** *Bayi lapar butuh makanan SEKARANG, bukan nunggu kita bangun restoran McDonald's. Tapi jangan halusinasi bilang makanan sudah siap kalau kompor aja belum nyala. Review PR wajib tarik log CI / jalankan typecheck & unit test lokal sebelum memberi verdict.*

---

## When to Use
- Diminta mereview PR dengan perintah `baby-pr-review`, `baby-review`, "review PR ini anti halu", atau "feed the baby".
- Memeriksa diff branch/PR terhadap `main` untuk memastikan solusi dibuat sesederhana mungkin tanpa abstraksi berlebihan.
- Menolak klaim halusinasi 'fix' tanpa bukti penarikan log typecheck & test yang nyata.

---

## 🛑 4 Hukum Mati Baby PR Review

1. **WAJIB TARIK & TAMPILKAN LOG FAKTUIL (ANTI-HALU FIX)**
   - Dilarang keras menyatakan PR atau fix 'lulus / bersih' hanya dari melihat kode tanpa mengeksekusi pemeriksaan.
   - Pada setiap review PR, **WAJIB jalankan & tampilkan output**:
     - `bunx tsc -p tsconfig.json --noEmit`
     - `bun test <file-terkait.test.ts>`
     - Log status CI / GitHub Actions jika ada.
   - Jika typecheck atau test gagal, kutip error spesifiknya dan blokir approval.
2. **HARAM BIKIN LAYER / ABSTRAKSI BARU**
   - Jika belum ada 3 use-case nyata HARI INI: Dilarang bikin generic factory, custom event bus, plugin engine, dynamic metadata mapper, atau class hierarchy berlebihan.
3. **HARAM NIRU KOMPLEKSITAS KOMPETITOR (BABY UNHAPPY TRAP)**
   - Jika kompetitor butuh flow ribet 5 langkah, itu kelemahan mereka! Sederhanakan jadi 1 langkah instan / default otomatis.
4. **POTONG KOMPAS ITU HALAL, ASAL ADA STRUK HUTANG (DEBT RECEIPT)**
   - Hardcode enum, plain switch-case, synchronous handler, 1 file panjang? HALAL.
   - Wajib tempel: `// DEBT: [apa yang dipotong] | Fix when: [trigger spesifik]`

---

## 📋 Format Output Wajib (Singkat, Brutal & Grounded)

Setiap menjalankan `baby-pr-review`, output WAJIB mengikuti format:

```markdown
# 👶 BABY PR REVIEW: STOP HALU, JUST FEED

### 1. 🔍 BUKTI LOG & VERIFIKASI FAKTUIL (No Halu)
- **Typecheck (`tsc -p tsconfig.json --noEmit`):** [✅ PASSED (0 error) | ❌ FAILED (cantumkan exact log error)]
- **Unit Tests (`bun test <target>`):** [✅ X/X passed | ❌ FAILED (cantumkan failure)]
- **CI / Action Log:** [Status pemeriksaan jika ada]

### 2. 🤮 HALU / OVERENGINEERING TRAP (Buang Ini)
- **Yang Dibikin:** [Abstraksi berlebihan / premature optimization di PR ini]
- **Kenapa Ini Halu:** [Alasan kenapa ini buang-buang waktu & gak ada gunanya sekarang]

### 3. 😊 BABY HAPPY (Solusi Paling Simple)
- **Review Kesederhanaan:** [Bagian yang sudah bagus atau usulan simplifikasi instan]

### 4. 🧾 STRUK HUTANG (Tech Debt Receipt)
```typescript
// DEBT: [Apa yg di-hardcode / disederhanakan] | Fix when: [Trigger metrik/kondisi nyata]
```
```
