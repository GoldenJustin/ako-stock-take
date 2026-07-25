#!/usr/bin/env bash
# =============================================================================
# AKO Stock Take — ERPNext install helper for bench / Docker
#
# Works on:
#   - plain bench
#   - Frappe Docker production backend containers (skip broken `bench get-app`)
#
# Usage (inside frappe-bench OR with BENCH_PATH set):
#
#   curl -fsSL https://raw.githubusercontent.com/GoldenJustin/ako-stock-take/main/install-erpnext.sh | bash
#
#   # or from a clone:
#   bash install-erpnext.sh
#   bash install-erpnext.sh erpnext.kodatechnologies.co.tz
#
# Env overrides:
#   SITE=erpnext.kodatechnologies.co.tz
#   BENCH_PATH=~/frappe-bench
#   REPO_URL=https://github.com/GoldenJustin/ako-stock-take.git
#   BRANCH=main
# =============================================================================
set -euo pipefail

SITE="${1:-${SITE:-erpnext.kodatechnologies.co.tz}}"
REPO_URL="${REPO_URL:-https://github.com/GoldenJustin/ako-stock-take.git}"
BRANCH="${BRANCH:-main}"
BENCH_PATH="${BENCH_PATH:-}"

red()  { printf '\033[1;31m%s\033[0m\n' "$*"; }
grn()  { printf '\033[1;32m%s\033[0m\n' "$*"; }
ylw()  { printf '\033[1;33m%s\033[0m\n' "$*"; }
inf()  { printf '\033[1;34m%s\033[0m\n' "$*"; }

die() { red "ERROR: $*"; exit 1; }

find_bench() {
  if [[ -n "${BENCH_PATH}" && -d "${BENCH_PATH}/apps" && -d "${BENCH_PATH}/sites" ]]; then
    echo "${BENCH_PATH}"
    return
  fi
  if [[ -d "${PWD}/apps" && -d "${PWD}/sites" ]]; then
    echo "${PWD}"
    return
  fi
  if [[ -d "${HOME}/frappe-bench/apps" ]]; then
    echo "${HOME}/frappe-bench"
    return
  fi
  die "Could not find frappe-bench. cd into it or set BENCH_PATH=/path/to/frappe-bench"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"
}

main() {
  require_cmd git
  require_cmd bench

  local BENCH
  BENCH="$(find_bench)"
  cd "${BENCH}"
  grn "==> Bench: ${BENCH}"
  grn "==> Site:  ${SITE}"

  [[ -d "sites/${SITE}" ]] || die "Site folder sites/${SITE} not found"

  local TMP
  TMP="$(mktemp -d /tmp/ako-stock-take.XXXXXX)"
  trap 'rm -rf "${TMP}"' EXIT

  inf "==> Cloning ${REPO_URL} (${BRANCH})…"
  git clone --depth 1 --branch "${BRANCH}" "${REPO_URL}" "${TMP}/repo"

  [[ -d "${TMP}/repo/ako_stock_take/ako_stock_take" ]] \
    || die "Repo missing ako_stock_take/ app folder — pull latest main"

  inf "==> Installing app files into apps/ako_stock_take…"
  rm -rf apps/ako_stock_take
  cp -a "${TMP}/repo/ako_stock_take" apps/ako_stock_take

  # Expected layout after copy:
  # apps/ako_stock_take/ako_stock_take/hooks.py
  # apps/ako_stock_take/ako_stock_take/ako_stock_take/doctype/...
  [[ -f apps/ako_stock_take/ako_stock_take/hooks.py ]] \
    || die "hooks.py missing after copy"
  [[ -f apps/ako_stock_take/ako_stock_take/ako_stock_take/doctype/stock_take_session/stock_take_session.json ]] \
    || die "Nested module doctypes missing — repo layout incomplete"

  inf "==> Registering app in sites/apps.txt…"
  if ! grep -qx 'ako_stock_take' sites/apps.txt 2>/dev/null; then
    echo 'ako_stock_take' >> sites/apps.txt
  fi
  # strip any corrupted glued name from older attempts
  if grep -q 'landmsako_stock_take' sites/apps.txt 2>/dev/null; then
    ylw "Removing corrupted apps.txt entry landmsako_stock_take"
    grep -vx 'landmsako_stock_take' sites/apps.txt > sites/apps.txt.clean
    mv sites/apps.txt.clean sites/apps.txt
    grep -qx 'ako_stock_take' sites/apps.txt || echo 'ako_stock_take' >> sites/apps.txt
  fi

  if [[ -f sites/apps.json ]]; then
    inf "==> Patching sites/apps.json…"
    ./env/bin/python - <<'PY'
import json
from pathlib import Path
p = Path("sites/apps.json")
data = json.loads(p.read_text() or "{}")
if isinstance(data, dict):
    for k in list(data):
        if k == "landmsako_stock_take" or "landmsako" in k:
            data.pop(k, None)
            print("removed bad key", k)
    data["ako_stock_take"] = {
        "resolution": {"commit_hash": None, "branch": None, "path": "apps/ako_stock_take"},
        "required": [],
    }
    p.write_text(json.dumps(data, indent=1) + "\n")
    print("apps.json keys:", sorted(data.keys()))
elif isinstance(data, list):
    names = []
    out = []
    for a in data:
        n = a if isinstance(a, str) else (a.get("name") or a.get("app") or "")
        if not n or n == "landmsako_stock_take":
            continue
        out.append(a)
        names.append(n)
    if "ako_stock_take" not in names:
        out.append("ako_stock_take")
    p.write_text(json.dumps(out, indent=1) + "\n")
print("apps.json updated")
PY
  fi

  inf "==> pip install -e apps/ako_stock_take…"
  ./env/bin/pip install -e apps/ako_stock_take --no-cache-dir

  inf "==> Verifying Python imports…"
  ./env/bin/python - <<'PY'
import ako_stock_take
import ako_stock_take.hooks
import ako_stock_take.ako_stock_take
print("OK", ako_stock_take.__file__)
print("OK module", ako_stock_take.ako_stock_take.__file__)
PY

  inf "==> bench install-app / migrate / clear-cache…"
  # install-app is safe to re-run; if already installed it may no-op or error — migrate still runs
  set +e
  bench --site "${SITE}" install-app ako_stock_take
  local rc=$?
  set -e
  if [[ $rc -ne 0 ]]; then
    ylw "install-app exit ${rc} — continuing with migrate (app may already be installed)"
  fi

  bench --site "${SITE}" migrate
  bench --site "${SITE}" clear-cache || true

  set +e
  bench build --app ako_stock_take
  set -e

  grn "==> Installed apps:"
  bench --site "${SITE}" list-apps || true

  grn ""
  grn "SUCCESS: ako_stock_take is on site ${SITE}"
  grn ""
  grn "Next:"
  grn "  1. Desk → Stock Take workspace"
  grn "  2. Stock Take Settings → upload Mobile App Logo"
  grn "  3. Assign roles: Stock Take User / Stock Take Manager"
  grn "  4. Item → Barcodes"
  grn "  5. Mobile: clone repo → cd mobile && npm install && npx expo start"
  grn ""
  grn "API check:"
  grn "  curl -s https://${SITE}/api/method/frappe.ping"
  grn "  # login then:"
  grn "  curl -b cookies.txt https://${SITE}/api/method/ako_stock_take.api.stock_take.ping"
}

main "$@"
