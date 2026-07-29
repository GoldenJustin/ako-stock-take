#!/usr/bin/env bash
set -euo pipefail
SITE="${1:-${SITE:-erpnext.kodatechnologies.co.tz}}"
REPO_URL="${REPO_URL:-https://github.com/GoldenJustin/ako-stock-take.git}"
BRANCH="${BRANCH:-main}"

if [[ -d apps && -d sites ]]; then
  BENCH="$PWD"
elif [[ -d "$HOME/frappe-bench/apps" ]]; then
  BENCH="$HOME/frappe-bench"
else
  echo "ERROR: run inside frappe-bench (docker exec backend … bash)"; exit 1
fi
cd "$BENCH"
echo "==> Bench: $BENCH  Site: $SITE"

TMP=$(mktemp -d /tmp/ako-upd.XXXXXX)
trap 'rm -rf "$TMP"' EXIT

echo "==> Fetch latest $BRANCH…"
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$TMP/repo"
test -f "$TMP/repo/ako_stock_take/ako_stock_take/api/stock_take.py" || { echo "bad repo"; exit 1; }

echo "==> Replace apps/ako_stock_take"
rm -rf apps/ako_stock_take
cp -a "$TMP/repo/ako_stock_take" apps/ako_stock_take

# kill stale bytecode
find apps/ako_stock_take -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
find apps/ako_stock_take -name '*.pyc' -delete 2>/dev/null || true

echo "==> pip install -e"
./env/bin/pip install -e apps/ako_stock_take --no-cache-dir --force-reinstall -q

echo "==> Import check"
./env/bin/python - <<'PY'
import ako_stock_take.api.stock_take as api
import inspect
src = inspect.getsource(api.get_bootstrap)
print("API file:", api.__file__)
if "ako_stock_take.doctype.stock_take_settings" in src and "ako_stock_take.ako_stock_take.doctype" not in src.replace("_load_settings",""):
    # old bad import pattern without nested
    if "from ako_stock_take.doctype" in src:
        raise SystemExit("STILL OLD API with flat doctype import — clone failed?")
print("get_bootstrap OK (no flat doctype import)" if "from ako_stock_take.doctype" not in src else "WARNING")
print("has _load_settings_dict:", hasattr(api, "_load_settings_dict"))
# shims
import importlib
importlib.import_module("ako_stock_take.doctype.stock_take_settings.stock_take_settings")
print("compat shim import OK")
PY

echo "==> clear-cache"
bench --site "$SITE" clear-cache || true
bench --site "$SITE" clear-website-cache || true

# reload python without full docker restart when possible
bench --site "$SITE" execute frappe.clear_cache || true

echo ""
echo "SUCCESS. Test from host:"
echo "  curl -sS -c /tmp/c.txt -b /tmp/c.txt -X POST https://$SITE/api/method/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"usr\":\"USER\",\"pwd\":\"PASS\"}'"
echo "  curl -sS -b /tmp/c.txt https://$SITE/api/method/ako_stock_take.api.stock_take.ping"
echo "  curl -sS -b /tmp/c.txt https://$SITE/api/method/ako_stock_take.api.stock_take.get_bootstrap | head -c 300"
echo ""
echo "If still ModuleNotFoundError, restart backend container on host:"
echo "  docker restart backend-ckbvuki7zcatvrqfgfl3i3bw"
