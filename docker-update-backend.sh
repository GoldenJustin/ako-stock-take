#!/usr/bin/env bash
# Run on HOST (root@vmi…), not inside container
set -euo pipefail
CONTAINER="${1:-backend-ckbvuki7zcatvrqfgfl3i3bw}"
SITE="${SITE:-erpnext.kodatechnologies.co.tz}"

echo "Updating ako_stock_take inside $CONTAINER …"
docker exec -u frappe "$CONTAINER" bash -lc "
  cd /home/frappe/frappe-bench && \
  curl -fsSL https://raw.githubusercontent.com/GoldenJustin/ako-stock-take/main/update-erpnext-app.sh -o /tmp/upd.sh && \
  bash /tmp/upd.sh $SITE
"
echo "Restarting container to reload Python…"
docker restart "$CONTAINER"
echo "Wait 15s…"
sleep 15
echo "Done. Test login+bootstrap from host."
