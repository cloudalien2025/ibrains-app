#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/root/ibrains-app"
OUT_DIR="${REPO_DIR}/artifacts/_share/pw-debug"

mkdir -p "${OUT_DIR}"
chmod -R a+rwx "${REPO_DIR}/artifacts/_share" || true

# Run Playwright as pwuser to avoid Chrome crashpad EPERM
sudo -u pwuser -H bash -lc "
  set -euo pipefail
  cd '${REPO_DIR}'
  mkdir -p '${OUT_DIR}'
  E2E_MOCK_GRAPH=1 \
  PW_EXECUTABLE_PATH=/usr/bin/google-chrome \
  pnpm playwright test --project=chromium \
    --trace on \
    --output '${OUT_DIR}' \
    --reporter=line
"

echo ""
echo "Playwright droplet run complete."
echo "Artifacts: ${OUT_DIR}"
echo "Tip: copy the largest trace.zip to artifacts/_share/trace.zip for download if needed."
