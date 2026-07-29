import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { Button, Muted } from '@/components/ui';
import { erpApi } from '@/api/client';
import { useAppStore } from '@/store/appStore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing } from '@/theme/colors';
import { toUserMessage } from '@/utils/errors';

export default function ScanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionName = decodeURIComponent(id || '');
  const activeSession = useAppStore((s) => s.activeSession);
  const warehouse = activeSession?.warehouse;
  const { colors } = useTheme();

  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState('');
  const [locked, setLocked] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const lastScan = useRef<string>('');
  const lastAt = useRef<number>(0);
  const busyRef = useRef(false);

  // Reset scanner every time this screen is focused (2nd/3rd scan was stuck locked)
  useFocusEffect(
    useCallback(() => {
      busyRef.current = false;
      setLocked(false);
      lastScan.current = '';
      lastAt.current = 0;
      setManual('');
      // remount camera so barcode listener is fresh after navigation
      setCameraKey((k) => k + 1);
      return () => {
        busyRef.current = true;
        setLocked(true);
      };
    }, [])
  );

  useEffect(() => {
    if (!warehouse) {
      erpApi
        .getSession(sessionName)
        .then((s) => useAppStore.getState().setActiveSession(s))
        .catch(() => undefined);
    }
  }, [sessionName, warehouse]);

  const handleBarcode = async (data: string) => {
    const code = (data || '').trim();
    if (!code || busyRef.current || locked) return;

    const now = Date.now();
    // Only debounce identical codes briefly — different items must always pass
    if (code === lastScan.current && now - lastAt.current < 1800) return;

    lastScan.current = code;
    lastAt.current = now;
    busyRef.current = true;
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
      busyRef.current = false;
      setLocked(false);
      return;
    }

    try {
      const result = await erpApi.scanBarcode(code, wh, sessionName);
      // push (not replace) so back returns to session list cleanly
      router.push({
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
          ts: String(Date.now()), // bust param cache between scans
        },
      });
      // unlock will happen on next focus; keep locked while navigating
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Scan failed',
        text2: toUserMessage(e, e?.message || 'Try again'),
      });
      setTimeout(() => {
        busyRef.current = false;
        setLocked(false);
        lastScan.current = '';
      }, 900);
    }
  };

  const onBarcodeScanned = (result: BarcodeScanningResult) => {
    if (result?.data) handleBarcode(result.data);
  };

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Muted>Requesting camera permission…</Muted>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.permTitle, { color: colors.text }]}>Camera permission needed</Text>
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
        key={`cam-${cameraKey}`}
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
        onBarcodeScanned={locked || busyRef.current ? undefined : onBarcodeScanned}
      />

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.replace(`/(app)/session/${encodeURIComponent(sessionName)}`)}
            style={styles.roundBtn}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.topTitle}>Scan barcode</Text>
          <Pressable onPress={() => setTorch((v) => !v)} style={styles.roundBtn}>
            <Ionicons name={torch ? 'flash' : 'flash-outline'} size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.frameWrap}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            <View style={[styles.scanLine, { backgroundColor: colors.barcodeLine }]} />
          </View>
          <Text style={styles.hint}>
            Point at the barcode. After you save a count, come back here for the next item.
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
            <View style={[styles.manualBox, { backgroundColor: colors.surface }]}>
              <TextInput
                style={[styles.manualInput, { color: colors.text }]}
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
  },
  permTitle: { fontSize: 18, fontWeight: '800', marginTop: 12 },
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
  topTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  frameWrap: { alignItems: 'center' },
  frame: { width: 280, height: 180, position: 'relative' },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#fff',
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
    color: '#fff',
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 8,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  manualToggle: { borderColor: 'rgba(255,255,255,0.7)' },
  manualBox: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: radius.md,
    padding: 8,
  },
  manualInput: { flex: 1, paddingHorizontal: 10, fontSize: 16 },
});
