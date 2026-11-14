import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

type Props = {
  size?: number;
  showWordmark?: boolean;
};

/** لوگوی نمادین NAMA: خانه + حلقه ۳۶۰ */
export default function LogoMark({ size = 88, showWordmark = false }: Props) {
  const ring = size;
  const house = size * 0.42;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.outerRing,
          {
            width: ring,
            height: ring,
            borderRadius: ring / 2,
          },
          shadowsGlow,
        ]}
      >
        <View
          style={[
            styles.innerDisk,
            {
              width: ring * 0.78,
              height: ring * 0.78,
              borderRadius: (ring * 0.78) / 2,
            },
          ]}
        >
          {/* سقف */}
          <View
            style={[
              styles.roof,
              {
                borderLeftWidth: house * 0.55,
                borderRightWidth: house * 0.55,
                borderBottomWidth: house * 0.4,
                marginBottom: -2,
              },
            ]}
          />
          {/* بدنه خانه */}
          <View
            style={[
              styles.body,
              {
                width: house * 0.72,
                height: house * 0.5,
              },
            ]}
          >
            <View style={styles.door} />
          </View>
        </View>
        {/* نقطه نشان ۳۶۰ */}
        <View style={[styles.orbitDot, { top: 6, right: ring * 0.18 }]} />
      </View>

      {showWordmark && (
        <View style={styles.wordRow}>
          <Text style={styles.wordEn}>NAMA</Text>
          <Text style={styles.wordFa}>ناما</Text>
        </View>
      )}
    </View>
  );
}

const shadowsGlow = {
  shadowColor: '#22d3ee',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.5,
  shadowRadius: 20,
  elevation: 12,
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  outerRing: {
    borderWidth: 3,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerDisk: {
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  roof: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.primary,
  },
  body: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 3,
  },
  door: {
    width: 8,
    height: 12,
    backgroundColor: colors.background,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  orbitDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
  wordRow: {
    marginTop: 14,
    alignItems: 'center',
  },
  wordEn: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 6,
  },
  wordFa: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
