import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, DEFAULT_ERPNEXT_URL } from '@/constants/config';
import {
  erpApi,
  loadAuthFromStorage,
  loginToERP,
  logoutFromERP,
  hasStoredSession,
  getBaseUrl,
} from '@/api/client';
import { logTechnicalError, toUserMessage, UserFacingError } from '@/utils/errors';
import type {
  AppSettings,
  BootstrapData,
  Company,
  ErpUser,
  OfflineCountPayload,
  StockTakeSession,
  VarianceReason,
  Warehouse,
} from '@/types';

type AppState = {
  hydrated: boolean;
  isAuthenticated: boolean;
  booting: boolean;
  user: ErpUser | null;
  settings: AppSettings | null;
  warehouses: Warehouse[];
  companies: Company[];
  varianceReasons: VarianceReason[];
  baseUrl: string;
  activeSession: StockTakeSession | null;
  offlineQueue: OfflineCountPayload[];
  lastError: string | null;

  hydrate: () => Promise<void>;
  loginWithPassword: (usr: string, pwd: string, baseUrl?: string) => Promise<void>;
  /** @deprecated API token auth removed — SFA-CRM sid-only */
  loginWithToken: (apiKey: string, apiSecret: string, baseUrl?: string) => Promise<void>;
  refreshBootstrap: () => Promise<void>;
  logout: () => Promise<void>;
  setActiveSession: (session: StockTakeSession | null) => void;
  updateActiveSession: (session: StockTakeSession) => void;
  enqueueOffline: (item: OfflineCountPayload) => Promise<void>;
  flushOfflineQueue: (sessionName?: string) => Promise<number>;
  setLastError: (msg: string | null) => void;
};

const defaultSettings: AppSettings = {
  require_variance_reason: 1,
  allow_negative_stock_count: 0,
  auto_fetch_balance: 1,
  enable_offline_sync: 1,
  default_scan_mode: 'Barcode',
  allow_manual_item_search: 1,
  duplicate_scan_behavior: 'Accumulate',
  lock_actual_balance: 1,
  show_system_balance_on_device: 1,
  create_stock_reconciliation: 0,
  mobile_app_title: 'AKO Stock Take',
};

function applyBootstrap(boot: BootstrapData) {
  return {
    user: boot.user,
    settings: boot.settings || defaultSettings,
    warehouses: boot.warehouses || [],
    companies: boot.companies || [],
    varianceReasons: boot.variance_reasons || [],
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  isAuthenticated: false,
  booting: false,
  user: null,
  settings: null,
  warehouses: [],
  companies: [],
  varianceReasons: [],
  baseUrl: DEFAULT_ERPNEXT_URL,
  activeSession: null,
  offlineQueue: [],
  lastError: null,

  async hydrate() {
    try {
      const auth = await loadAuthFromStorage();
      const [bootstrapRaw, queueRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.bootstrap),
        AsyncStorage.getItem(STORAGE_KEYS.offlineQueue),
      ]);

      let offlineQueue: OfflineCountPayload[] = [];
      if (queueRaw) {
        try {
          offlineQueue = JSON.parse(queueRaw);
        } catch {
          offlineQueue = [];
        }
      }

      set({ baseUrl: auth.baseUrl, offlineQueue });

      if (bootstrapRaw) {
        try {
          const boot: BootstrapData = JSON.parse(bootstrapRaw);
          set(applyBootstrap(boot));
        } catch {
          /* ignore */
        }
      }

      // Same idea as SFA LoginScreen.checkExistingSession — if erp_sid exists, try bootstrap
      const hasSid = await hasStoredSession();
      if (hasSid) {
        try {
          const boot = await erpApi.getBootstrap();
          await AsyncStorage.setItem(STORAGE_KEYS.bootstrap, JSON.stringify(boot));
          set({
            isAuthenticated: true,
            ...applyBootstrap(boot),
          });
        } catch {
          // stale sid
          set({ isAuthenticated: false });
        }
      }
    } finally {
      set({ hydrated: true });
    }
  },

  async loginWithPassword(usr, pwd, baseUrl) {
    set({ booting: true, lastError: null });
    try {
      // SFA-CRM style login only
      const result = await loginToERP(usr, pwd, baseUrl);
      if (!result.success) {
        logTechnicalError('LOGIN', result.error);
        throw new UserFacingError(toUserMessage(result.error, 'Login failed.'), result.error);
      }

      const url = await getBaseUrl();

      // Bootstrap can fail while login succeeded — keep message clean for UI
      let boot: BootstrapData;
      try {
        boot = await erpApi.getBootstrap();
      } catch (bootErr: any) {
        logTechnicalError('BOOTSTRAP', bootErr);
        throw new UserFacingError(
          toUserMessage(
            bootErr,
            'Logged in, but app data failed to load. Update server app and retry.'
          ),
          bootErr?.message || String(bootErr)
        );
      }

      await AsyncStorage.setItem(STORAGE_KEYS.bootstrap, JSON.stringify(boot));
      set({
        isAuthenticated: true,
        baseUrl: url,
        ...applyBootstrap(boot),
      });
    } catch (e: any) {
      logTechnicalError('LOGIN_FLOW', e);
      const userMsg =
        e instanceof UserFacingError ? e.message : toUserMessage(e, 'Login failed. Try again.');
      set({ lastError: userMsg, isAuthenticated: false });
      throw new UserFacingError(userMsg, e?.technical || e?.message || String(e));
    } finally {
      set({ booting: false });
    }
  },

  async loginWithToken() {
    const msg =
      'API Key login is disabled. Connect with ERPNext user email + password (same as SFA-CRM).';
    set({ lastError: msg });
    throw new Error(msg);
  },

  async refreshBootstrap() {
    const boot = await erpApi.getBootstrap();
    await AsyncStorage.setItem(STORAGE_KEYS.bootstrap, JSON.stringify(boot));
    set(applyBootstrap(boot));
  },

  async logout() {
    await logoutFromERP();
    set({
      isAuthenticated: false,
      user: null,
      settings: null,
      warehouses: [],
      companies: [],
      varianceReasons: [],
      activeSession: null,
    });
  },

  setActiveSession(session) {
    set({ activeSession: session });
  },

  updateActiveSession(session) {
    set({ activeSession: session });
  },

  async enqueueOffline(item) {
    const queue = [...get().offlineQueue, item];
    set({ offlineQueue: queue });
    await AsyncStorage.setItem(STORAGE_KEYS.offlineQueue, JSON.stringify(queue));
  },

  async flushOfflineQueue(sessionName) {
    const queue = get().offlineQueue;
    const pending = sessionName ? queue.filter((q) => q.session_name === sessionName) : queue;
    const remaining = sessionName ? queue.filter((q) => q.session_name !== sessionName) : [];
    if (!pending.length) return 0;

    const bySession = new Map<string, OfflineCountPayload[]>();
    for (const p of pending) {
      const list = bySession.get(p.session_name) || [];
      list.push(p);
      bySession.set(p.session_name, list);
    }

    let synced = 0;
    for (const [sess, items] of bySession.entries()) {
      try {
        await erpApi.bulkSync(
          sess,
          items.map((i) => ({
            item_code: i.item_code,
            physical_qty: i.physical_qty,
            barcode: i.barcode,
            reason_for_variance: i.reason_for_variance,
            reason_notes: i.reason_notes,
            batch_no: i.batch_no,
            serial_no: i.serial_no,
            scanned_at: i.scanned_at,
            accumulate: i.accumulate ?? 0,
          }))
        );
        synced += items.length;
      } catch {
        remaining.push(...items);
      }
    }

    set({ offlineQueue: remaining });
    await AsyncStorage.setItem(STORAGE_KEYS.offlineQueue, JSON.stringify(remaining));
    return synced;
  },

  setLastError(msg) {
    set({ lastError: msg });
  },
}));
