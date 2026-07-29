import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/config';

/**
 * Device-side preferences.
 * - showSystemBalance: null = follow ERPNext setting; true/false = force on this phone
 * - UI sections: hide clutter for counters vs managers
 */
export type UiPrefs = {
  /** null = use ERPNext Stock Take Settings */
  showSystemBalance: boolean | null;
  showHomeProcessFlow: boolean;
  showHomeQuickReports: boolean;
  showAdvancedConnection: boolean;
  showErpnextSettingsCard: boolean;
  showRolesCard: boolean;
  showSupportCard: boolean;
  autoSyncOffline: boolean;
  newestCountsFirst: boolean;
};

const defaults: UiPrefs = {
  showSystemBalance: null,
  showHomeProcessFlow: false,
  showHomeQuickReports: true,
  showAdvancedConnection: false,
  showErpnextSettingsCard: false,
  showRolesCard: false,
  showSupportCard: true,
  autoSyncOffline: true,
  newestCountsFirst: true,
};

type PrefsState = UiPrefs & {
  hydrated: boolean;
  hydratePrefs: () => Promise<void>;
  setPref: <K extends keyof UiPrefs>(key: K, value: UiPrefs[K]) => Promise<void>;
  resetPrefs: () => Promise<void>;
};

async function persist(prefs: UiPrefs) {
  await AsyncStorage.setItem(STORAGE_KEYS.uiPrefs, JSON.stringify(prefs));
}

export const usePrefsStore = create<PrefsState>((set, get) => ({
  ...defaults,
  hydrated: false,

  async hydratePrefs() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.uiPrefs);
      if (raw) {
        const parsed = { ...defaults, ...JSON.parse(raw) } as UiPrefs;
        set({ ...parsed, hydrated: true });
        return;
      }
    } catch {
      /* ignore */
    }
    set({ hydrated: true });
  },

  async setPref(key, value) {
    set({ [key]: value } as any);
    const { hydrated, hydratePrefs, setPref, resetPrefs, ...prefs } = get();
    await persist(prefs as UiPrefs);
  },

  async resetPrefs() {
    set({ ...defaults });
    await persist(defaults);
  },
}));

/** Resolve whether system balance should show, combining server + device pref */
export function resolveShowSystemBalance(
  serverFlag: number | boolean | undefined,
  devicePref: boolean | null
): boolean {
  if (devicePref === true) return true;
  if (devicePref === false) return false;
  return serverFlag === undefined || serverFlag === null ? true : !!Number(serverFlag);
}
