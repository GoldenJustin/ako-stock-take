# Install notes

## ERPNext (bench or Frappe Docker)

From inside `frappe-bench`:

```bash
curl -fsSL https://raw.githubusercontent.com/GoldenJustin/ako-stock-take/main/install-erpnext.sh | bash
```

Docker production images often break `bench get-app` on a local path.  
The script copies into `apps/`, runs `pip install -e`, then `install-app` + `migrate`.

If you already installed once and only need new code:

```bash
bash update-erpnext-app.sh erpnext.kodatechnologies.co.tz
```

On Docker, restart the backend after updating so Python reloads:

```bash
docker restart backend-ckbvuki7zcatvrqfgfl3i3bw
```

### Check

```bash
bench --site erpnext.kodatechnologies.co.tz list-apps

curl -sS -c /tmp/c.txt -b /tmp/c.txt \
  -X POST https://erpnext.kodatechnologies.co.tz/api/method/login \
  -H 'Content-Type: application/json' \
  -d '{"usr":"you@company.com","pwd":"secret"}'

curl -sS -b /tmp/c.txt \
  https://erpnext.kodatechnologies.co.tz/api/method/ako_stock_take.api.stock_take.ping
```

## Mobile

```bash
cd mobile
npm install
npx expo start
```

Use the local CLI (`npx expo`), not a global old `expo-cli`.

## Roles

- Stock Take User – count  
- Stock Take Manager – submit, settings, reports  

Also needs read on Item, Warehouse, Bin.
