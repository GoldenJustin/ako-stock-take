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
import { colors, radius, spacing } from '@/theme/colors';
import { calcVariance, formatQty, varianceColor } from '@/utils/format';

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
  }>();

  const sessionName = decodeURIComponent(params.id || '');
  const settings = useAppStore((s) => s.settings);
  const reasons = useAppStore((s) => s.varianceReasons);
  const activeSession = useAppStore((s) => s.activeSession);
  const updateActiveSession = useAppStore((s) => s.updateActiveSession);
  const enqueueOffline = useAppStore((s) => s.enqueueOffline);

  const isSearchMode = params.mode === 'search' && !params.item_code;

  const [itemCode, setItemCode] = useState(params.item_code || '');
  const [itemName, setItemName] = useState(params.item_name || '');
  const [barcode, setBarcode] = useState(params.barcode || '');
  const [actual, setActual] = useState(Number(params.actual_balance || 0));
  const [rate, setRate] = useState(Number(params.valuation_rate || 0));
  const [uom, setUom] = useState(params.uom || '');
  const [image, setImage] = useState(params.image || '');
  const [qty, setQty] = useState(
    params.physical_qty || params.existing_qty || ''
  );
  const [reason, setReason] = useState(params.reason || '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const variance = useMemo(() => calcVariance(Number(qty || 0), actual), [qty, actual]);
  const requireReason = !!settings?.require_variance_reason;
  const showBalance = settings?.show_system_balance_on_device !== 0;
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
      if (scanned.existing_line) {
        setQty(String(scanned.existing_line.physical_qty ?? ''));
        setReason(scanned.existing_line.reason_for_variance || '');
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Item lookup failed', text2: e?.message });
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
      Toast.show({ type: 'error', text1: 'Search failed', text2: e?.message });
    } finally {
      setSearching(false);
    }
  };

  const save = async () => {
    if (!itemCode) {
      Toast.show({ type: 'error', text1: 'No item selected' });
      return;
    }
    if (qty === '' || qty === null || qty === undefined) {
      Toast.show({ type: 'error', text1: 'Enter physical quantity' });
      return;
    }
    const physical = Number(qty);
    if (Number.isNaN(physical)) {
      Toast.show({ type: 'error', text1: 'Invalid quantity' });
      return;
    }
    if (!settings?.allow_negative_stock_count && physical < 0) {
      Toast.show({ type: 'error', text1: 'Negative count not allowed' });
      return;
    }
    if (reasonNeeded && !reason) {
      Toast.show({
        type: 'error',
        text1: 'Reason required',
        text2: 'Variance is not zero — select a reason',
      });
      return;
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
        text2: `${itemCode} · var ${formatQty(variance)}`,
      });
      router.replace(`/(app)/session/${encodeURIComponent(sessionName)}`);
    } catch (e: any) {
      // Offline queue fallback
      if (settings?.enable_offline_sync) {
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
          text2: e?.message || 'Will sync later',
        });
        router.replace(`/(app)/session/${encodeURIComponent(sessionName)}`);
      } else {
        Toast.show({ type: 'error', text1: 'Save failed', text2: e?.message });
      }
    } finally {
      setSaving(false);
    }
  };

  if (isSearchMode && !itemCode) {
    return (
      <View style={styles.container}>
        <Card style={{ margin: spacing.md }}>
          <Title style={{ fontSize: 18 }}>Search Item</Title>
          <Muted>Manual search when barcode cannot be scanned.</Muted>
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
                <Text style={styles.itemCode}>{item.item_code}</Text>
                <Muted>{item.item_name}</Muted>
                {item.actual_balance != null ? (
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        <Card>
          <View style={styles.itemHeader}>
            {image ? (
              <Image source={{ uri: image }} style={styles.image} />
            ) : (
              <View style={styles.imagePh}>
                <Ionicons name="cube-outline" size={28} color={colors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.itemCode}>{itemCode}</Text>
              <Text style={styles.itemName}>{itemName}</Text>
              {barcode ? <Muted>Barcode: {barcode}</Muted> : null}
              {uom ? <Muted>UOM: {uom}</Muted> : null}
            </View>
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Title style={{ fontSize: 16, marginBottom: spacing.sm }}>
            5. Capture Physical Count
          </Title>

          {showBalance ? (
            <View style={styles.balanceBox}>
              <View style={{ flex: 1 }}>
                <Muted>Actual Balance (System)</Muted>
                <Text style={styles.balanceValue}>{formatQty(actual)}</Text>
              </View>
              <Ionicons name="lock-closed" size={18} color={colors.lock} />
            </View>
          ) : (
            <Muted style={{ marginBottom: spacing.sm }}>
              System balance is hidden by settings (still used for variance).
            </Muted>
          )}

          <Input
            label="Physical Quantity (Count) *"
            value={qty}
            onChangeText={setQty}
            keyboardType="decimal-pad"
            placeholder="0"
            autoFocus
          />

          <View style={styles.varianceBox}>
            <Text style={styles.varLabel}>
              Variance = Physical Count − Actual Balance
            </Text>
            <Text style={[styles.varValue, { color: varianceColor(variance) }]}>
              {variance > 0 ? '+' : ''}
              {formatQty(variance)}
              {rate ? `  ·  value ${formatQty(variance * rate, 2)}` : ''}
            </Text>
          </View>

          {reasonNeeded ? (
            <View style={styles.reasonNotice}>
              <Ionicons name="alert-circle" size={18} color={colors.warning} />
              <Text style={styles.reasonNoticeText}>
                Reason is mandatory when variance is not equal to 0.
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>Reason for Variance{reasonNeeded ? ' *' : ''}</Text>
          <View style={styles.reasonList}>
            {reasons.map((r) => {
              const selected = reason === r.name || reason === r.reason_code;
              return (
                <Pressable
                  key={r.name}
                  onPress={() => setReason(r.name)}
                  style={[styles.reasonChip, selected && styles.reasonChipOn]}
                >
                  <Text style={[styles.reasonText, selected && styles.reasonTextOn]}>
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
            placeholder="Additional details…"
            multiline
          />

          <View style={{ gap: 10, marginTop: spacing.sm }}>
            <Button title="Save Count" onPress={save} loading={saving} icon="save-outline" />
            <Button
              title="Scan Next"
              variant="secondary"
              onPress={async () => {
                if (itemCode && qty !== '') {
                  await save();
                }
                router.replace(`/(app)/session/${encodeURIComponent(sessionName)}/scan`);
              }}
              icon="barcode-outline"
            />
            <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  itemHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  image: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  imagePh: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCode: { fontWeight: '800', fontSize: 16, color: colors.text },
  itemName: { fontWeight: '600', color: colors.text, marginTop: 2 },
  balanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceValue: { fontSize: 28, fontWeight: '800', color: colors.text },
  varianceBox: {
    backgroundColor: colors.infoBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  varLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  varValue: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  reasonNotice: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: colors.warningBg,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  reasonNoticeText: { flex: 1, color: colors.warning, fontWeight: '600', fontSize: 12 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  reasonList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  reasonText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  reasonTextOn: { color: colors.white },
});
