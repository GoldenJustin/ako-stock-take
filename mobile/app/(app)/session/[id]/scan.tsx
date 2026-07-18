import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { Button, Muted } from '@/components/ui';
import { erpApi } from '@/api/client';
import { useAppStore } from '@/store/appStore';
import { colors, radius, spacing } from '@/theme/colors';

export default function ScanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionName = decodeURIComponent(id || '');
  const activeSession = useAppStore((s) => s.activeSession);
  const warehouse = activeSession?.warehouse;

  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState('');
  const [locked, setLocked] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const lastScan = useRef<string>('');
  const lastAt = useRef<number>(0);

  useEffect(() => {
    if (!warehouse) {
      // load session if needed
      erpApi
        .getSession(sessionName)
        .then((s) => useAppStore.getState().setActiveSession(s))
        .catch(() => undefined);
    }
  }, [sessionName, warehouse]);

  const handleBarcode = async (data: string) => {
    const code = (data || '').trim();
    if (!code || locked) return;
    const now = Date.now();
    if (code === lastScan.current && now - lastAt.current < 2500) return;
    lastScan.current = code;
    lastAt.current = now;
    setLocked(true);

    try {
      if (Platform.OS !== 'web') {
        Vibration.vibrate(40);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      /* ignore */
    }

    const wh = warehouse || useAppStore.getState().activeSession?.warehouse;
    if (!wh) {
      Toast.show({ type: 'error', text1: 'Warehouse missing on session' });
      setLocked(false);
      return;
    }

    try {
      const result = await erpApi.scanBarcode(code, wh, sessionName);
      router.replace({
        pathname: `/(app)/session/${encodeURIComponent(sessionName)}/count`,
        params: {
          item_code: result.item_code,
          item_name: result.item_name || '',
          barcode: result.barcode || code,
          actual_balance: String(result.actual_balance ?? 0),
          valuation_rate: String(result.valuation_rate ?? 0),
          uom: result.uom || result.stock_uom || '',
          existing_qty: result.existing_line
            ? String(result.existing_line.physical_qty ?? '')
            : '',
          reason: result.existing_line?.reason_for_variance || '',
          image: result.image || '',
        },
      });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Scan failed', text2: e?.message });
      setTimeout(() => setLocked(false), 1200);
    }
  };

  const onBarcodeScanned = (result: BarcodeScanningResult) => {
    if (result?.data) handleBarcode(result.data);
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <Muted>Requesting camera permission…</Muted>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
        <Text style={styles.permTitle}>Camera permission needed</Text>
        <Muted style={{ textAlign: 'center', marginVertical: 12 }}>
          Allow camera access to scan item barcodes on the rack.
        </Muted>
        <Button title="Grant Permission" onPress={requestPermission} />
        <Button
          title="Enter barcode manually"
          variant="ghost"
          style={{ marginTop: 12 }}
          onPress={() => setShowManual(true)}
        />
        <Button title="Close" variant="ghost" onPress={() => router.back()} style={{ marginTop: 8 }} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: [
            'qr',
            'ean13',
            'ean8',
            'code128',
            'code39',
            'code93',
            'upc_a',
            'upc_e',
            'codabar',
            'itf14',
          ],
        }}
        onBarcodeScanned={locked ? undefined : onBarcodeScanned}
      />

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.roundBtn}>
            <Ionicons name="close" size={22} color={colors.white} />
          </Pressable>
          <Text style={styles.topTitle}>3. Scan Item (Barcode)</Text>
          <Pressable onPress={() => setTorch((v) => !v)} style={styles.roundBtn}>
            <Ionicons name={torch ? 'flash' : 'flash-outline'} size={22} color={colors.white} />
          </Pressable>
        </View>

        <View style={styles.frameWrap}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            <View style={styles.scanLine} />
          </View>
          <Text style={styles.hint}>
            Align barcode inside the frame. System will identify the item and pull Actual Balance.
          </Text>
        </View>

        <View style={styles.bottom}>
          {locked ? <Text style={styles.lockedText}>Looking up item…</Text> : null}
          <Button
            title={showManual ? 'Hide manual entry' : 'Type barcode'}
            variant="ghost"
            onPress={() => setShowManual((v) => !v)}
            style={styles.manualToggle}
          />
          {showManual ? (
            <View style={styles.manualBox}>
              <TextInput
                style={styles.manualInput}
                placeholder="Enter barcode"
                placeholderTextColor={colors.textMuted}
                value={manual}
                onChangeText={setManual}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => handleBarcode(manual)}
              />
              <Button title="Go" onPress={() => handleBarcode(manual)} style={{ minWidth: 80 }} />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const CORNER = 28;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  permTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 12 },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { color: colors.white, fontWeight: '800', fontSize: 16 },
  frameWrap: { alignItems: 'center' },
  frame: {
    width: 280,
    height: 180,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: colors.white,
  },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scanLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: '50%',
    height: 2,
    backgroundColor: colors.barcodeLine,
  },
  hint: {
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: 13,
  },
  bottom: { padding: spacing.md, gap: 10 },
  lockedText: {
    textAlign: 'center',
    color: colors.white,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 8,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  manualToggle: {
    borderColor: 'rgba(255,255,255,0.7)',
  },
  manualBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 8,
  },
  manualInput: {
    flex: 1,
    paddingHorizontal: 10,
    color: colors.text,
    fontSize: 16,
  },
});
