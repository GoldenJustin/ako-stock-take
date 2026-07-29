import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { resolveShowSystemBalance, usePrefsStore } from '@/store/prefsStore';
import { useTheme } from '@/theme/ThemeContext';
import { spacing } from '@/theme/colors';
import type { StockTakeItemLine, StockTakeSession } from '@/types';
import { formatQty, statusColor, varianceColor } from '@/utils/format';
import { toUserMessage } from '@/utils/errors';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionName = decodeURIComponent(id || '');
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const updateActiveSession = useAppStore((s) => s.updateActiveSession);
  const settings = useAppStore((s) => s.settings);
  const showSystemBalancePref = usePrefsStore((s) => s.showSystemBalance);
  const newestFirst = usePrefsStore((s) => s.newestCountsFirst);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<StockTakeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'variance' | 'ok'>('all');

  const showBalance = resolveShowSystemBalance(
    settings?.show_system_balance_on_device,
    showSystemBalancePref
  );

  const load = useCallback(async () => {
    try {
      const data = await erpApi.getSession(sessionName);
      setSession(data);
      setActiveSession(data);
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to load session',
        text2: toUserMessage(e),
      });
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

  const lines = useMemo(() => {
    let list = [...(session?.items || [])];
    if (filter === 'variance') list = list.filter((l) => Number(l.variance) !== 0);
    if (filter === 'ok') list = list.filter((l) => Number(l.variance) === 0);
    // Newest on top (like Desk table after each count) — by idx desc or scanned_at
    if (newestFirst) {
      list.sort((a, b) => {
        const ta = a.scanned_at ? new Date(a.scanned_at).getTime() : 0;
        const tb = b.scanned_at ? new Date(b.scanned_at).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return (b.idx || 0) - (a.idx || 0);
      });
    } else {
      list.sort((a, b) => (a.idx || 0) - (b.idx || 0));
    }
    return list;
  }, [session?.items, filter, newestFirst]);

  const refreshBalances = async () => {
    try {
      const data = await erpApi.refreshBalances(sessionName);
      setSession(data);
      updateActiveSession(data);
      Toast.show({ type: 'success', text1: 'Balances refreshed' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Refresh failed', text2: toUserMessage(e) });
    }
  };

  if (loading || !session) {
    return <LoadingBlock label="Loading session…" />;
  }

  const footerPad = 72 + Math.max(insets.bottom, 8);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Card style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.name, { color: colors.text }]}>{session.name}</Text>
          <Badge
            text={session.status}
            color={statusColor(session.status)}
            bg={`${statusColor(session.status)}22`}
          />
        </View>
        <Text style={[styles.wh, { color: colors.text }]}>{session.warehouse}</Text>
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
            title="Scan"
            icon="barcode-outline"
            onPress={() =>
              router.push(`/(app)/session/${encodeURIComponent(session.name)}/scan`)
            }
            style={{ flex: 1 }}
          />
          <Button
            title="Search"
            variant="secondary"
            icon="search"
            onPress={() =>
              router.push({
                pathname: `/(app)/session/${encodeURIComponent(session.name)}/count`,
                params: { mode: 'search', ts: String(Date.now()) },
              })
            }
            style={{ flex: 1 }}
          />
        </View>
      ) : null}

      <View style={styles.listHeader}>
        <Text style={[styles.listTitle, { color: colors.text }]}>Counted items</Text>
        <Muted>{lines.length} line(s)</Muted>
      </View>

      <View style={styles.filters}>
        {([
          ['all', 'All'],
          ['variance', 'Variance'],
          ['ok', 'Matched'],
        ] as const).map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => setFilter(k)}
            style={[
              styles.chip,
              {
                backgroundColor: filter === k ? colors.primary : colors.surface,
                borderColor: filter === k ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: filter === k ? colors.white : colors.textSecondary,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
        {editable ? (
          <Pressable
            onPress={refreshBalances}
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
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
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: footerPad,
          flexGrow: 1,
        }}
        ListEmptyComponent={
          <EmptyState
            icon="barcode-outline"
            title="No items counted yet"
            message="Scan barcodes on the rack. Each save appears here at the top."
          />
        }
        renderItem={({ item, index }) => (
          <LineCard
            item={item}
            rowNo={index + 1}
            editable={!!editable}
            showBalance={showBalance}
            onPress={() => {
              if (!editable) return;
              router.push({
                pathname: `/(app)/session/${encodeURIComponent(session.name)}/count`,
                params: {
                  item_code: item.item_code,
                  item_name: item.item_name || '',
                  barcode: item.barcode || '',
                  actual_balance: String(item.actual_balance ?? 0),
                  physical_qty: String(item.physical_qty ?? ''),
                  reason: item.reason_for_variance || '',
                  line_name: item.name || '',
                  ts: String(Date.now()),
                },
              });
            }}
          />
        )}
      />

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
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
            onPress={() => router.push('/(app)/reports')}
            style={{ flex: 1 }}
          />
        )}
      </View>
    </View>
  );
}

function LineCard({
  item,
  rowNo,
  editable,
  showBalance,
  onPress,
}: {
  item: StockTakeItemLine;
  rowNo: number;
  editable: boolean;
  showBalance: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const v = Number(item.variance || 0);
  return (
    <Pressable onPress={onPress} disabled={!editable}>
      <Card style={styles.line}>
        <View style={styles.lineTop}>
          <Text style={[styles.rowNo, { color: colors.textMuted }]}>#{rowNo}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemCode, { color: colors.text }]}>{item.item_code}</Text>
            <Muted numberOfLines={1}>{item.item_name}</Muted>
            {item.barcode ? <Muted numberOfLines={1}>Barcode: {item.barcode}</Muted> : null}
          </View>
          {showBalance ? (
            <Text style={[styles.variance, { color: varianceColor(v) }]}>
              {v > 0 ? '+' : ''}
              {formatQty(v)}
            </Text>
          ) : (
            <Text style={[styles.variance, { color: colors.text }]}>
              {formatQty(item.physical_qty)}
            </Text>
          )}
        </View>
        <View style={styles.lineMeta}>
          {showBalance ? (
            <>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                Sys {formatQty(item.actual_balance)}
              </Text>
              <Ionicons name="arrow-forward" size={12} color={colors.textMuted} />
            </>
          ) : null}
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            Count {formatQty(item.physical_qty)}
          </Text>
          {item.reason_for_variance ? (
            <Badge text={item.reason_for_variance} color={colors.warning} bg={colors.warningBg} />
          ) : showBalance && v !== 0 ? (
            <Badge text="No reason" color={colors.danger} bg={colors.dangerBg} />
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { margin: spacing.md, marginBottom: spacing.sm },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontWeight: '800', fontSize: 16 },
  wh: { fontWeight: '700', marginTop: 6 },
  stats: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  listTitle: { fontWeight: '800', fontSize: 15 },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  iconBtn: {
    marginLeft: 'auto',
    padding: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  line: { marginBottom: spacing.sm },
  lineTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowNo: { fontWeight: '700', fontSize: 12, marginTop: 2, width: 28 },
  itemCode: { fontWeight: '800' },
  variance: { fontWeight: '800', fontSize: 16 },
  lineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  metaText: { fontSize: 12, fontWeight: '600' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
});
