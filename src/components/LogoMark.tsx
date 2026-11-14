import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

type Props = { size?: number; showWordmark?: boolean };

/** NAMA signature: architectural N monogram with a teal-to-violet orbit. */
export default function LogoMark({ size = 88, showWordmark = false }: Props) {
  const stroke = Math.max(7, size * 0.13);
  return (
    <View style={styles.wrap}>
      <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.28 }]}>
        <View style={[styles.glow, { borderRadius: size * 0.28 }]} />
        <View style={[styles.bar, styles.leftBar, { width: stroke, height: size * 0.62, left: size * 0.22, top: size * 0.18, borderRadius: stroke }]} />
        <View style={[styles.bar, styles.diagonal, { width: stroke, height: size * 0.83, left: size * 0.44, top: size * 0.08, borderRadius: stroke }]} />
        <View style={[styles.bar, styles.rightBar, { width: stroke, height: size * 0.62, right: size * 0.2, top: size * 0.18, borderRadius: stroke }]} />
        <View style={[styles.window, { width: size * 0.12, height: size * 0.12, left: size * 0.22, bottom: size * 0.2 }]} />
        <View style={[styles.window, { width: size * 0.12, height: size * 0.12, left: size * 0.38, bottom: size * 0.2 }]} />
        <View style={[styles.orbit, { width: size * 0.78, height: size * 0.18, bottom: size * 0.08, left: size * 0.1, borderRadius: size }]} />
      </View>
      {showWordmark && (
        <View style={styles.wordRow}>
          <Text style={styles.wordEn}>NAMA</Text>
          <Text style={styles.wordFa}>SMART REAL ESTATE</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  mark: {
    backgroundColor: '#0A1930',
    borderWidth: 1,
    borderColor: 'rgba(64, 205, 245, 0.48)',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#287EF5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 22,
    elevation: 12,
  },
  glow: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(31, 96, 176, 0.12)' },
  bar: { position: 'absolute', backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.8, shadowRadius: 8, elevation: 5 },
  leftBar: { backgroundColor: '#25C9F4' },
  diagonal: { backgroundColor: '#8B5CF6', transform: [{ rotate: '-43deg' }] },
  rightBar: { backgroundColor: '#19C7A5' },
  window: { position: 'absolute', backgroundColor: '#EAF8FF', borderRadius: 2 },
  orbit: { position: 'absolute', borderWidth: 2, borderColor: '#7B5CFF', borderTopColor: 'transparent', borderRightColor: '#22C7B1', transform: [{ rotate: '-12deg' }] },
  wordRow: { marginTop: 13, alignItems: 'center' },
  wordEn: { fontSize: 32, fontWeight: '900', color: colors.text, letterSpacing: 7 },
  wordFa: { marginTop: 4, fontSize: 10, fontWeight: '700', color: colors.accent, letterSpacing: 2.4 },
});
