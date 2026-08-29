---
name: baby-review
description: Review code/PR for overthinking and premature complexity with mandatory strict typecheck & test log verification.
---

# 👶 Baby Review ("Just Feed The Baby" - Strict Anti-Halu & Grounded Verification)

## Overview
Review brutal anti-overthinking, anti-halusinasi arsitektur, dan **anti-klaim tanpa verifikasi faktual**.

**Prinsip Inti:** *Bayi lapar butuh pisang/ASI SEKARANG, bukan nunggu kita bangun restoran McDonald's lengkap dengan franchise & drive-thru. Tapi sebelum bilang pisang sudah matang, WAJIB CEK FAKTA — jangan bilang udah fix kalau typecheck & test belum dijalankan dan lulus.*

---

## When to Use
- Merasa terjebak overthinking, arsitektur kebanyakan layer, atau PR kelamaan kelar.
- Mau niru fitur kompetitor yang ribet padahal user cuma butuh esensinya.
- Review PR / diff untuk menyederhanakan kode ('baby-pr-review').
- User panggil `baby-review`, `baby-pr-review`, "feed the baby", "anti halu", atau minta sanity check kesederhanaan solusi.

---

## 🛑 4 Hukum Mati Baby Review

1. **HARAM BIKIN LAYER / ABSTRAKSI BARU**
   - Kalau belum ada 3 use-case nyata HARI INI: Dilarang bikin generic factory, custom event bus, plugin engine, dynamic metadata mapper, atau class hierarchy. Pakai plain function / basic SQL.
2. **HARAM NIRU KOMPLEKSITAS KOMPETITOR (BABY UNHAPPY TRAP)**
   - Kalau kompetitor butuh wizard 5 langkah atau 10 setting dropdown, itu kelemahan mereka! Bikin solusinya 1 klik atau otomatis. Bikin baby happy dengan kesederhanaan, bukan adu banyak fitur.
3. **POTONG KOMPAS ITU HALAL, ASAL ADA STRUK HUTANG (DEBT RECEIPT)**
   - Hardcode enum, plain switch-case, synchronous handler, 1 file panjang? HALAL.
   - Wajib tempel: `// DEBT: [apa yang dipotong] | Fix when: [trigger spesifik]`
4. **HARAM KLAIM SELESAI TANPA BUKTI TYPECHECK & TEST (ANTI-HALU FIX)**
   - Dilarang berasumsi kode sudah benar hanya dari membaca diff.
   - Pada setiap review PR atau perbaikan kode, **WAJIB jalankan target verification**:
     - `bunx tsc -p tsconfig.json --noEmit` (atau typecheck spesifik file terkait).
     - `bun test <file.test.ts>` pada seluruh file tes yang bersentuhan.
   - Jika ada error / warning, laporkan fakta apa adanya — jangan disembunyikan atau di-halu 'sudah fix'.

---

## 📋 Format Output Wajib (Singkat & Brutal)

Setiap menjalankan `baby-review` atau `baby-pr-review`, review WAJIB mengikuti format berikut:

```markdown
# 👶 BABY REVIEW: STOP HALU, JUST FEED

### 1. 🤮 HALU / KOMPETITOR TRAP (Buang Ini)
- **Yang Lagi Dipikirin/Dibikin:** [Sebutkan abstraction, premature scaling, atau flow kompetitor yang bikin ribet]
- **Kenapa Ini Halu:** [Alasan kenapa ini buang-buang waktu & gak ada gunanya sekarang]

### 2. 😊 BABY HAPPY (Simple & Beda)
- **Kompetitor Bikin:** [Flow ribet 5 langkah / enterprise settings]
- **Kita Bikin:** [1 langkah instan / auto-default yang bikin user langsung puas]

### 3. 🍼 THE 30-MINUTE FOOD (Boring Code)
- **Target File:** `path/to/file.ts`
- **Solusi Paling Bodoh & Jalan:**
  - [Langkah 1: plain function / query]
  - [Langkah 2: return langsung ke UI]
  - (Total < 50 baris kode, tanpa library baru)

### 4. 🧾 STRUK HUTANG (Tech Debt Receipt)
```typescript
// DEBT: [Apa yg di-hardcode / disederhanakan] | Fix when: [Trigger metrik/kondisi nyata]
```

### 5. 🔍 BUKTI FAKTUIL (Grounded Verification)
- **Typecheck Status:** [Hasil `tsc -p tsconfig.json --noEmit` — cantumkan output/error nyata jika ada]
- **Test Status:** [Hasil `bun test <target>` — cantumkan jumlah pass/fail nyata]
```
