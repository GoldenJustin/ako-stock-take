import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Button, Card, Input, Muted, Title } from '@/components/ui';
import { erpApi, getBaseUrl } from '@/api/client';
import { colors, radius, spacing } from '@/theme/colors';
import { useAppStore } from '@/store/appStore';

export default function ReportsScreen() {
  const [sessionName, setSessionName] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const baseUrl = useAppStore((s) => s.baseUrl);

  const loadSummary = async () => {
    if (!sessionName.trim()) {
      Toast.show({ type: 'error', text1: 'Enter a session name' });
      return;
    }
    setLoading(true);
    try {
      const data = await erpApi.getSummary(sessionName.trim());
      setSummary(data);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: e?.message });
    } finally {
      setLoading(false);
    }
  };

  const openExport = async () => {
    if (!sessionName.trim()) {
      Toast.show({ type: 'error', text1: 'Enter a session name first' });
      return;
    }
    const url = await erpApi.exportExcelUrl(sessionName.trim());
    Linking.openURL(url).catch(() =>
      Toast.show({
        type: 'info',
        text1: 'Open in browser',
        text2: url,
      })
    );
  };

  const openDeskReport = async (report: string) => {
    const base = await getBaseUrl();
    const url = `${base}/app/query-report/${encodeURIComponent(report)}`;
    Linking.openURL(url);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
    >
      <Card>
        <Title style={{ fontSize: 18 }}>8. Export & Reporting</Title>
        <Muted style={{ marginTop: 4 }}>
          Stock Take Summary, Variance Report and Exception Report are available in ERPNext.
          Export session data to Excel/CSV from here.
        </Muted>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Input
          label="Session name"
          value={sessionName}
          onChangeText={setSessionName}
          placeholder="ST-2026-00001"
          autoCapitalize="characters"
        />
        <View style={{ gap: 10 }}>
          <Button title="Load Summary" onPress={loadSummary} loading={loading} icon="analytics" />
          <Button
            title="Export Excel"
            variant="secondary"
            onPress={openExport}
            icon="download-outline"
          />
        </View>
      </Card>

      {summary ? (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.h}>Session {summary.session?.name}</Text>
          <Muted>
            {summary.session?.warehouse} · {summary.session?.status}
          </Muted>
          <View style={styles.grid}>
            <Metric label="Matched" value={summary.counts?.matched} tone="success" />
            <Metric label="Surplus" value={summary.counts?.surplus} tone="info" />
            <Metric label="Shortage" value={summary.counts?.shortage} tone="danger" />
            <Metric label="Exceptions" value={summary.counts?.exceptions} tone="warning" />
          </View>
          <Muted style={{ marginTop: spacing.sm }}>
            Total variance qty: {summary.session?.total_variance_qty} · Value:{' '}
            {summary.session?.total_variance_value}
          </Muted>
        </Card>
      ) : null}

      <Text style={styles.section}>ERPNext Desk Reports</Text>
      {[
        { name: 'Stock Take Summary', icon: 'stats-chart' as const },
        { name: 'Stock Take Variance Report', icon: 'git-compare' as const },
        { name: 'Stock Take Exception Report', icon: 'alert-circle' as const },
      ].map((r) => (
        <Pressable key={r.name} onPress={() => openDeskReport(r.name)}>
          <Card style={styles.reportCard}>
            <Ionicons name={r.icon} size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.reportName}>{r.name}</Text>
              <Muted>Opens in ERPNext · {baseUrl}</Muted>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.textMuted} />
          </Card>
        </Pressable>
      ))}

      <Card style={{ marginTop: spacing.md }}>
        <Text style={styles.h}>Key advantages</Text>
        {[
          'Faster stock taking – scan items directly',
          'Improved accuracy – barcode ensures right item',
          'Automatic variance calculation',
          'Mandatory reason ensures accountability',
          'Easy reporting – export & auto-generate',
        ].map((t) => (
          <View key={t} style={styles.advRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.advText}>{t}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'danger' | 'warning' | 'info';
}) {
  const map = {
    success: colors.success,
    danger: colors.danger,
    warning: colors.warning,
    info: colors.info,
  };
  return (
    <View style={[styles.metric, { borderColor: map[tone] }]}>
      <Text style={[styles.metricVal, { color: map[tone] }]}>{value ?? 0}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  section: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontWeight: '800',
    color: colors.text,
    fontSize: 15,
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.sm,
  },
  reportName: { fontWeight: '700', color: colors.text },
  h: { fontWeight: '800', color: colors.text, fontSize: 16, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  metric: {
    width: '47%',
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  metricVal: { fontSize: 22, fontWeight: '800' },
  metricLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  advRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  advText: { flex: 1, color: colors.textSecondary, fontSize: 13 },
});
