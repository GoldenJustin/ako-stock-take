import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { useAppStore } from '@/store/appStore';
import { usePrefsStore } from '@/store/prefsStore';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { LoadingBlock, Screen } from '@/components/ui';

function RootNav() {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);
  const hydratePrefs = usePrefsStore((s) => s.hydratePrefs);
  const prefsHydrated = usePrefsStore((s) => s.hydrated);
  const { colors } = useTheme();

  useEffect(() => {
    hydrate();
    hydratePrefs();
  }, [hydrate, hydratePrefs]);

  const paperTheme = {
    ...(colors.isDark ? MD3DarkTheme : MD3LightTheme),
    colors: {
      ...(colors.isDark ? MD3DarkTheme.colors : MD3LightTheme.colors),
      primary: colors.primary,
      secondary: colors.secondary,
      background: colors.background,
      surface: colors.surface,
      onSurface: colors.text,
    },
  };

  if (!hydrated || !prefsHydrated) {
    return (
      <Screen>
        <LoadingBlock label="Starting AKO Stock Take…" />
      </Screen>
    );
  }

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar style={colors.isDark ? 'light' : 'light'} />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      <Toast />
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootNav />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
