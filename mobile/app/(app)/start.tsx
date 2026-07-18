import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Button, Card, Muted, Title } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { erpApi } from '@/api/client';
import { colors, radius, spacing } from '@/theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/config';

export default function StartStockTakeScreen() {
  const warehouses = useAppStore((s) => s.warehouses);
  const companies = useAppStore((s) => s.companies);
  const settings = useAppStore((s) => s.settings);
  const setActiveSession = useAppStore((s) => s.setActiveSession);

  const [company, setCompany] = useState(settings?.company || companies[0]?.name || '');
  const [warehouse, setWarehouse] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [resumeExisting, setResumeExisting] = useState(true);

  const filtered = useMemo(() => {
    let list = warehouses;
    if (company) list = list.filter((w) => !w.company || w.company === company);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          (w.warehouse_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [warehouses, company, query]);

  const start = async () => {
    if (!warehouse) {
      Toast.show({ type: 'error', text1: 'Select a warehouse / store' });
      return;
    }
    setLoading(true);
    try {
      const device_info = [Platform.OS, String(Platform.Version)].join(' · ');

      const session = resumeExisting
        ? await erpApi.openOrCreateSession({ warehouse, company: company || undefined, device_info })
        : await erpApi.createSession({ warehouse, company: company || undefined, device_info });

      setActiveSession(session);
      await AsyncStorage.setItem(STORAGE_KEYS.lastWarehouse, warehouse);
      if (company) await AsyncStorage.setItem(STORAGE_KEYS.lastCompany, company);

      Toast.show({
        type: 'success',
        text1: session.status === 'In Progress' ? 'Session ready' : 'Session created',
        text2: session.name,
      });
      router.push(`/(app)/session/${encodeURIComponent(session.name)}`);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Could not start session', text2: e?.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={{ margin: spacing.md, marginBottom: spacing.sm }}>
        <Title style={{ fontSize: 18 }}>2. Start Stock Take</Title>
        <Muted style={{ marginTop: 4 }}>
          Log in is complete. Select Store / Warehouse and create or open a session.
        </Muted>

        {companies.length > 1 ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.label}>Company</Text>
            <View style={styles.chipRow}>
              {companies.map((c) => (
                <Pressable
                  key={c.name}
                  onPress={() => {
                    setCompany(c.name);
                    setWarehouse('');
                  }}
                  style={[styles.chip, company === c.name && styles.chipOn]}
                >
                  <Text style={[styles.chipText, company === c.name && styles.chipTextOn]}>
                    {c.company_name || c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={[styles.label, { marginTop: spacing.md }]}>Search warehouse</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Type warehouse name…"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <Pressable style={styles.checkRow} onPress={() => setResumeExisting((v) => !v)}>
          <Ionicons
            name={resumeExisting ? 'checkbox' : 'square-outline'}
            size={22}
            color={colors.primary}
          />
          <Text style={styles.checkText}>Resume my In-Progress session if one exists</Text>
        </Pressable>
      </Card>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.name}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 120 }}
        ListEmptyComponent={
          <Card>
            <Muted>
              No warehouses found. Ensure the ERPNext user can read Warehouse and the AKO Stock
              Take app is installed.
            </Muted>
          </Card>
        }
        renderItem={({ item }) => {
          const selected = warehouse === item.name;
          return (
            <Pressable onPress={() => setWarehouse(item.name)}>
              <Card style={selected ? { ...styles.whCard, ...styles.whSelected } : styles.whCard}>
                <View style={styles.whRow}>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={selected ? colors.primary : colors.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.whName}>{item.warehouse_name || item.name}</Text>
                    <Muted>
                      {item.name}
                      {item.company ? ` · ${item.company}` : ''}
                    </Muted>
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        <Button
          title={resumeExisting ? 'Open / Create Session' : 'Create New Session'}
          onPress={start}
          loading={loading}
          icon="arrow-forward-circle"
          disabled={!warehouse}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextOn: { color: colors.white },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md },
  checkText: { flex: 1, color: colors.textSecondary, fontSize: 13 },
  whCard: { marginBottom: spacing.sm },
  whSelected: { borderColor: colors.primary, borderWidth: 2 },
  whRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  whName: { fontWeight: '700', color: colors.text, fontSize: 15 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
