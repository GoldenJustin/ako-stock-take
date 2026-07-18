#!/usr/bin/env node
/**
 * Smoke-test ERPNext using the SAME auth method as SFA-CRM:
 *   POST /api/method/login  { usr, pwd }  → sid cookie
 *   subsequent calls with Cookie: sid=...
 *
 *   ERPNEXT_URL=https://erpnext.kodatechnologies.co.tz \
 *   ERPNEXT_USR=user@example.com ERPNEXT_PWD=secret \
 *   node scripts/test-erpnext.mjs
 */

const baseURL = (process.env.ERPNEXT_URL || 'https://erpnext.kodatechnologies.co.tz').replace(
  /\/+$/,
  ''
);
const usr = process.env.ERPNEXT_USR;
const pwd = process.env.ERPNEXT_PWD;

function log(ok, msg, extra) {
  console.log(`${ok ? '✓' : '✗'} ${msg}${extra ? ` — ${extra}` : ''}`);
}

async function main() {
  console.log(`\nAKO Stock Take · SFA-style auth smoke test`);
  console.log(`URL: ${baseURL}\n`);

  // 1. frappe.ping
  try {
    const r = await fetch(`${baseURL}/api/method/frappe.ping`);
    const j = await r.json();
    log(r.ok && j.message === 'pong', 'frappe.ping', `HTTP ${r.status}`);
  } catch (e) {
    log(false, 'frappe.ping', e.message);
  }

  if (!usr || !pwd) {
    log(false, 'Auth skipped', 'Set ERPNEXT_USR and ERPNEXT_PWD');
    console.log('\nDone.\n');
    return;
  }

  // 2. loginToERP (SFA-CRM identical)
  console.log(`[AUTH]: Attempting login to ${baseURL} for ${usr}`);
  let sid = '';
  try {
    const response = await fetch(`${baseURL}/api/method/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ usr, pwd }),
    });
    const data = await response.json();
    const cookieStr =
      (typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie().join('; ')
        : '') ||
      response.headers.get('set-cookie') ||
      '';
    const match = cookieStr.match(/sid=([^;,\s]+)/);
    if (match) sid = match[1];

    const ok = response.ok && data.message === 'Logged In';
    log(ok, 'loginToERP (/api/method/login)', ok ? `user=${data.full_name || usr} sid=${sid ? sid.slice(0, 8) + '…' : '(empty)'}` : data.message || `HTTP ${response.status}`);

    if (!ok) {
      console.log('\nDone.\n');
      return;
    }
  } catch (e) {
    log(false, 'loginToERP', e.message);
    console.log('\nDone.\n');
    return;
  }

  // 3. authFetch helper
  async function authFetch(endpoint, method = 'GET', body = null) {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (sid) headers.Cookie = `sid=${sid}`;
    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);
    console.log(`[API REQUEST]: ${method} -> ${endpoint}`);
    const response = await fetch(`${baseURL}${endpoint}`, config);
    const text = await response.text();
    console.log(`[API RESPONSE]: Code ${response.status}`);
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  // 4. logged user
  try {
    const me = await authFetch('/api/method/frappe.auth.get_logged_user');
    log(!!me.message, 'frappe.auth.get_logged_user', me.message || JSON.stringify(me).slice(0, 120));
  } catch (e) {
    log(false, 'get_logged_user', e.message);
  }

  // 5. custom app
  try {
    const appPing = await authFetch('/api/method/ako_stock_take.api.stock_take.ping');
    const ok = !!appPing.message?.ok;
    log(ok, 'ako_stock_take.ping', ok ? JSON.stringify(appPing.message) : JSON.stringify(appPing).slice(0, 160));

    if (ok) {
      const boot = await authFetch('/api/method/ako_stock_take.api.stock_take.get_bootstrap');
      const b = boot.message;
      log(
        !!b?.user,
        'get_bootstrap',
        b
          ? `user=${b.user?.name}, warehouses=${b.warehouses?.length}, logo=${b.settings?.app_logo || 'none'}`
          : JSON.stringify(boot).slice(0, 160)
      );
    }
  } catch (e) {
    log(false, 'stock_take APIs', e.message);
  }

  console.log('\nDone.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
