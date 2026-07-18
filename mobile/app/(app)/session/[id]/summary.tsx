import React, { useEffect, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Button, Card, LoadingBlock, Muted, Title } from '@/components/ui';
import { erpApi } from '@/api/client';
import { colors, radius, spacing } from '@/theme/colors';
import { formatQty, varianceColor } from '@/utils/format';

export default function SessionSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionName = decodeURIComponent(id || '');
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await erpApi.getSummary(sessionName);
        setSummary(data);
      } catch (e: any) {
        Toast.show({ type: 'error', text1: 'Failed to load summary', text2: e?.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionName]);

  if (loading || !summary) return <LoadingBlock />;

  const session = summary.session;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
    >
      <Card style={styles.hero}>
        <Ionicons
          name={session.docstatus === 1 ? 'checkmark-done-circle' : 'document-text'}
          size={48}
          color={session.docstatus === 1 ? colors.success : colors.primary}
        />
        <Title style={{ marginTop: 8 }}>
          {session.docstatus === 1 ? '7. Data Stored' : 'Session Summary'}
        </Title>
        <Muted style={{ textAlign: 'center' }}>
          {session.name} · {session.warehouse}
        </Muted>
        <Muted>
          Status: {session.status}
          {session.completed_at ? ` · Completed ${session.completed_at}` : ''}
        </Muted>
      </Card>

      <View style={styles.grid}>
        <Tile label="Matched" value={summary.counts?.matched} color={colors.success} />
        <Tile label="Surplus" value={summary.counts?.surplus} color={colors.info} />
        <Tile label="Shortage" value={summary.counts?.shortage} color={colors.danger} />
        <Tile label="Exceptions" value={summary.counts?.exceptions} color={colors.warning} />
      </View>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={styles.h}>Totals</Text>
        <Row label="Items counted" value={String(session.items_counted || 0)} />
        <Row label="Items with variance" value={String(session.items_with_variance || 0)} />
        <Row label="Net variance qty" value={formatQty(session.total_variance_qty)} />
        <Row label="Net variance value" value={formatQty(session.total_variance_value, 2)} />
      </Card>

      <Section title="Shortages" rows={summary.shortage || []} />
      <Section title="Surplus" rows={summary.surplus || []} />

      <View style={{ gap: 10, marginTop: spacing.lg }}>
        <Button
          title="Export Excel"
          icon="download-outline"
          variant="secondary"
          onPress={async () => {
            const url = await erpApi.exportExcelUrl(sessionName);
            Linking.openURL(url);
          }}
        />
        <Button
          title="Back to Session"
          variant="ghost"
          onPress={() => router.replace(`/(app)/session/${encodeURIComponent(sessionName)}`)}
        />
        <Button title="Home" onPress={() => router.replace('/(app)/home')} icon="home" />
      </View>
    </ScrollView>
  );
}

function Tile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.tile, { borderColor: color }]}>
      <Text style={[styles.tileVal, { color }]}>{value ?? 0}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
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

function Section({ title, rows }: { title: string; rows: any[] }) {
  if (!rows?.length) return null;
  return (
    <Card style={{ marginTop: spacing.md }}>
      <Text style={styles.h}>
        {title} ({rows.length})
      </Text>
      {rows.slice(0, 15).map((r) => (
        <View key={r.item_code} style={styles.line}>
          <View style={{ flex: 1 }}>
            <Text style={styles.item}>{r.item_code}</Text>
            <Muted numberOfLines={1}>{r.item_name}</Muted>
          </View>
          <Text style={{ fontWeight: '800', color: varianceColor(r.variance) }}>
            {r.variance > 0 ? '+' : ''}
            {formatQty(r.variance)}
          </Text>
        </View>
      ))}
      {rows.length > 15 ? <Muted>…and {rows.length - 15} more</Muted> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hero: { alignItems: 'center', paddingVertical: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  tile: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    alignItems: 'center',
  },
  tileVal: { fontSize: 24, fontWeight: '800' },
  tileLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: 2 },
  h: { fontWeight: '800', fontSize: 15, color: colors.text, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { color: colors.textSecondary },
  rowValue: { fontWeight: '700', color: colors.text },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  item: { fontWeight: '700', color: colors.text },
});
