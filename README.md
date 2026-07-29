# AKO Stock Take

Barcode stock take for ERPNext, with a mobile app for warehouse counting.

Built by **Justin Msengi** at **Koda Technologies** (Dar es Salaam).

- Site we run against: https://erpnext.kodatechnologies.co.tz  
- Repo: https://github.com/GoldenJustin/ako-stock-take  
- Author site: https://justinmsengi.com  

---

## What's in here

```
ako_stock_take/     ERPNext / Frappe app (DocTypes, workspace, reports, API)
mobile/             Expo 54 React Native app
install-erpnext.sh  one-shot install on bench / Docker backend
install-mobile.sh   clone + npm install for the phone app
update-erpnext-app.sh
```

Mobile talks to ERPNext the same way our other field apps do:  
`POST /api/method/login` → keep `sid` → send `Cookie: sid=...` on the rest.

---

## ERPNext install

On the bench host (or inside the backend container):

```bash
cd ~/frappe-bench   # or wherever your bench lives

curl -fsSL https://raw.githubusercontent.com/GoldenJustin/ako-stock-take/main/install-erpnext.sh | bash
```

Or with an explicit site name:

```bash
bash install-erpnext.sh erpnext.kodatechnologies.co.tz
```

After install:

1. Open the **Stock Take** workspace in Desk  
2. **Stock Take Settings** – logo, variance rules  
3. Give users **Stock Take User** / **Stock Take Manager**  
4. Put barcodes on Items  

To pull code updates later:

```bash
bash update-erpnext-app.sh erpnext.kodatechnologies.co.tz
# on Docker host you usually need: docker restart <backend>
```

---

## Mobile app

```bash
git clone https://github.com/GoldenJustin/ako-stock-take.git
cd ako-stock-take/mobile
npm install
npx expo start
```

Needs Expo SDK 54 (same family as our SFA-CRM app).  
Login with any ERPNext user that has stock-take rights. Server URL defaults to the Koda ERPNext site; you can change it on the login screen.

---

## Flow (short)

1. Barcodes registered on items  
2. Start a session for a warehouse  
3. Scan → system balance comes from Bin  
4. Enter physical qty → variance calculated  
5. Reason required when variance ≠ 0  
6. Submit → stored on **Stock Take Session**  
7. Export / reports from Desk or the app  

---

## Repo visibility (ERPNext public, mobile private)

GitHub does **not** support a public branch and a private branch in the same repo.
Branches share the repo’s visibility.

Practical options:

1. **Two repos** (recommended)  
   - `ako-stock-take` (public) – ERPNext app + install scripts only  
   - `ako-stock-take-mobile` (private) – Expo app, clone with auth  

2. **Keep one private monorepo** (current) – simplest for the team  

3. **Public monorepo** – only if you are fine shipping the mobile source  

We use option 2 day-to-day. If you want option 1 later, split `mobile/` out.

---

## License

MIT  

Copyright (c) 2026 Justin Msengi / Koda Technologies  
Contact: justinemsengi@gmail.com · https://justinmsengi.com  
