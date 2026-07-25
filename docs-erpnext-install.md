# ERPNext install (detail)

Same steps as `install-erpnext.sh`. Kept here if you prefer reading before running.

1. Copy `ako_stock_take/` into `frappe-bench/apps/`
2. `./env/bin/pip install -e apps/ako_stock_take`
3. Add `ako_stock_take` to `sites/apps.txt` if missing
4. `bench --site <site> install-app ako_stock_take`
5. `bench --site <site> migrate && bench --site <site> clear-cache`

On Frappe Docker, restart the backend container after install/update.
