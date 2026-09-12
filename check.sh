#!/usr/bin/env bash
# Auto-fix TypeScript errors, satu error per ronde:
#   tsc -> codex memperbaiki error pertama -> verifikasi (jumlah error turun +
#   unit test hijau) -> commit. Gagal verifikasi = rollback ronde itu.
#
# ponytail: satu error per ronde, tanpa batching/paralel — tsc di repo ini ~5s
# jadi ronde itu murah. Batch kalau backlog error bikin ini kelamaan.
#
# Pakai: ./check.sh [max_rounds]   (default 10)
set -euo pipefail

MAX_ROUNDS="${1:-10}"

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

# Isi TSC_ERRORS (hanya baris "file(line,col): error TSxxxx") dan TSC_COUNT.
# Baris error tanpa file (mis. tsconfig rusak) tidak punya target untuk
# diperbaiki — dibedakan lewat exit code supaya tidak salah lapor "bersih".
run_tsc() {
	local status=0
	TSC_OUT=$(bun x tsc --noEmit 2>&1) || status=$?
	TSC_ERRORS=$(printf '%s\n' "$TSC_OUT" | grep -E '^[^[:space:]].*\([0-9]+,[0-9]+\): error TS[0-9]+' || true)
	TSC_COUNT=$(printf '%s' "$TSC_ERRORS" | grep -c . || true)
	if [ "$status" -ne 0 ] && [ "$TSC_COUNT" -eq 0 ]; then
		log_fail "tsc gagal tanpa error per-file (exit $status). Perbaiki manual:"
		printf '%s\n' "$TSC_OUT" | tail -n 20
		exit 1
	fi
}

rollback() {
	log_warn "Rollback perubahan ronde ini..."
	git checkout -- .
	git clean -fdq # aman: working tree sudah dipastikan bersih sebelum mulai
}

# ---------------------------------------------------------
# Prasyarat: working tree bersih
# ---------------------------------------------------------
log_step "Memeriksa status git working tree..."
if [ -n "$(git status --porcelain)" ]; then
	log_fail "Working tree kotor. Selesaikan atau stash pekerjaan lokal terlebih dahulu."
	exit 1
fi
log_pass "Workspace bersih, aman untuk eksekusi otomatis."

for ((round = 1; round <= MAX_ROUNDS; round++)); do
	# -----------------------------------------------------
	# 1. Scanning type error
	# -----------------------------------------------------
	log_step "Ronde $round/$MAX_ROUNDS — mendeteksi type error via tsc..."
	run_tsc
	if [ "$TSC_COUNT" -eq 0 ]; then
		log_pass "Semua tipe data aman. Tidak ada error yang perlu ditangani."
		exit 0
	fi

	ERROR_LINE=$(printf '%s\n' "$TSC_ERRORS" | head -n 1)
	TARGET_FILE="${ERROR_LINE%%(*}"
	TEST_FILE="${TARGET_FILE%.*}.test.${TARGET_FILE##*.}"

	log_warn "Sisa $TSC_COUNT error. Target ronde ini:"
	log_info "File  : $TARGET_FILE"
	log_info "Error : $ERROR_LINE"

	# -----------------------------------------------------
	# 2. Eksekusi fixer (codex exec, proses terpisah)
	# -----------------------------------------------------
	log_step "Mengirim konteks dan instruksi perbaikan ke codex..."
	FIX_LOG=$(mktemp)
	# </dev/null wajib: tanpa itu codex exec menunggu stdin ("Reading additional
	# input from stdin...") dan menggantung selamanya di 0% CPU.
	if ! codex exec \
		--skip-git-repo-check \
		--dangerously-bypass-approvals-and-sandbox \
		--disable in_app_browser \
		"Perbaiki error TypeScript berikut dengan mengedit file $TARGET_FILE langsung di disk:
$ERROR_LINE

BATASAN KETAT:
1. Dilarang memakai 'any', 'unknown', '@ts-ignore', atau '@ts-expect-error'.
2. Pertahankan seluruh logic runtime agar unit test tetap hijau.
3. Ubah seminimal mungkin — hanya yang dibutuhkan error di atas." \
		</dev/null >"$FIX_LOG" 2>&1; then
		log_fail "codex exec gagal. 20 baris terakhir log ($FIX_LOG):"
		tail -n 20 "$FIX_LOG"
		rollback
		exit 1
	fi

	if [ -z "$(git status --porcelain)" ]; then
		log_fail "codex tidak mengubah file apa pun. Error ini perlu ditangani manual."
		exit 1
	fi
	log_info "File tersentuh: $(git status --porcelain | awk '{print $2}' | tr '\n' ' ')"

	# -----------------------------------------------------
	# 3. Validasi lapis 1: typecheck
	# -----------------------------------------------------
	log_step "Menjalankan verifikasi ulang tipe data (tsc)..."
	BEFORE_COUNT="$TSC_COUNT"
	run_tsc
	if [ "$TSC_COUNT" -ge "$BEFORE_COUNT" ]; then
		log_fail "Jumlah error tidak berkurang ($BEFORE_COUNT -> $TSC_COUNT). Patch ditolak."
		printf '%s\n' "$TSC_ERRORS" | head -n 5
		rollback
		exit 1
	fi
	log_pass "TypeScript: $BEFORE_COUNT -> $TSC_COUNT error."

	# -----------------------------------------------------
	# 4. Validasi lapis 2: unit test
	# -----------------------------------------------------
	log_step "Menjalankan verifikasi logika melalui unit test..."
	if [ -f "$TEST_FILE" ]; then
		log_info "Menjalankan isolated test: $TEST_FILE"
		TEST_CMD=(bun test "$TEST_FILE")
	else
		log_info "File test lokal tidak ditemukan. Menjalankan test suite proyek..."
		TEST_CMD=(bun run test)
	fi

	TEST_LOG=$(mktemp)
	if ! "${TEST_CMD[@]}" >"$TEST_LOG" 2>&1; then
		log_fail "Unit test gagal! Logic terganggu oleh perubahan model."
		tail -n 30 "$TEST_LOG"
		rollback
		exit 1
	fi
	log_pass "Seluruh assert unit test lolos tanpa regresi."

	# -----------------------------------------------------
	# 5. Simpan hasil ronde ini
	# -----------------------------------------------------
	log_step "Menyimpan hasil perbaikan yang telah terverifikasi..."
	git add -A
	git commit -q -m "fix(types): auto-resolved & verified for $TARGET_FILE"
	log_pass "Ronde $round tersimpan ke riwayat git."
done

log_warn "Batas $MAX_ROUNDS ronde tercapai, masih ada $TSC_COUNT error tersisa."
exit 1
