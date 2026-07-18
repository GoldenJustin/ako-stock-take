import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input, Muted, Title } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { colors, radius, spacing } from '@/theme/colors';
import { DEFAULT_ERPNEXT_URL, STORAGE_KEYS, APP_NAME } from '@/constants/config';
import { getBaseUrl } from '@/api/client';
import { logTechnicalError, toUserMessage } from '@/utils/errors';

/**
 * Login mirrors SFA-CRM LoginScreen:
 *  - email + password only
 *  - loginToERP → /api/method/login → erp_sid
 *  - then bootstrap / navigate home
 */
export default function LoginScreen() {
  const loginWithPassword = useAppStore((s) => s.loginWithPassword);
  const booting = useAppStore((s) => s.booting);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const settings = useAppStore((s) => s.settings);

  const [baseUrl, setBaseUrlState] = useState(DEFAULT_ERPNEXT_URL);
  const [usr, setUsr] = useState('');
  const [pwd, setPwd] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    (async () => {
      const [url, savedUsr, rememberMe] = await Promise.all([
        getBaseUrl(),
        AsyncStorage.getItem(STORAGE_KEYS.savedUsr),
        AsyncStorage.getItem(STORAGE_KEYS.rememberMe),
      ]);
      if (url) setBaseUrlState(url);
      if (savedUsr) setUsr(savedUsr);
      if (rememberMe === '0') setRemember(false);
    })();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(app)/home');
    }
  }, [isAuthenticated]);

  const onLogin = async () => {
    if (!usr.trim() || !pwd) {
      Toast.show({ type: 'error', text1: 'Enter email and password' });
      return;
    }
    try {
      await loginWithPassword(usr.trim(), pwd, baseUrl.trim());
      if (remember) {
        await AsyncStorage.setItem(STORAGE_KEYS.savedUsr, usr.trim());
        await AsyncStorage.setItem(STORAGE_KEYS.rememberMe, '1');
      } else {
        await AsyncStorage.multiRemove([STORAGE_KEYS.savedUsr, STORAGE_KEYS.rememberMe]);
      }
      Toast.show({ type: 'success', text1: 'Welcome', text2: 'Connected to ERPNext' });
      router.replace('/(app)/home');
    } catch (e: any) {
      // Full stack / ERPNext text → Metro terminal only
      logTechnicalError('LOGIN_SCREEN', e?.technical || e);
      const friendly = toUserMessage(e, 'Login failed. Try again.');
      Toast.show({
        type: 'error',
        text1: 'Login failed',
        text2: friendly,
      });
    }
  };

  const logo = settings?.app_logo;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.logoWrap}>
              {logo ? (
                <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" />
              ) : (
                <View style={styles.logoFallback}>
                  <Ionicons name="cube" size={40} color={colors.white} />
                </View>
              )}
            </View>
            <Title style={styles.heroTitle}>{settings?.mobile_app_title || APP_NAME}</Title>
            <Muted style={styles.heroSub}>
              Sign in with your ERPNext user (same auth as SFA-CRM)
            </Muted>
          </View>

          <Card style={styles.card}>
            <Input
              label="Email / Username"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={usr}
              onChangeText={setUsr}
              placeholder="user@company.com"
            />
            <View>
              <Input
                label="Password"
                secureTextEntry={!showPwd}
                value={pwd}
                onChangeText={setPwd}
                placeholder="••••••••"
              />
              <Pressable style={styles.eye} onPress={() => setShowPwd((v) => !v)}>
                <Ionicons
                  name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            <Pressable style={styles.rememberRow} onPress={() => setRemember((v) => !v)}>
              <Ionicons
                name={remember ? 'checkbox' : 'square-outline'}
                size={22}
                color={colors.primary}
              />
              <Text style={styles.rememberText}>Remember username</Text>
            </Pressable>

            <Pressable onPress={() => setShowAdvanced((v) => !v)} style={styles.advancedToggle}>
              <Text style={styles.advancedText}>
                {showAdvanced ? 'Hide' : 'Server'} settings
              </Text>
              <Ionicons
                name={showAdvanced ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.primary}
              />
            </Pressable>
            {showAdvanced ? (
              <Input
                label="ERPNext URL"
                autoCapitalize="none"
                autoCorrect={false}
                value={baseUrl}
                onChangeText={setBaseUrlState}
                placeholder={DEFAULT_ERPNEXT_URL}
              />
            ) : (
              <Muted style={{ marginBottom: spacing.md }}>Server: {baseUrl}</Muted>
            )}

            <Button title="LOGIN" onPress={onLogin} loading={booting} icon="log-in-outline" />
          </Card>

          <View style={styles.footer}>
            <Muted style={{ textAlign: 'center' }}>
              Auth: POST /api/method/login → session sid (Cookie){'\n'}
              Same method used by SFA-CRM-app
            </Muted>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  scroll: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xl },
  hero: { alignItems: 'center', paddingVertical: spacing.xl },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  logo: { width: 88, height: 88 },
  logoFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { color: colors.white, textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 6 },
  card: { marginTop: spacing.sm },
  eye: { position: 'absolute', right: 14, top: 38 },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  rememberText: { color: colors.textSecondary, fontSize: 14 },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  advancedText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  footer: { marginTop: spacing.lg, paddingHorizontal: spacing.md },
});
