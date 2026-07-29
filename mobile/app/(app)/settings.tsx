import React, { useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Button, Card, Divider, Muted, Title } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { usePrefsStore } from '@/store/prefsStore';
import { erpApi, getBaseUrl } from '@/api/client';
import { useTheme } from '@/theme/ThemeContext';
import { THEME_OPTIONS, ThemeId, spacing } from '@/theme/colors';

function isManager(roles: string[] = []) {
  const r = roles.map((x) => x.toLowerCase());
  return (
    r.includes('system manager') ||
    r.includes('stock take manager') ||
    r.includes('stock manager') ||
    r.includes('administrator')
  );
}

export default function SettingsScreen() {
  const user = useAppStore((s) => s.user);
  const settings = useAppStore((s) => s.settings);
  const baseUrl = useAppStore((s) => s.baseUrl);
  const offlineQueue = useAppStore((s) => s.offlineQueue);
  const logout = useAppStore((s) => s.logout);
  const refreshBootstrap = useAppStore((s) => s.refreshBootstrap);
  const flushOfflineQueue = useAppStore((s) => s.flushOfflineQueue);

  const prefs = usePrefsStore();
  const { themeId, setThemeId, colors } = useTheme();
  const manager = isManager(user?.roles);
  const [busy, setBusy] = useState(false);

  // Effective balance visibility for display
  const serverShow = !!settings?.show_system_balance_on_device;
  const balanceLabel =
    prefs.showSystemBalance === null
      ? `Follow server (${serverShow ? 'show' : 'hide'})`
      : prefs.showSystemBalance
        ? 'Always show on this phone'
        : 'Always hide on this phone (blind count)';

  const onRefresh = async () => {
    setBusy(true);
    try {
      await refreshBootstrap();
      Toast.show({ type: 'success', text1: 'Settings refreshed' });
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
      Toast.show({ type: 'success', text1: n ? `Synced ${n} item(s)` : 'Nothing pending' });
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
        text1: 'Connected',
        text2: `${r.app} v${r.version}`,
      });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Ping failed', text2: e?.message });
    }
  };

  const cycleBalancePref = async () => {
    // null → false (hide) → true (show) → null
    const cur = prefs.showSystemBalance;
    const next = cur === null ? false : cur === false ? true : null;
    await prefs.setPref('showSystemBalance', next);
    Toast.show({
      type: 'info',
      text1: 'Balance display updated',
      text2:
        next === null
          ? 'Using ERPNext setting'
          : next
            ? 'System balance visible'
            : 'Blind count — balance hidden',
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }}
    >
      <Card style={styles.profile}>
        {settings?.app_logo ? (
          <Image source={{ uri: settings.app_logo }} style={styles.logo} resizeMode="contain" />
        ) : null}
        <Title style={{ fontSize: 18 }}>{settings?.mobile_app_title || 'AKO Stock Take'}</Title>
        <Muted>{user?.full_name}</Muted>
        <Muted>{user?.email || user?.name}</Muted>
      </Card>

      {/* 1. Blind count / balance */}
      <Card style={{ marginTop: spacing.md }}>
        <Text style={[styles.h, { color: colors.text }]}>Counting</Text>
        <Muted style={{ marginBottom: spacing.sm }}>
          Hide system balance so counters cannot match the book figure. Variance is still
          calculated on the server.
        </Muted>
        <Button title={balanceLabel} variant="secondary" onPress={cycleBalancePref} icon="eye-outline" />
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Newest counts on top</Text>
            <Muted>List latest scanned lines first</Muted>
          </View>
          <Switch
            value={prefs.newestCountsFirst}
            onValueChange={(v) => prefs.setPref('newestCountsFirst', v)}
            trackColor={{ true: colors.primary }}
          />
        </View>
      </Card>

      {/* Themes */}
      <Card style={{ marginTop: spacing.md }}>
        <Text style={[styles.h, { color: colors.text }]}>Theme</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((t) => {
            const on = themeId === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setThemeId(t.id as ThemeId)}
                style={[
                  styles.themeChip,
                  {
                    borderColor: on ? colors.primary : colors.border,
                    backgroundColor: on ? colors.infoBg : colors.surfaceMuted,
                  },
                ]}
              >
                <View style={[styles.swatch, { backgroundColor: t.swatch }]} />
                <Text style={{ fontWeight: '700', fontSize: 12, color: colors.text }}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Offline */}
      <Card style={{ marginTop: spacing.md }}>
        <Text style={[styles.h, { color: colors.text }]}>Offline & sync</Text>
        <Row label="Pending queue" value={`${offlineQueue.length} item(s)`} />
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Auto-sync when online</Text>
            <Muted>Push queued counts when the network returns</Muted>
          </View>
          <Switch
            value={prefs.autoSyncOffline}
            onValueChange={(v) => prefs.setPref('autoSyncOffline', v)}
            trackColor={{ true: colors.primary }}
          />
        </View>
        <View style={{ gap: 10, marginTop: spacing.sm }}>
          <Button title="Sync now" onPress={onSync} loading={busy} icon="cloud-upload" />
        </View>
      </Card>

      {/* What to show */}
      <Card style={{ marginTop: spacing.md }}>
        <Text style={[styles.h, { color: colors.text }]}>What to show on this phone</Text>
        <Muted style={{ marginBottom: spacing.sm }}>
          Counters usually only need Start + Sessions. Turn extras on if you manage the system.
        </Muted>
        <Toggle
          label="Process flow on Home"
          value={prefs.showHomeProcessFlow}
          onChange={(v) => prefs.setPref('showHomeProcessFlow', v)}
          colors={colors}
        />
        <Toggle
          label="Reports shortcut on Home"
          value={prefs.showHomeQuickReports}
          onChange={(v) => prefs.setPref('showHomeQuickReports', v)}
          colors={colors}
        />
        <Toggle
          label="Advanced connection tools"
          value={prefs.showAdvancedConnection}
          onChange={(v) => prefs.setPref('showAdvancedConnection', v)}
          colors={colors}
        />
        <Toggle
          label="ERPNext settings card"
          value={prefs.showErpnextSettingsCard || manager}
          onChange={(v) => prefs.setPref('showErpnextSettingsCard', v)}
          colors={colors}
        />
        <Toggle
          label="Roles list"
          value={prefs.showRolesCard || manager}
          onChange={(v) => prefs.setPref('showRolesCard', v)}
          colors={colors}
        />
        <Toggle
          label="Support card"
          value={prefs.showSupportCard}
          onChange={(v) => prefs.setPref('showSupportCard', v)}
          colors={colors}
        />
        <Button
          title="Reset display defaults"
          variant="ghost"
          onPress={() => prefs.resetPrefs()}
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      {(prefs.showAdvancedConnection || manager) && (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={[styles.h, { color: colors.text }]}>Connection</Text>
          <Row label="ERPNext URL" value={baseUrl} />
          <Divider />
          <View style={{ gap: 10 }}>
            <Button title="Test connection" onPress={onPing} variant="secondary" icon="pulse" />
            <Button
              title="Refresh from ERPNext"
              onPress={onRefresh}
              loading={busy}
              icon="refresh"
            />
          </View>
        </Card>
      )}

      {(prefs.showErpnextSettingsCard || manager) && (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={[styles.h, { color: colors.text }]}>From ERPNext (server)</Text>
          <Row
            label="Mandatory variance reason"
            value={settings?.require_variance_reason ? 'Yes' : 'No'}
          />
          <Row
            label="Show system balance (server)"
            value={settings?.show_system_balance_on_device ? 'Yes' : 'No'}
          />
          <Row label="Duplicate scan" value={settings?.duplicate_scan_behavior || 'Accumulate'} />
          <Row label="Default company" value={settings?.company || '—'} />
          <Muted style={{ marginTop: spacing.sm }}>
            Change server defaults in Desk → Stock Take → Stock Take Settings.
          </Muted>
          <Button
            title="Open in ERPNext"
            variant="ghost"
            style={{ marginTop: spacing.sm }}
            onPress={async () => {
              const base = await getBaseUrl();
              Linking.openURL(`${base}/app/stock-take-settings`);
            }}
          />
        </Card>
      )}

      {(prefs.showRolesCard || manager) && (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={[styles.h, { color: colors.text }]}>Roles</Text>
          <Muted>{(user?.roles || []).join(', ') || '—'}</Muted>
        </Card>
      )}

      {prefs.showSupportCard && (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={[styles.h, { color: colors.text }]}>Support</Text>
          <Row label="Email" value={settings?.support_email || 'justinemsengi@gmail.com'} />
          <Row label="Phone" value={settings?.support_phone || '—'} />
        </Card>
      )}

      <Button
        title="Sign out"
        variant="danger"
        onPress={onLogout}
        style={{ marginTop: spacing.lg }}
        icon="log-out-outline"
      />

      <Muted style={{ textAlign: 'center', marginTop: spacing.md }}>
        AKO Stock Take · Koda Technologies · Justin Msengi
      </Muted>
    </ScrollView>
  );
}

function Toggle({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  colors: { text: string; primary: string };
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={[styles.switchLabel, { color: colors.text, flex: 1 }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profile: { alignItems: 'center', gap: 4 },
  logo: { width: 72, height: 72, marginBottom: 8, borderRadius: 12 },
  h: { fontWeight: '800', fontSize: 15, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  rowLabel: { fontSize: 13, flex: 1 },
  rowValue: { fontWeight: '600', fontSize: 13, flex: 1, textAlign: 'right' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  switchLabel: { fontWeight: '600', fontSize: 14 },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  swatch: { width: 16, height: 16, borderRadius: 8 },
});
