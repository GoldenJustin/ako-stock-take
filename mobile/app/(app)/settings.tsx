import React, { useState } from 'react';
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Button, Card, Divider, Muted, Title } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { erpApi, getBaseUrl } from '@/api/client';
import { colors, spacing } from '@/theme/colors';

export default function SettingsScreen() {
  const user = useAppStore((s) => s.user);
  const settings = useAppStore((s) => s.settings);
  const baseUrl = useAppStore((s) => s.baseUrl);
  const offlineQueue = useAppStore((s) => s.offlineQueue);
  const logout = useAppStore((s) => s.logout);
  const refreshBootstrap = useAppStore((s) => s.refreshBootstrap);
  const flushOfflineQueue = useAppStore((s) => s.flushOfflineQueue);
  const [busy, setBusy] = useState(false);

  const onRefresh = async () => {
    setBusy(true);
    try {
      await refreshBootstrap();
      Toast.show({ type: 'success', text1: 'Settings refreshed from ERPNext' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Refresh failed', text2: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const onSync = async () => {
    setBusy(true);
    try {
      const n = await flushOfflineQueue();
      Toast.show({
        type: 'success',
        text1: n ? `Synced ${n} items` : 'Queue empty',
      });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Sync failed', text2: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const onPing = async () => {
    try {
      const r = await erpApi.ping();
      Toast.show({
        type: 'success',
        text1: 'ERPNext connected',
        text2: `${r.app} v${r.version} · ${r.user}`,
      });
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Ping failed',
        text2: e?.message || 'Is ako_stock_take installed on the site?',
      });
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
    >
      <Card style={styles.profile}>
        {settings?.app_logo ? (
          <Image source={{ uri: settings.app_logo }} style={styles.logo} resizeMode="contain" />
        ) : null}
        <Title style={{ fontSize: 18 }}>{settings?.mobile_app_title || 'AKO Stock Take'}</Title>
        <Muted>{user?.full_name}</Muted>
        <Muted>{user?.email || user?.name}</Muted>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={styles.h}>Connection</Text>
        <Row label="ERPNext URL" value={baseUrl} />
        <Row label="Auth method" value="POST /api/method/login → erp_sid (SFA-CRM style)" />
        <Row label="Offline queue" value={`${offlineQueue.length} pending`} />
        <Divider />
        <View style={{ gap: 10 }}>
          <Button title="Test Connection (Ping)" onPress={onPing} variant="secondary" icon="pulse" />
          <Button title="Refresh Branding & Settings" onPress={onRefresh} loading={busy} icon="refresh" />
          <Button title="Sync Offline Queue" onPress={onSync} loading={busy} icon="cloud-upload" />
        </View>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={styles.h}>Stock Take Settings (from ERPNext)</Text>
        <Row label="Mandatory variance reason" value={settings?.require_variance_reason ? 'Yes' : 'No'} />
        <Row label="Show system balance" value={settings?.show_system_balance_on_device ? 'Yes' : 'No'} />
        <Row label="Lock actual balance" value={settings?.lock_actual_balance ? 'Yes' : 'No'} />
        <Row label="Duplicate scan" value={settings?.duplicate_scan_behavior || 'Accumulate'} />
        <Row label="Default company" value={settings?.company || '—'} />
        <Row
          label="Stock reconciliation on submit"
          value={settings?.create_stock_reconciliation ? 'Yes' : 'No'}
        />
        <Muted style={{ marginTop: spacing.sm }}>
          Change these in ERPNext → Stock Take workspace → Stock Take Settings. Logo is taken from
          Settings app logo or Company logo.
        </Muted>
        <Button
          title="Open ERPNext Settings"
          variant="ghost"
          style={{ marginTop: spacing.sm }}
          onPress={async () => {
            const base = await getBaseUrl();
            Linking.openURL(`${base}/app/stock-take-settings`);
          }}
        />
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={styles.h}>Roles</Text>
        <Muted>{(user?.roles || []).join(', ') || '—'}</Muted>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={styles.h}>Support</Text>
        <Row label="Email" value={settings?.support_email || 'justinemsengi@gmail.com'} />
        <Row label="Phone" value={settings?.support_phone || '—'} />
      </Card>

      <Button
        title="Sign Out"
        variant="danger"
        onPress={onLogout}
        style={{ marginTop: spacing.lg }}
        icon="log-out-outline"
      />

      <Muted style={{ textAlign: 'center', marginTop: spacing.md }}>
        AKO Stock Take · Koda Technologies
      </Muted>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  profile: { alignItems: 'center', gap: 4 },
  logo: { width: 72, height: 72, marginBottom: 8, borderRadius: 12 },
  h: { fontWeight: '800', fontSize: 15, color: colors.text, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  rowLabel: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  rowValue: { color: colors.text, fontWeight: '600', fontSize: 13, flex: 1, textAlign: 'right' },
});
