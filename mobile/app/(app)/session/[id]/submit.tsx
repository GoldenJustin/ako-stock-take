import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Button, Card, LoadingBlock, Muted, StatPill, Title } from '@/components/ui';
import { erpApi } from '@/api/client';
import { useAppStore } from '@/store/appStore';
import { colors, spacing } from '@/theme/colors';
import type { StockTakeSession } from '@/types';
import { formatQty } from '@/utils/format';

export default function SubmitSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionName = decodeURIComponent(id || '');
  const updateActiveSession = useAppStore((s) => s.updateActiveSession);
  const settings = useAppStore((s) => s.settings);

  const [session, setSession] = useState<StockTakeSession | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, sum] = await Promise.all([
          erpApi.getSession(sessionName),
          erpApi.getSummary(sessionName),
        ]);
        setSession(s);
        setSummary(sum);
      } catch (e: any) {
        Toast.show({ type: 'error', text1: 'Load failed', text2: e?.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionName]);

  const exceptions = summary?.exceptions || [];
  const canSubmit =
    session &&
    session.docstatus === 0 &&
    (session.items || []).length > 0 &&
    exceptions.length === 0;

  const onSubmit = async () => {
    if (!canSubmit) {
      Toast.show({
        type: 'error',
        text1: 'Cannot submit',
        text2:
          exceptions.length > 0
            ? 'Resolve variance reasons first'
            : 'Add at least one counted item',
      });
      return;
    }
    setSubmitting(true);
    try {
      const s = await erpApi.submitSession(sessionName);
      updateActiveSession(s);
      setSession(s);
      Toast.show({ type: 'success', text1: 'Stock Take Submitted', text2: s.name });
      router.replace(`/(app)/session/${encodeURIComponent(sessionName)}/summary`);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Submit failed', text2: e?.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !session) return <LoadingBlock />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
    >
      <Card style={styles.successHero}>
        <Ionicons name="checkmark-circle" size={56} color={colors.success} />
        <Title style={{ marginTop: 8 }}>6. Submit</Title>
        <Muted style={{ textAlign: 'center' }}>
          Review totals, then submit. Data will be stored with Actual Balance, Physical Quantity,
          Variance and Reason.
        </Muted>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={styles.h}>{session.name}</Text>
        <Muted>
          {session.warehouse} · {session.company}
        </Muted>
        <View style={styles.stats}>
          <StatPill label="Items" value={session.total_items || 0} />
          <StatPill label="Variances" value={session.items_with_variance || 0} tone="warning" />
          <StatPill
            label="Net Var Qty"
            value={formatQty(session.total_variance_qty)}
            tone={session.total_variance_qty < 0 ? 'danger' : 'success'}
          />
        </View>
        <Muted style={{ marginTop: spacing.sm }}>
          Variance value: {formatQty(session.total_variance_value, 2)}
        </Muted>
        {settings?.create_stock_reconciliation ? (
          <Muted style={{ marginTop: 6 }}>
            On submit, ERPNext may create a Stock Reconciliation (per settings).
          </Muted>
        ) : null}
      </Card>

      {exceptions.length > 0 ? (
        <Card style={{ marginTop: spacing.md, borderColor: colors.danger }}>
          <Text style={[styles.h, { color: colors.danger }]}>
            Exceptions ({exceptions.length})
          </Text>
          <Muted>
            These lines have variance without a reason. Fix them before submit.
          </Muted>
          {exceptions.slice(0, 10).map((e: any) => (
            <Text key={e.item_code} style={styles.exLine}>
              • {e.item_code} — var {formatQty(e.variance)}
            </Text>
          ))}
          <Button
            title="Back to Session"
            variant="ghost"
            style={{ marginTop: spacing.sm }}
            onPress={() =>
              router.replace(`/(app)/session/${encodeURIComponent(sessionName)}`)
            }
          />
        </Card>
      ) : null}

      <View style={{ gap: 10, marginTop: spacing.lg }}>
        <Button
          title={session.docstatus === 1 ? 'Already Submitted' : 'Confirm Submit'}
          variant="success"
          icon="cloud-upload-outline"
          onPress={onSubmit}
          loading={submitting}
          disabled={session.docstatus === 1 || !canSubmit}
        />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  successHero: { alignItems: 'center', paddingVertical: spacing.lg },
  h: { fontWeight: '800', fontSize: 16, color: colors.text },
  stats: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  exLine: { marginTop: 6, color: colors.text, fontWeight: '600', fontSize: 13 },
});
