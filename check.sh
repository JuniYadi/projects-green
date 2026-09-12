#!/usr/bin/env bash
set -e

# 1. Pastikan working directory bersih
if [ -n "$(git status --porcelain)" ]; then
  echo "Repo kotor, commit dulu perubahan lokalmu."
  exit 1
fi

# 2. Ambil error pertama dari tsc
ERROR_LINE=$(bun x tsc --noEmit | grep "error TS" | head -n 1)

if [ -z "$ERROR_LINE" ]; then
  echo "Semua type bersih!"
  exit 0
fi

TARGET_FILE=$(echo "$ERROR_LINE" | cut -d'(' -f1)

# Cari file unit test pasangannya (misal: user.ts -> user.test.ts)
BASE_NAME="${TARGET_FILE%.*}"
EXT="${TARGET_FILE##*.}"
TEST_FILE="${BASE_NAME}.test.${EXT}"

echo "Menangani error di: $TARGET_FILE"
echo "Log error: $ERROR_LINE"

# 3. Lempar instruksi dengan batasan ketat ke Hermes
PROMPT="Perbaiki error TypeScript berikut pada file $TARGET_FILE:
$ERROR_LINE

ATURAN WAJIB:
- Dilarang menggunakan 'any', 'unknown', atau komentar '@ts-ignore' / '@ts-expect-error'.
- Pertahankan business logic runtime agar seluruh unit test yang ada tetap lolos.
- Kembalikan file $TARGET_FILE utuh tanpa penjelasan."

# Eksekusi runner Hermes kamu di sini untuk update file
# contoh: run-hermes --file "$TARGET_FILE" --prompt "$PROMPT" > "$TARGET_FILE"

# 4. Validasi lapis 1: Typecheck
if ! bun x tsc --noEmit; then
  echo "Typecheck gagal! Hermes bikin error baru atau tipe rusak. Rollback..."
  git checkout -- "$TARGET_FILE"
  exit 1
fi

# 5. Validasi lapis 2: Unit Test (Penentu Utama)
if [ -f "$TEST_FILE" ]; then
  echo "Menjalankan unit test pendamping: $TEST_FILE"
  if ! bun test "$TEST_FILE"; then
    echo "Unit test GAGAL! Hermes merusak business logic. Revert total..."
    git checkout -- "$TARGET_FILE"
    exit 1
  fi
else
  # Opsi jika ingin seluruh test suite lewat
  echo "Menjalankan test suite umum..."
  if ! bun test; then
    echo "Regresi terdeteksi pada test suite. Revert total..."
    git checkout -- "$TARGET_FILE"
    exit 1
  fi
fi

# 6. Jika tembus kedua lapis validasi, commit otomatis
echo "Typecheck dan Unit Test tembus 100%!"
git add "$TARGET_FILE"
git commit -m "fix(types): automated verified fix for $TARGET_FILE"