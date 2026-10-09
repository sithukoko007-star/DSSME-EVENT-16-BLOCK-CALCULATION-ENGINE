#!/usr/bin/env bash
# Phase 3 targeted strict check.
# Runs tsc with tsconfig.phase3.json (strict + noUncheckedIndexedAccess) over Phase 3 files ONLY gating on
# diagnostics located in src/engine/blocks/** and tests/blocks/**. Strict diagnostics in FROZEN Phase 1/2
# files that those files import are reported as informational (frozen code is not modified, and the
# repository tsconfig is not changed).
set -u
out="$(npx tsc -p tsconfig.phase3.json --noEmit 2>&1)"
code=$?
mine="$(printf '%s\n' "$out" | grep -E '^(src/engine/blocks|tests/blocks)/' || true)"
frozen="$(printf '%s\n' "$out" | grep -E 'error TS' | grep -Ev '^(src/engine/blocks|tests/blocks)/' || true)"

if [ -n "$mine" ]; then
  echo "Phase 3 strict check FAILED:"
  printf '%s\n' "$mine"
  exit 1
fi
if [ "$code" -ne 0 ] && [ -z "$frozen" ]; then
  echo "tsc failed unexpectedly (no Phase 3 diagnostics, no frozen-file diagnostics):"
  printf '%s\n' "$out"
  exit 2
fi
echo "Phase 3 strict check: 0 diagnostics in Phase 3 files."
if [ -n "$frozen" ]; then
  echo "(informational) strict-mode diagnostics inside imported FROZEN files: $(printf '%s\n' "$frozen" | wc -l | tr -d ' ')"
fi
exit 0
