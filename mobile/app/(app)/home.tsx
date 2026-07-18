import React, { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Badge, Button, Card, Muted, StatPill, Title } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { erpApi } from '@/api/client';
import { colors, radius, spacing } from '@/theme/colors';
import type { DashboardStats, SessionListItem } from '@/types';
import { statusColor } from '@/utils/format';

export default function HomeScreen() {
  const user = useAppStore((s) => s.user);
  const settings = useAppStore((s) => s.settings);
  const offlineQueue = useAppStore((s) => s.offlineQueue);
  const flushOfflineQueue = useAppStore((s) => s.flushOfflineQueue);
  const refreshBootstrap = useAppStore((s) => s.refreshBootstrap);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<SessionListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, sessions] = await Promise.all([
        erpApi.getDashboardStats(settings?.company || undefined),
        erpApi.listSessions({ limit: 5, mine_only: 1 }),
      ]);
      setStats(d);
      setRecent(sessions || []);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Could not load dashboard', text2: e?.message });
    }
  }, [settings?.company]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshBootstrap();
      if (offlineQueue.length) {
        const n = await flushOfflineQueue();
        if (n) Toast.show({ type: 'success', text1: `Synced ${n} offline counts` });
      }
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const logo = settings?.app_logo;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Card style={styles.headerCard}>
        <View style={styles.headerRow}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" />
          ) : (
            <View style={styles.logoPh}>
              <Ionicons name="cube" size={28} color={colors.primary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.greet}>Hello, {user?.full_name || 'User'}</Text>
            <Muted>{settings?.mobile_app_title || 'AKO Stock Take'}</Muted>
          </View>
        </View>
      </Card>

      <View style={styles.statsRow}>
        <StatPill label="In Progress" value={stats?.open_sessions ?? '–'} tone="warning" />
        <StatPill label="Draft" value={stats?.draft_sessions ?? '–'} tone="default" />
        <StatPill label="Submitted" value={stats?.submitted_sessions ?? '–'} tone="success" />
      </View>

      {offlineQueue.length > 0 ? (
        <Card style={styles.offlineCard}>
          <View style={styles.offlineRow}>
            <Ionicons name="cloud-offline" size={22} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineTitle}>{offlineQueue.length} offline count(s)</Text>
              <Muted>Will sync when connection is available</Muted>
            </View>
            <Button title="Sync" variant="secondary" onPress={onRefresh} style={{ minWidth: 80 }} />
          </View>
        </Card>
      ) : null}

      <Text style={styles.section}>Quick Actions</Text>
      <View style={styles.actions}>
        <ActionTile
          icon="play-circle"
          label="Start Stock Take"
          color={colors.primary}
          onPress={() => router.push('/(app)/start')}
        />
        <ActionTile
          icon="barcode"
          label="Open Sessions"
          color={colors.secondary}
          onPress={() => router.push('/(app)/sessions')}
        />
        <ActionTile
          icon="document-text"
          label="Reports"
          color={colors.accent}
          onPress={() => router.push('/(app)/reports')}
        />
        <ActionTile
          icon="settings"
          label="Settings"
          color={colors.textSecondary}
          onPress={() => router.push('/(app)/settings')}
        />
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.section}>My Recent Sessions</Text>
        <Pressable onPress={() => router.push('/(app)/sessions')}>
          <Text style={styles.link}>See all</Text>
        </Pressable>
      </View>

      {recent.length === 0 ? (
        <Card>
          <Muted>No sessions yet. Start a stock take to begin counting.</Muted>
          <Button
            title="Start Stock Take"
            onPress={() => router.push('/(app)/start')}
            style={{ marginTop: spacing.md }}
            icon="add-circle-outline"
          />
        </Card>
      ) : (
        recent.map((s) => (
          <Pressable
            key={s.name}
            onPress={() => router.push(`/(app)/session/${encodeURIComponent(s.name)}`)}
          >
            <Card style={styles.sessionCard}>
              <View style={styles.sessionTop}>
                <Text style={styles.sessionName}>{s.name}</Text>
                <Badge
                  text={s.status}
                  color={statusColor(s.status)}
                  bg={`${statusColor(s.status)}22`}
                />
              </View>
              <Muted>
                {s.warehouse} · {s.posting_date || ''} · {s.items_counted || 0} items
              </Muted>
            </Card>
          </Pressable>
        ))
      )}

      <Card style={styles.flowCard}>
        <Title style={{ fontSize: 16, marginBottom: 8 }}>Process Flow</Title>
        {[
          '1. Preparation – barcodes linked in ERPNext',
          '2. Start Stock Take – select warehouse / store',
          '3. Scan Item barcode on the rack',
          '4. Pull Actual Balance (book) from ERPNext',
          '5. Capture Physical Count + variance reason',
          '6. Submit session',
          '7. Data stored with variance & reason',
          '8. Export & reporting (Excel / CSV)',
        ].map((step) => (
          <Text key={step} style={styles.flowStep}>
            {step}
          </Text>
        ))}
      </Card>
    </ScrollView>
  );
}

function ActionTile({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerCard: { marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 52, height: 52, borderRadius: 12 },
  logoPh: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greet: { fontSize: 18, fontWeight: '700', color: colors.text },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  offlineCard: { marginBottom: spacing.md, borderColor: colors.warning },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  offlineTitle: { fontWeight: '700', color: colors.text },
  section: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.md,
  },
  tile: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tileLabel: { fontWeight: '700', color: colors.text, fontSize: 13 },
  sessionCard: { marginBottom: spacing.sm },
  sessionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sessionName: { fontWeight: '700', color: colors.text, fontSize: 15 },
  flowCard: { marginTop: spacing.md },
  flowStep: { color: colors.textSecondary, fontSize: 13, marginBottom: 4, lineHeight: 18 },
});
