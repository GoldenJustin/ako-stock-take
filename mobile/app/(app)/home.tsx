import React, { useCallback, useEffect, useState } from 'react';
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
import { usePrefsStore } from '@/store/prefsStore';
import { erpApi } from '@/api/client';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing } from '@/theme/colors';
import type { DashboardStats, SessionListItem } from '@/types';
import { statusColor } from '@/utils/format';
import { toUserMessage } from '@/utils/errors';

export default function HomeScreen() {
  const user = useAppStore((s) => s.user);
  const settings = useAppStore((s) => s.settings);
  const offlineQueue = useAppStore((s) => s.offlineQueue);
  const flushOfflineQueue = useAppStore((s) => s.flushOfflineQueue);
  const refreshBootstrap = useAppStore((s) => s.refreshBootstrap);
  const prefs = usePrefsStore();
  const { colors } = useTheme();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<SessionListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(true);

  const load = useCallback(async () => {
    try {
      const [d, sessions] = await Promise.all([
        erpApi.getDashboardStats(settings?.company || undefined),
        erpApi.listSessions({ limit: 5, mine_only: 1 }),
      ]);
      setStats(d);
      setRecent(sessions || []);
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not load home',
        text2: toUserMessage(e),
      });
    }
  }, [settings?.company]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Auto-sync offline queue when network comes back
  useEffect(() => {
    let unsub: undefined | (() => void);
    (async () => {
      try {
        const NetInfo = (await import('@react-native-community/netinfo')).default;
        unsub = NetInfo.addEventListener((state) => {
          const isOn = !!(state.isConnected && state.isInternetReachable !== false);
          setOnline(isOn);
          if (isOn && prefs.autoSyncOffline && useAppStore.getState().offlineQueue.length) {
            flushOfflineQueue()
              .then((n) => {
                if (n) Toast.show({ type: 'success', text1: `Auto-synced ${n} count(s)` });
              })
              .catch(() => undefined);
          }
        });
      } catch {
        setOnline(true);
      }
    })();
    return () => {
      if (unsub) unsub();
    };
  }, [prefs.autoSyncOffline, flushOfflineQueue]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshBootstrap();
      if (offlineQueue.length) {
        const n = await flushOfflineQueue();
        if (n) Toast.show({ type: 'success', text1: `Synced ${n} offline count(s)` });
      }
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const logo = settings?.app_logo;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Card style={styles.headerCard}>
        <View style={styles.headerRow}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" />
          ) : (
            <View style={[styles.logoPh, { backgroundColor: colors.infoBg }]}>
              <Ionicons name="cube" size={28} color={colors.primary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.greet, { color: colors.text }]}>
              Hello, {user?.full_name || 'User'}
            </Text>
            <Muted>{settings?.mobile_app_title || 'AKO Stock Take'}</Muted>
            <Muted>{online ? 'Online' : 'Offline mode'}</Muted>
          </View>
        </View>
      </Card>

      <View style={styles.statsRow}>
        <StatPill label="In Progress" value={stats?.open_sessions ?? '–'} tone="warning" />
        <StatPill label="Draft" value={stats?.draft_sessions ?? '–'} tone="default" />
        <StatPill label="Submitted" value={stats?.submitted_sessions ?? '–'} tone="success" />
      </View>

      {offlineQueue.length > 0 ? (
        <Card style={[styles.offlineCard, { borderColor: colors.warning }]}>
          <View style={styles.offlineRow}>
            <Ionicons name="cloud-offline" size={22} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.offlineTitle, { color: colors.text }]}>
                {offlineQueue.length} offline count(s)
              </Text>
              <Muted>
                {prefs.autoSyncOffline
                  ? 'Will sync automatically when online'
                  : 'Tap Sync to upload'}
              </Muted>
            </View>
            <Button title="Sync" variant="secondary" onPress={onRefresh} style={{ minWidth: 80 }} />
          </View>
        </Card>
      ) : null}

      <Text style={[styles.section, { color: colors.text }]}>Quick actions</Text>
      <View style={styles.actions}>
        <ActionTile
          icon="play-circle"
          label="Start stock take"
          color={colors.primary}
          surface={colors.surface}
          border={colors.border}
          onPress={() => router.push('/(app)/start')}
        />
        <ActionTile
          icon="list"
          label="Sessions"
          color={colors.secondary}
          surface={colors.surface}
          border={colors.border}
          onPress={() => router.push('/(app)/sessions')}
        />
        {prefs.showHomeQuickReports ? (
          <ActionTile
            icon="bar-chart"
            label="Reports"
            color={colors.accent}
            surface={colors.surface}
            border={colors.border}
            onPress={() => router.push('/(app)/reports')}
          />
        ) : null}
        <ActionTile
          icon="settings"
          label="Settings"
          color={colors.textSecondary}
          surface={colors.surface}
          border={colors.border}
          onPress={() => router.push('/(app)/settings')}
        />
      </View>

      <View style={styles.sectionRow}>
        <Text style={[styles.section, { color: colors.text }]}>My recent sessions</Text>
        <Pressable onPress={() => router.push('/(app)/sessions')}>
          <Text style={[styles.link, { color: colors.primary }]}>See all</Text>
        </Pressable>
      </View>

      {recent.length === 0 ? (
        <Card>
          <Muted>No sessions yet. Start a stock take to begin counting.</Muted>
          <Button
            title="Start stock take"
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
                <Text style={[styles.sessionName, { color: colors.text }]}>{s.name}</Text>
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

      {prefs.showHomeProcessFlow ? (
        <Card style={{ marginTop: spacing.md }}>
          <Title style={{ fontSize: 16, marginBottom: 8 }}>How it works</Title>
          {[
            'Scan item barcode on the rack',
            'Enter physical quantity',
            'Give a reason if variance ≠ 0',
            'Submit the session when done',
          ].map((step) => (
            <Text key={step} style={{ color: colors.textSecondary, marginBottom: 4, fontSize: 13 }}>
              • {step}
            </Text>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function ActionTile({
  icon,
  label,
  color,
  surface,
  border,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  surface: string;
  border: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tile, { backgroundColor: surface, borderColor: border }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <Text style={[styles.tileLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerCard: { marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 52, height: 52, borderRadius: 12 },
  logoPh: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greet: { fontSize: 18, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  offlineCard: { marginBottom: spacing.md, borderWidth: 1 },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  offlineTitle: { fontWeight: '700' },
  section: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: { fontWeight: '700', fontSize: 13 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.md,
  },
  tile: {
    width: '47%',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tileLabel: { fontWeight: '700', fontSize: 13 },
  sessionCard: { marginBottom: spacing.sm },
  sessionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sessionName: { fontWeight: '700', fontSize: 15 },
});
