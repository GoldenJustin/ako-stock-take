import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Button, Card, Input, Muted, Title } from '@/components/ui';
import { erpApi } from '@/api/client';
import { useAppStore } from '@/store/appStore';
import { resolveShowSystemBalance, usePrefsStore } from '@/store/prefsStore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing } from '@/theme/colors';
import { calcVariance, formatQty, varianceColor } from '@/utils/format';
import { toUserMessage } from '@/utils/errors';

export default function CaptureCountScreen() {
  const params = useLocalSearchParams<{
    id: string;
    mode?: string;
    item_code?: string;
    item_name?: string;
    barcode?: string;
    actual_balance?: string;
    valuation_rate?: string;
    uom?: string;
    existing_qty?: string;
    reason?: string;
    line_name?: string;
    physical_qty?: string;
    image?: string;
    ts?: string;
  }>();

  const sessionName = decodeURIComponent(params.id || '');
  const settings = useAppStore((s) => s.settings);
  const reasons = useAppStore((s) => s.varianceReasons);
  const activeSession = useAppStore((s) => s.activeSession);
  const updateActiveSession = useAppStore((s) => s.updateActiveSession);
  const enqueueOffline = useAppStore((s) => s.enqueueOffline);
  const showSystemBalancePref = usePrefsStore((s) => s.showSystemBalance);
  const { colors } = useTheme();

  const isSearchMode = params.mode === 'search' && !params.item_code;

  // Key forces full form reset when a new scan arrives (fixes 2nd item sticking on 1st)
  const formKey = `${params.item_code || ''}|${params.barcode || ''}|${params.ts || ''}|${params.line_name || ''}`;

  const [itemCode, setItemCode] = useState(params.item_code || '');
  const [itemName, setItemName] = useState(params.item_name || '');
  const [barcode, setBarcode] = useState(params.barcode || '');
  const [actual, setActual] = useState(Number(params.actual_balance || 0));
  const [rate, setRate] = useState(Number(params.valuation_rate || 0));
  const [uom, setUom] = useState(params.uom || '');
  const [image, setImage] = useState(params.image || '');
  const [qty, setQty] = useState(params.physical_qty || params.existing_qty || '');
  const [reason, setReason] = useState(params.reason || '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Re-hydrate form whenever scan params change
  useEffect(() => {
    setItemCode(params.item_code || '');
    setItemName(params.item_name || '');
    setBarcode(params.barcode || '');
    setActual(Number(params.actual_balance || 0));
    setRate(Number(params.valuation_rate || 0));
    setUom(params.uom || '');
    setImage(params.image || '');
    setQty(params.physical_qty || params.existing_qty || '');
    setReason(params.reason || '');
    setNotes('');
  }, [formKey]);

  const variance = useMemo(() => calcVariance(Number(qty || 0), actual), [qty, actual]);
  const requireReason = !!settings?.require_variance_reason;
  const showBalance = resolveShowSystemBalance(
    settings?.show_system_balance_on_device,
    showSystemBalancePref
  );
  // Blind count: hide variance numbers too when balance is hidden (prevents reverse-engineering)
  const showVariance = showBalance;
  const reasonNeeded = requireReason && variance !== 0;

  useEffect(() => {
    if (!activeSession || activeSession.name !== sessionName) {
      erpApi
        .getSession(sessionName)
        .then((s) => useAppStore.getState().setActiveSession(s))
        .catch(() => undefined);
    }
  }, [sessionName, activeSession]);

  const pickItem = async (item: any) => {
    const wh = activeSession?.warehouse;
    if (!wh) {
      Toast.show({ type: 'error', text1: 'Session warehouse missing' });
      return;
    }
    try {
      const code = item.barcode || item.item_code;
      const scanned = await erpApi.scanBarcode(String(code), wh, sessionName);
      setItemCode(scanned.item_code);
      setItemName(scanned.item_name || '');
      setBarcode(scanned.barcode || '');
      setActual(Number(scanned.actual_balance || 0));
      setRate(Number(scanned.valuation_rate || 0));
      setUom(scanned.uom || scanned.stock_uom || '');
      setImage(scanned.image || '');
      setQty(
        scanned.existing_line ? String(scanned.existing_line.physical_qty ?? '') : ''
      );
      setReason(scanned.existing_line?.reason_for_variance || '');
      setNotes('');
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Item lookup failed',
        text2: toUserMessage(e, e?.message),
      });
    }
  };

  const onSearch = async (text: string) => {
    setQuery(text);
    if (text.trim().length < 1) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const rows = await erpApi.searchItems(text.trim(), activeSession?.warehouse, 25);
      setResults(rows || []);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Search failed', text2: toUserMessage(e) });
    } finally {
      setSearching(false);
    }
  };

  const save = async (then: 'session' | 'scan' = 'session') => {
    if (!itemCode) {
      Toast.show({ type: 'error', text1: 'No item selected' });
      return false;
    }
    if (qty === '' || qty === null || qty === undefined) {
      Toast.show({ type: 'error', text1: 'Enter physical quantity' });
      return false;
    }
    const physical = Number(qty);
    if (Number.isNaN(physical)) {
      Toast.show({ type: 'error', text1: 'Invalid quantity' });
      return false;
    }
    if (!settings?.allow_negative_stock_count && physical < 0) {
      Toast.show({ type: 'error', text1: 'Negative count not allowed' });
      return false;
    }
    if (reasonNeeded && !reason) {
      Toast.show({
        type: 'error',
        text1: 'Reason required',
        text2: 'Variance is not zero — select a reason',
      });
      return false;
    }

    setSaving(true);
    try {
      const session = await erpApi.captureCount({
        session_name: sessionName,
        item_code: itemCode,
        physical_qty: physical,
        barcode: barcode || undefined,
        reason_for_variance: reason || undefined,
        reason_notes: notes || undefined,
        accumulate: 0,
      });
      updateActiveSession(session);
      Toast.show({
        type: 'success',
        text1: 'Count saved',
        text2: itemCode,
      });
      if (then === 'scan') {
        router.replace(`/(app)/session/${encodeURIComponent(sessionName)}/scan`);
      } else {
        router.replace(`/(app)/session/${encodeURIComponent(sessionName)}`);
      }
      return true;
    } catch (e: any) {
      if (settings?.enable_offline_sync !== 0) {
        await enqueueOffline({
          id: `${Date.now()}-${itemCode}`,
          session_name: sessionName,
          item_code: itemCode,
          physical_qty: physical,
          barcode,
          reason_for_variance: reason,
          reason_notes: notes,
          scanned_at: new Date().toISOString(),
          accumulate: 0,
        });
        Toast.show({
          type: 'info',
          text1: 'Saved offline',
          text2: 'Will sync when you are back online',
        });
        if (then === 'scan') {
          router.replace(`/(app)/session/${encodeURIComponent(sessionName)}/scan`);
        } else {
          router.replace(`/(app)/session/${encodeURIComponent(sessionName)}`);
        }
        return true;
      }
      Toast.show({ type: 'error', text1: 'Save failed', text2: toUserMessage(e) });
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (isSearchMode && !itemCode) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Card style={{ margin: spacing.md }}>
          <Title style={{ fontSize: 18 }}>Search Item</Title>
          <Muted>Use when the barcode cannot be scanned.</Muted>
          <Input
            label="Item code / name / barcode"
            value={query}
            onChangeText={onSearch}
            placeholder="Type to search…"
            autoFocus
          />
        </Card>
        <FlatList
          data={results}
          keyExtractor={(item, i) => item.item_code + String(i)}
          contentContainerStyle={{ padding: spacing.md }}
          ListEmptyComponent={
            <Muted style={{ textAlign: 'center' }}>
              {searching ? 'Searching…' : 'No results'}
            </Muted>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => pickItem(item)}>
              <Card style={{ marginBottom: spacing.sm }}>
                <Text style={[styles.itemCode, { color: colors.text }]}>{item.item_code}</Text>
                <Muted>{item.item_name}</Muted>
                {showBalance && item.actual_balance != null ? (
                  <Muted>Balance: {formatQty(item.actual_balance)}</Muted>
                ) : null}
              </Card>
            </Pressable>
          )}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      key={formKey}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        <Card>
          <View style={styles.itemHeader}>
            {image ? (
              <Image source={{ uri: image }} style={styles.image} />
            ) : (
              <View style={[styles.imagePh, { backgroundColor: colors.infoBg }]}>
                <Ionicons name="cube-outline" size={28} color={colors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemCode, { color: colors.text }]}>{itemCode}</Text>
              <Text style={[styles.itemName, { color: colors.text }]}>{itemName}</Text>
              {barcode ? <Muted>Barcode: {barcode}</Muted> : null}
              {uom ? <Muted>UOM: {uom}</Muted> : null}
            </View>
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Title style={{ fontSize: 16, marginBottom: spacing.sm }}>Physical count</Title>

          {showBalance ? (
            <View
              style={[
                styles.balanceBox,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Muted>System balance (book)</Muted>
                <Text style={[styles.balanceValue, { color: colors.text }]}>
                  {formatQty(actual)}
                </Text>
              </View>
              <Ionicons name="lock-closed" size={18} color={colors.lock} />
            </View>
          ) : (
            <View
              style={[
                styles.blindBanner,
                { backgroundColor: colors.warningBg, borderColor: colors.warning },
              ]}
            >
              <Ionicons name="eye-off-outline" size={18} color={colors.warning} />
              <Text style={{ flex: 1, color: colors.warning, fontWeight: '600', fontSize: 12 }}>
                Blind count — system balance is hidden so you count what is on the shelf.
              </Text>
            </View>
          )}

          <Input
            label="Physical quantity *"
            value={qty}
            onChangeText={setQty}
            keyboardType="decimal-pad"
            placeholder="0"
            autoFocus
          />

          {showVariance ? (
            <View style={[styles.varianceBox, { backgroundColor: colors.infoBg }]}>
              <Text style={[styles.varLabel, { color: colors.textSecondary }]}>
                Variance = Physical − System
              </Text>
              <Text style={[styles.varValue, { color: varianceColor(variance) }]}>
                {variance > 0 ? '+' : ''}
                {formatQty(variance)}
                {rate ? `  ·  ${formatQty(variance * rate, 2)}` : ''}
              </Text>
            </View>
          ) : null}

          {reasonNeeded ? (
            <View style={[styles.reasonNotice, { backgroundColor: colors.warningBg }]}>
              <Ionicons name="alert-circle" size={18} color={colors.warning} />
              <Text style={{ flex: 1, color: colors.warning, fontWeight: '600', fontSize: 12 }}>
                Pick a reason — variance is not zero.
              </Text>
            </View>
          ) : null}

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Reason for variance{reasonNeeded ? ' *' : ''}
          </Text>
          <View style={styles.reasonList}>
            {reasons.map((r) => {
              const selected = reason === r.name || reason === r.reason_code;
              return (
                <Pressable
                  key={r.name}
                  onPress={() => setReason(r.name)}
                  style={[
                    styles.reasonChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.surfaceMuted,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: selected ? colors.white : colors.textSecondary,
                    }}
                  >
                    {r.reason_name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Input
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Extra detail…"
            multiline
          />

          <View style={{ gap: 10, marginTop: spacing.sm }}>
            <Button
              title="Save & back to list"
              onPress={() => save('session')}
              loading={saving}
              icon="save-outline"
            />
            <Button
              title="Save & scan next"
              variant="secondary"
              onPress={() => save('scan')}
              loading={saving}
              icon="barcode-outline"
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() =>
                router.replace(`/(app)/session/${encodeURIComponent(sessionName)}`)
              }
            />
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  itemHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  image: { width: 64, height: 64, borderRadius: radius.md },
  imagePh: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCode: { fontWeight: '800', fontSize: 16 },
  itemName: { fontWeight: '600', marginTop: 2 },
  balanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  balanceValue: { fontSize: 28, fontWeight: '800' },
  blindBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  varianceBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  varLabel: { fontSize: 12, fontWeight: '600' },
  varValue: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  reasonNotice: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  reasonList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
  },
});
