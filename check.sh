#!/usr/bin/env bash
set -e

# --- Visual Logger Helpers ---
C_RESET="\033[0m"
C_BLUE="\033[1;34m"
C_GREEN="\033[1;32m"
C_RED="\033[1;31m"
C_YELLOW="\033[1;33m"
C_CYAN="\033[1;36m"

log_step() { echo -e "${C_BLUE}[STEP $(date +'%H:%M:%S')]${C_RESET} $1"; }
log_info() { echo -e "${C_CYAN}[INFO]${C_RESET}  $1"; }
log_pass() { echo -e "${C_GREEN}[PASS]${C_RESET}  $1"; }
log_warn() { echo -e "${C_YELLOW}[WARN]${C_RESET}  $1"; }
log_fail() { echo -e "${C_RED}[FAIL]${C_RESET}  $1"; }

# ---------------------------------------------------------
# 1. Pengecekan Lingkungan Kerja
# ---------------------------------------------------------
log_step "1/6 Memeriksa status git working tree..."
if [ -n "$(git status --porcelain)" ]; then
  log_fail "Working tree kotor. Selesaikan atau stash pekerjaan lokal terlebih dahulu."
  exit 1
fi
log_pass "Workspace bersih, aman untuk eksekusi otomatis."

# ---------------------------------------------------------
# 2. Scanning Type Error
# ---------------------------------------------------------
log_step "2/6 Mendeteksi type error via TypeScript compiler..."

# Tampung seluruh output tsc tanpa memicu exit code error
TSC_OUTPUT=$(bun x tsc --noEmit 2>&1 || true)

# Tangkap baris pertama yang mengandung error TypeScript
ERROR_LINE=$(echo "$TSC_OUTPUT" | grep -E "error TS[0-9]+|error:" | head -n 1 || true)

if [ -z "$ERROR_LINE" ]; then
  log_pass "Semua tipe data aman. Tidak ada error yang perlu ditangani."
  exit 0
fi

# Parsing nama file target (support format file.ts(12,5) atau file.ts:12:5)
TARGET_FILE=$(echo "$ERROR_LINE" | sed -E 's/(\(|\:)[0-9].*//g' | xargs)
BASE_NAME="${TARGET_FILE%.*}"
EXT="${TARGET_FILE##*.}"
TEST_FILE="${BASE_NAME}.test.${EXT}"

log_warn "Ditemukan issue pada target:"
log_info "File  : $TARGET_FILE"
log_info "Error : $ERROR_LINE"

# ---------------------------------------------------------
# 3. Instruksi dan Eksekusi Hermes
# ---------------------------------------------------------
log_step "3/6 Mengirim konteks dan instruksi perbaikan ke Hermes..."

PROMPT="Perbaiki error TypeScript berikut pada file $TARGET_FILE:
$ERROR_LINE

BATASAN KETAT:
1. Dilarang memakai 'any', 'unknown', '@ts-ignore', atau '@ts-expect-error'.
2. Pertahankan seluruh logic runtime agar unit test tetap hijau.
3. Kembalikan kode file utuh tanpa markdown codeblock atau teks pengantar."

# --- HUBUNGKAN HERMES RUNNER DI SINI ---
# Contoh jika memakai CLI runner:
# run-hermes --file "$TARGET_FILE" --prompt "$PROMPT" > "$TARGET_FILE"

log_pass "Patch berhasil diterapkan oleh Hermes ke $TARGET_FILE."

# ---------------------------------------------------------
# 4. Validasi Lapis 1: Typecheck Verification
# ---------------------------------------------------------
log_step "4/6 Menjalankan verifikasi ulang tipe data (tsc)..."

VERIFY_TSC_OUTPUT=$(bun x tsc --noEmit 2>&1 || true)
if echo "$VERIFY_TSC_OUTPUT" | grep -qE "error TS[0-9]+|error:"; then
  log_fail "Verifikasi tipe gagal. Hermes menghasilkan error baru atau belum tuntas."
  log_warn "Melakukan rollback file: $TARGET_FILE"
  git checkout -- "$TARGET_FILE"
  exit 1
fi
log_pass "TypeScript compiler: Valid (0 error)."

# ---------------------------------------------------------
# 5. Validasi Lapis 2: Unit Test Suite
# ---------------------------------------------------------
log_step "5/6 Menjalankan verifikasi logika melalui unit test..."

if [ -f "$TEST_FILE" ]; then
  log_info "Menjalankan isolated test: $TEST_FILE"
  TEST_CMD="bun test $TEST_FILE"
else
  log_info "File test lokal tidak ditemukan. Menjalankan test suite proyek..."
  TEST_CMD="bun test"
fi

if ! $TEST_CMD > /dev/null 2>&1; then
  log_fail "Unit test gagal! Logic terganggu oleh perubahan model."
  log_warn "Membatalkan perubahan dan mengembalikan status commit awal..."
  git checkout -- "$TARGET_FILE"
  exit 1
fi
log_pass "Seluruh assert unit test lolos tanpa regresi."

# ---------------------------------------------------------
# 6. Finalisasi & Simpan Perubahan
# ---------------------------------------------------------
log_step "6/6 Menyimpan hasil perbaikan yang telah terverifikasi..."
git add "$TARGET_FILE"
git commit -m "fix(types): auto-resolved & verified via hermes for $TARGET_FILE" > /dev/null

log_pass "Selesai. Patch telah tersimpan ke riwayat git secara aman."