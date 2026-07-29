import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/config';
import {
  AppColors,
  ThemeId,
  THEMES,
  applyThemeColors,
  colors as sharedColors,
} from '@/theme/colors';

type ThemeCtx = {
  themeId: ThemeId;
  colors: AppColors;
  setThemeId: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeCtx>({
  themeId: 'blue',
  colors: THEMES.blue,
  setThemeId: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>('blue');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEYS.themeId);
        if (saved && saved in THEMES) {
          const id = saved as ThemeId;
          applyThemeColors(id);
          setThemeIdState(id);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const setThemeId = (id: ThemeId) => {
    applyThemeColors(id);
    setThemeIdState(id);
    AsyncStorage.setItem(STORAGE_KEYS.themeId, id).catch(() => undefined);
  };

  const value = useMemo(
    () => ({
      themeId,
      colors: THEMES[themeId] || sharedColors,
      setThemeId,
    }),
    [themeId]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
