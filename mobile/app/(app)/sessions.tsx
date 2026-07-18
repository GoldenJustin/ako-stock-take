import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Badge, Card, EmptyState, LoadingBlock, Muted } from '@/components/ui';
import { erpApi } from '@/api/client';
import { colors, spacing } from '@/theme/colors';
import type { SessionListItem } from '@/types';
import { formatQty, statusColor } from '@/utils/format';

const FILTERS = ['All', 'In Progress', 'Draft', 'Submitted'] as const;

export default function SessionsScreen() {
  const [items, setItems] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');

  const load = useCallback(async () => {
    try {
      const data = await erpApi.listSessions({
        limit: 100,
        status: filter === 'All' ? undefined : filter,
      });
      setItems(data || []);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Failed to load sessions', text2: e?.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  if (loading) return <LoadingBlock label="Loading sessions…" />;

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.chip, filter === f && styles.chipOn]}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextOn]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.name}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40, flexGrow: 1 }}
        ListEmptyComponent={
          <EmptyState
            icon="clipboard-outline"
            title="No sessions"
            message="Start a stock take from the Start tab."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(app)/session/${encodeURIComponent(item.name)}`)}
          >
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.name}>{item.name}</Text>
                <Badge
                  text={item.status}
                  color={statusColor(item.status)}
                  bg={`${statusColor(item.status)}22`}
                />
              </View>
              <Text style={styles.wh}>{item.warehouse}</Text>
              <Muted>
                {item.posting_date || '—'} · Counted {item.items_counted || 0}
                {item.items_with_variance
                  ? ` · Variance lines ${item.items_with_variance}`
                  : ''}
              </Muted>
              {item.total_variance_qty ? (
                <Text
                  style={[
                    styles.var,
                    {
                      color:
                        (item.total_variance_qty || 0) < 0 ? colors.danger : colors.success,
                    },
                  ]}
                >
                  Net variance qty: {formatQty(item.total_variance_qty)}
                </Text>
              ) : null}
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  chipTextOn: { color: colors.white },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontWeight: '800', fontSize: 15, color: colors.text },
  wh: { fontWeight: '600', color: colors.text, marginTop: 4, marginBottom: 2 },
  var: { marginTop: 6, fontWeight: '700', fontSize: 13 },
});
