/**
 * ERPNext connection — same pattern as SFA-CRM-app (src/api.js):
 *  - loginToERP  → POST /api/method/login  → store sid
 *  - authFetch   → Cookie: sid=... on every call
 *
 * Hardened for production proxies that return HTML 502/504 bodies.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_ERPNEXT_URL, STORAGE_KEYS } from '@/constants/config';
import type {
  BootstrapData,
  DashboardStats,
  ScanResult,
  SessionListItem,
  StockTakeSession,
  VarianceReason,
  Warehouse,
} from '@/types';

const ERP_URL_KEY = 'erp_url';
const ERP_SID_KEY = 'erp_sid';
const ERP_USER_KEY = 'erp_user';

const DEFAULT_TIMEOUT_MS = 45000;
const LOGIN_TIMEOUT_MS = 60000;

export const getBaseUrl = async (): Promise<string> => {
  const url = await AsyncStorage.getItem(ERP_URL_KEY);
  const fallback =
    (await AsyncStorage.getItem(STORAGE_KEYS.baseUrl)) || DEFAULT_ERPNEXT_URL;
  return (url || fallback).replace(/\/+$/, '');
};

export const setBaseUrl = async (url: string) => {
  const clean = (url || DEFAULT_ERPNEXT_URL).replace(/\/+$/, '');
  await AsyncStorage.setItem(ERP_URL_KEY, clean);
  await AsyncStorage.setItem(STORAGE_KEYS.baseUrl, clean);
  return clean;
};

export function getBaseUrlSyncFallback() {
  return DEFAULT_ERPNEXT_URL;
}

export type LoginResult =
  | { success: true; user: string }
  | { success: false; error: string };

function withTimeout(ms: number, label = 'Request'): AbortSignal {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  // attach label for debugging via reason if supported
  try {
    (ctrl.signal as any)._label = label;
  } catch {
    /* ignore */
  }
  return ctrl.signal;
}

function summarizeBody(text: string, status: number): string {
  const t = (text || '').trim();
  if (!t) return `Empty response (HTTP ${status})`;
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const j = JSON.parse(t);
      return (
        extractFrappeError(j) ||
        (typeof j.message === 'string' ? j.message : JSON.stringify(j).slice(0, 180))
      );
    } catch {
      /* fall through */
    }
  }
  // HTML / nginx gateway pages often start with < or "Gateway..."
  const low = t.toLowerCase();
  if (status === 504 || low.includes('gateway timeout') || low.startsWith('gateway')) {
    return 'Server gateway timeout (504). ERPNext is slow or restarting — try again in a minute.';
  }
  if (status === 502 || low.includes('bad gateway')) {
    return 'Bad gateway (502). Backend container may be down — restart backend and retry.';
  }
  if (status === 503) {
    return 'Service unavailable (503). Server is busy — retry shortly.';
  }
  if (t.startsWith('<') || low.includes('<html')) {
    return `Server returned HTML instead of JSON (HTTP ${status}). Check ERPNext / proxy.`;
  }
  return t.slice(0, 200);
}

function extractSidFromResponse(response: Response): string {
  let cookieStr = '';
  try {
    const anyHeaders = response.headers as any;
    if (typeof anyHeaders.getSetCookie === 'function') {
      const list: string[] = anyHeaders.getSetCookie();
      cookieStr = (list || []).join('; ');
    }
  } catch {
    /* ignore */
  }
  if (!cookieStr) {
    cookieStr = response.headers.get('set-cookie') || '';
  }
  const match = cookieStr.match(/sid=([^;,\s]+)/);
  return match?.[1] || '';
}

/**
 * POST /api/method/login  { usr, pwd }
 * Read sid from Set-Cookie, persist to AsyncStorage (erp_sid).
 */
export const loginToERP = async (
  email: string,
  password: string,
  serverUrl?: string
): Promise<LoginResult> => {
  const baseUrl = serverUrl ? await setBaseUrl(serverUrl) : await getBaseUrl();

  console.log(`[AUTH]: Attempting login to ${baseUrl} for ${email}`);

  try {
    const response = await fetch(`${baseUrl}/api/method/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ usr: email, pwd: password }),
      signal: withTimeout(LOGIN_TIMEOUT_MS, 'login'),
    });

    const text = await response.text();
    console.log(`[AUTH]: HTTP ${response.status} bodyPreview=${text.slice(0, 80).replace(/\n/g, ' ')}`);

    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return {
        success: false,
        error: summarizeBody(text, response.status),
      };
    }

    if (response.ok && data.message === 'Logged In') {
      let sid = extractSidFromResponse(response);

      // Fallback: some proxies strip Set-Cookie from JS; call logged_user won't work without sid.
      // Keep empty sid like SFA — but warn.
      await AsyncStorage.setItem(ERP_SID_KEY, sid);
      await AsyncStorage.setItem(ERP_USER_KEY, data.full_name || email);
      await AsyncStorage.setItem(ERP_URL_KEY, baseUrl);
      await AsyncStorage.setItem(STORAGE_KEYS.baseUrl, baseUrl);
      await AsyncStorage.setItem(STORAGE_KEYS.authMode, 'password');
      try {
        const SecureStore = await import('expo-secure-store');
        if (sid) await SecureStore.setItemAsync(STORAGE_KEYS.sessionCookie, sid);
      } catch {
        /* optional */
      }

      if (!sid) {
        console.log('[AUTH]: Logged In but sid cookie not exposed to JS — API calls may fail on native.');
      } else {
        console.log(`[AUTH]: Login successful. Session SID initialized.`);
      }
      return { success: true, user: data.full_name || email };
    }

    const errMsg =
      extractFrappeError(data) ||
      data.message ||
      summarizeBody(text, response.status) ||
      'Invalid Credentials';
    console.log(`[AUTH]: Credentials rejected by server: ${errMsg}`);
    return { success: false, error: String(errMsg) };
  } catch (error: any) {
    const msg = String(error?.message || error || '');
    console.log(`[AUTH]: Network error during authentication: ${msg}`);
    if (msg.toLowerCase().includes('abort')) {
      return {
        success: false,
        error: 'Login timed out. Server is slow or unreachable — check ERPNext and try again.',
      };
    }
    if (msg.toLowerCase().includes('network request failed')) {
      return {
        success: false,
        error: 'Cannot reach server. Check internet / ERPNext URL / TLS.',
      };
    }
    // JSON parse errors from older code paths
    if (msg.toLowerCase().includes('json parse')) {
      return {
        success: false,
        error:
          'Server returned a non-JSON response (often Gateway Timeout). Wait and retry, or restart backend.',
      };
    }
    return { success: false, error: msg || 'Cannot reach server.' };
  }
};

export const logoutFromERP = async () => {
  try {
    await authFetch('/api/method/logout', 'POST');
  } catch {
    /* ignore */
  }
  await AsyncStorage.multiRemove([
    ERP_SID_KEY,
    ERP_USER_KEY,
    STORAGE_KEYS.user,
    STORAGE_KEYS.settings,
    STORAGE_KEYS.bootstrap,
  ]);
  try {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.deleteItemAsync(STORAGE_KEYS.sessionCookie);
  } catch {
    /* optional */
  }
};

export const hasStoredSession = async (): Promise<boolean> => {
  const sid = await AsyncStorage.getItem(ERP_SID_KEY);
  return !!sid;
};

export const authFetch = async (
  endpoint: string,
  method: string = 'GET',
  body: Record<string, any> | null = null
): Promise<any> => {
  const baseUrl = await getBaseUrl();
  const sid = await AsyncStorage.getItem(ERP_SID_KEY);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (sid) {
    headers['Cookie'] = `sid=${sid}`;
  }

  const config: RequestInit = {
    method,
    headers,
    signal: withTimeout(DEFAULT_TIMEOUT_MS, endpoint),
  };
  if (body) {
    config.body = JSON.stringify(body);
  }

  console.log(`[API REQUEST]: ${method} -> ${endpoint}`);

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, config);
    const text = await response.text();
    console.log(`[API RESPONSE]: Code ${response.status}`);

    let parsed: any;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {
        success: false,
        error: summarizeBody(text, response.status),
        message: text?.slice?.(0, 200),
        _http_status: response.status,
      };
      return parsed;
    }

    if (response.status === 401 || response.status === 403) {
      const msg = extractFrappeError(parsed) || 'Not permitted / session expired';
      return {
        success: false,
        error: msg,
        exc_type: parsed?.exc_type,
        _http_status: response.status,
      };
    }

    if (response.status >= 400) {
      return {
        ...parsed,
        success: false,
        error:
          extractFrappeError(parsed) ||
          summarizeBody(text, response.status) ||
          `HTTP ${response.status}`,
        _http_status: response.status,
      };
    }

    return parsed;
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    console.log(`[API ERROR]: Failure requesting ${endpoint}: ${msg}`);
    if (msg.toLowerCase().includes('abort')) {
      return {
        success: false,
        error: `Timeout calling ${endpoint}. Server may be overloaded (try again).`,
      };
    }
    return { success: false, error: msg };
  }
};

function extractFrappeError(data: any): string | null {
  if (!data) return null;
  try {
    if (typeof data._server_messages === 'string') {
      const arr = JSON.parse(data._server_messages);
      const first = typeof arr[0] === 'string' ? JSON.parse(arr[0]) : arr[0];
      if (first?.message) {
        return String(first.message).replace(/<[^>]+>/g, '');
      }
    }
  } catch {
    /* ignore */
  }
  if (typeof data.message === 'string') return data.message;
  if (data.exception) return String(data.exception);
  if (typeof data.error === 'string') return data.error;
  return null;
}

async function methodMessage<T = any>(
  methodPath: string,
  opts?: {
    method?: 'GET' | 'POST';
    body?: Record<string, any> | null;
    params?: Record<string, any>;
  }
): Promise<T> {
  let endpoint = `/api/method/${methodPath}`;
  if (opts?.params && Object.keys(opts.params).length) {
    const qs = Object.entries(opts.params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) endpoint += `?${qs}`;
  }

  const res = await authFetch(
    endpoint,
    opts?.method || (opts?.body ? 'POST' : 'GET'),
    opts?.body ?? null
  );

  if (res?.success === false || res?.error) {
    throw new Error(res.error || res.message || 'Request failed');
  }
  if (res?._http_status && res._http_status >= 400) {
    throw new Error(res.error || `HTTP ${res._http_status}`);
  }

  if (res && Object.prototype.hasOwnProperty.call(res, 'message')) {
    return res.message as T;
  }
  return res as T;
}

export async function loadAuthFromStorage() {
  const [baseUrl, sid] = await Promise.all([getBaseUrl(), AsyncStorage.getItem(ERP_SID_KEY)]);
  return {
    baseUrl,
    authMode: 'password' as const,
    sid: sid || undefined,
  };
}

export async function clearAuth() {
  await logoutFromERP();
}

export async function setTokenAuth(_apiKey: string, _apiSecret: string) {
  throw new Error('API Key auth disabled. Use loginToERP (user/password) like SFA-CRM.');
}

export async function setPasswordSession(sid: string) {
  await AsyncStorage.setItem(ERP_SID_KEY, sid);
}

export const erpApi = {
  async ping() {
    return methodMessage<{ ok: boolean; user: string; app: string; version: string }>(
      'ako_stock_take.api.stock_take.ping'
    );
  },

  async login(usr: string, pwd: string) {
    const result = await loginToERP(usr, pwd);
    if (!result.success) throw new Error(result.error);
    return result;
  },

  async logout() {
    await logoutFromERP();
  },

  async getBootstrap() {
    return methodMessage<BootstrapData>('ako_stock_take.api.stock_take.get_bootstrap');
  },

  async getLoggedUser() {
    return methodMessage<string>('frappe.auth.get_logged_user');
  },

  async getWarehouses(company?: string) {
    return methodMessage<Warehouse[]>('ako_stock_take.api.stock_take.get_warehouses', {
      params: company ? { company } : undefined,
    });
  },

  async getVarianceReasons() {
    return methodMessage<VarianceReason[]>('ako_stock_take.api.stock_take.get_variance_reasons');
  },

  async listSessions(params?: {
    warehouse?: string;
    status?: string;
    company?: string;
    limit?: number;
    mine_only?: number;
  }) {
    return methodMessage<SessionListItem[]>('ako_stock_take.api.stock_take.list_sessions', {
      params: params as any,
    });
  },

  async getSession(session_name: string) {
    return methodMessage<StockTakeSession>('ako_stock_take.api.stock_take.get_session', {
      params: { session_name },
    });
  },

  async createSession(payload: {
    warehouse: string;
    company?: string;
    title?: string;
    device_info?: string;
  }) {
    return methodMessage<StockTakeSession>('ako_stock_take.api.stock_take.create_session', {
      method: 'POST',
      body: payload,
    });
  },

  async openOrCreateSession(payload: {
    warehouse: string;
    company?: string;
    device_info?: string;
  }) {
    return methodMessage<StockTakeSession>('ako_stock_take.api.stock_take.open_or_create_session', {
      method: 'POST',
      body: payload,
    });
  },

  async scanBarcode(barcode: string, warehouse: string, session_name?: string) {
    return methodMessage<ScanResult>('ako_stock_take.api.stock_take.scan_barcode', {
      method: 'POST',
      body: { barcode, warehouse, session_name },
    });
  },

  async searchItems(query: string, warehouse?: string, limit = 20) {
    return methodMessage<any[]>('ako_stock_take.api.stock_take.search_items', {
      params: { query, warehouse, limit },
    });
  },

  async captureCount(payload: {
    session_name: string;
    item_code: string;
    physical_qty: number;
    barcode?: string;
    reason_for_variance?: string;
    reason_notes?: string;
    batch_no?: string;
    serial_no?: string;
    device_id?: string;
    accumulate?: number;
  }) {
    return methodMessage<StockTakeSession>('ako_stock_take.api.stock_take.capture_count', {
      method: 'POST',
      body: payload,
    });
  },

  async updateLine(payload: {
    session_name: string;
    line_name: string;
    physical_qty?: number;
    reason_for_variance?: string;
    reason_notes?: string;
  }) {
    return methodMessage<StockTakeSession>('ako_stock_take.api.stock_take.update_line', {
      method: 'POST',
      body: payload,
    });
  },

  async removeLine(session_name: string, line_name: string) {
    return methodMessage<StockTakeSession>('ako_stock_take.api.stock_take.remove_line', {
      method: 'POST',
      body: { session_name, line_name },
    });
  },

  async submitSession(session_name: string) {
    return methodMessage<StockTakeSession>('ako_stock_take.api.stock_take.submit_session', {
      method: 'POST',
      body: { session_name },
    });
  },

  async refreshBalances(session_name: string) {
    return methodMessage<StockTakeSession>(
      'ako_stock_take.api.stock_take.refresh_session_balances',
      { method: 'POST', body: { session_name } }
    );
  },

  async bulkSync(session_name: string, items: any[]) {
    return methodMessage('ako_stock_take.api.stock_take.bulk_sync_counts', {
      method: 'POST',
      body: { session_name, items: JSON.stringify(items) },
    });
  },

  async getSummary(session_name: string) {
    return methodMessage('ako_stock_take.api.stock_take.get_session_summary', {
      params: { session_name },
    });
  },

  async getDashboardStats(company?: string) {
    return methodMessage<DashboardStats>('ako_stock_take.api.stock_take.get_dashboard_stats', {
      params: company ? { company } : undefined,
    });
  },

  async exportExcelUrl(session_name: string) {
    const base = await getBaseUrl();
    return `${base}/api/method/ako_stock_take.api.stock_take.export_session_excel?session_name=${encodeURIComponent(session_name)}`;
  },

  absoluteUrl(path?: string | null) {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${DEFAULT_ERPNEXT_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  },
};
