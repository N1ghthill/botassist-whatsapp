#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$(mktemp -t botassist-build-linux-XXXX.log)"

cleanup() {
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

echo "==> Building Linux targets (AppImage + deb)"
set +e
(
  cd "$ROOT_DIR"
  npx electron-builder --linux AppImage deb "$@"
) 2>&1 | tee "$LOG_FILE"
STATUS=${PIPESTATUS[0]}
set -e

if [[ $STATUS -eq 0 ]]; then
  echo "==> Linux build finished (AppImage + deb)."
  exit 0
fi

if grep -qi "libcrypt\\.so\\.1" "$LOG_FILE"; then
  echo "==> Detected missing libcrypt.so.1 (common on Fedora 40+)."
  echo "==> Falling back to AppImage-only build."
  (
    cd "$ROOT_DIR"
    npx electron-builder --linux AppImage "$@"
  )
  echo "==> AppImage build finished."
  echo "==> To restore .deb generation on Fedora, install: libxcrypt-compat"
  exit 0
fi

echo "==> Linux build failed (non-recoverable)."
exit "$STATUS"
