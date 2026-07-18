import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  Muted,
  StatPill,
} from '@/components/ui';
import { erpApi } from '@/api/client';
import { useAppStore } from '@/store/appStore';
import { colors, spacing } from '@/theme/colors';
import type { StockTakeItemLine, StockTakeSession } from '@/types';
import { formatQty, statusColor, varianceColor } from '@/utils/format';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionName = decodeURIComponent(id || '');
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const updateActiveSession = useAppStore((s) => s.updateActiveSession);

  const [session, setSession] = useState<StockTakeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'variance' | 'ok'>('all');

  const load = useCallback(async () => {
    try {
      const data = await erpApi.getSession(sessionName);
      setSession(data);
      setActiveSession(data);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Failed to load session', text2: e?.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionName, setActiveSession]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const editable = session && session.docstatus === 0;

  const lines = (session?.items || []).filter((l) => {
    if (filter === 'variance') return Number(l.variance) !== 0;
    if (filter === 'ok') return Number(l.variance) === 0;
    return true;
  });

  const refreshBalances = async () => {
    try {
      const data = await erpApi.refreshBalances(sessionName);
      setSession(data);
      updateActiveSession(data);
      Toast.show({ type: 'success', text1: 'Balances refreshed' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Refresh failed', text2: e?.message });
    }
  };

  if (loading || !session) {
    return <LoadingBlock label="Loading session…" />;
  }

  return (
    <View style={styles.container}>
      <Card style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.name}>{session.name}</Text>
          <Badge
            text={session.status}
            color={statusColor(session.status)}
            bg={`${statusColor(session.status)}22`}
          />
        </View>
        <Text style={styles.wh}>{session.warehouse}</Text>
        <Muted>
          {session.company} · {session.posting_date} · {session.stock_take_by}
        </Muted>
        <View style={styles.stats}>
          <StatPill label="Items" value={session.total_items || 0} />
          <StatPill label="Counted" value={session.items_counted || 0} tone="success" />
          <StatPill
            label="Variances"
            value={session.items_with_variance || 0}
            tone={session.items_with_variance ? 'warning' : 'default'}
          />
        </View>
      </Card>

      {editable ? (
        <View style={styles.actions}>
          <Button
            title="Scan Barcode"
            icon="barcode-outline"
            onPress={() =>
              router.push(`/(app)/session/${encodeURIComponent(session.name)}/scan`)
            }
            style={{ flex: 1 }}
          />
          <Button
            title="Search Item"
            variant="secondary"
            icon="search"
            onPress={() =>
              router.push({
                pathname: `/(app)/session/${encodeURIComponent(session.name)}/count`,
                params: { mode: 'search' },
              })
            }
            style={{ flex: 1 }}
          />
        </View>
      ) : null}

      <View style={styles.filters}>
        {([
          ['all', 'All'],
          ['variance', 'Variance'],
          ['ok', 'Matched'],
        ] as const).map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => setFilter(k)}
            style={[styles.chip, filter === k && styles.chipOn]}
          >
            <Text style={[styles.chipText, filter === k && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
        {editable ? (
          <Pressable onPress={refreshBalances} style={styles.iconBtn}>
            <Ionicons name="refresh" size={18} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={lines}
        keyExtractor={(item, idx) => item.name || `${item.item_code}-${idx}`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 120, flexGrow: 1 }}
        ListEmptyComponent={
          <EmptyState
            icon="barcode-outline"
            title="No items counted yet"
            message="Scan barcodes on the rack to capture physical counts."
          />
        }
        renderItem={({ item }) => (
          <LineCard
            item={item}
            editable={!!editable}
            onPress={() => {
              if (!editable) return;
              router.push({
                pathname: `/(app)/session/${encodeURIComponent(session.name)}/count`,
                params: {
                  item_code: item.item_code,
                  barcode: item.barcode || '',
                  physical_qty: String(item.physical_qty ?? ''),
                  reason: item.reason_for_variance || '',
                  line_name: item.name || '',
                },
              });
            }}
          />
        )}
      />

      <View style={styles.footer}>
        <Button
          title="Summary"
          variant="ghost"
          icon="stats-chart-outline"
          onPress={() =>
            router.push(`/(app)/session/${encodeURIComponent(session.name)}/summary`)
          }
          style={{ flex: 1 }}
        />
        {editable ? (
          <Button
            title="Submit"
            variant="success"
            icon="checkmark-circle"
            onPress={() =>
              router.push(`/(app)/session/${encodeURIComponent(session.name)}/submit`)
            }
            style={{ flex: 1 }}
          />
        ) : (
          <Button
            title="Export"
            variant="secondary"
            icon="download-outline"
            onPress={() =>
              router.push('/(app)/reports')
            }
            style={{ flex: 1 }}
          />
        )}
      </View>
    </View>
  );
}

function LineCard({
  item,
  editable,
  onPress,
}: {
  item: StockTakeItemLine;
  editable: boolean;
  onPress: () => void;
}) {
  const v = Number(item.variance || 0);
  return (
    <Pressable onPress={onPress} disabled={!editable}>
      <Card style={styles.line}>
        <View style={styles.lineTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemCode}>{item.item_code}</Text>
            <Muted numberOfLines={1}>{item.item_name}</Muted>
          </View>
          <Text style={[styles.variance, { color: varianceColor(v) }]}>
            {v > 0 ? '+' : ''}
            {formatQty(v)}
          </Text>
        </View>
        <View style={styles.lineMeta}>
          <Text style={styles.metaText}>Sys {formatQty(item.actual_balance)}</Text>
          <Ionicons name="arrow-forward" size={12} color={colors.textMuted} />
          <Text style={styles.metaText}>Count {formatQty(item.physical_qty)}</Text>
          {item.reason_for_variance ? (
            <Badge text={item.reason_for_variance} color={colors.warning} bg={colors.warningBg} />
          ) : v !== 0 ? (
            <Badge text="No reason" color={colors.danger} bg={colors.dangerBg} />
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { margin: spacing.md, marginBottom: spacing.sm },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontWeight: '800', fontSize: 16, color: colors.text },
  wh: { fontWeight: '700', color: colors.text, marginTop: 6 },
  stats: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  chipTextOn: { color: colors.white },
  iconBtn: {
    marginLeft: 'auto',
    padding: 8,
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  line: { marginBottom: spacing.sm },
  lineTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemCode: { fontWeight: '800', color: colors.text },
  variance: { fontWeight: '800', fontSize: 16 },
  lineMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
