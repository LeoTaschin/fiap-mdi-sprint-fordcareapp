import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Vehicle } from '@/contexts/UserContext';
import { getCarImage, COLOR_HEX, COLOR_LABELS } from '@/constants/fordModels';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

type Props = {
  vehicle: Vehicle;
};

export function ReviewCarCard({ vehicle }: Props) {
  const carImage = getCarImage(vehicle.model, vehicle.color);
  const bannerBg  = COLOR_HEX[vehicle.color as keyof typeof COLOR_HEX] ?? Colors.primary;
  const colorLabel = COLOR_LABELS[vehicle.color as keyof typeof COLOR_LABELS] ?? vehicle.color;

  return (
    <View style={styles.card}>
      {/* Banner — car photo over colored background */}
      <View style={styles.banner}>
        <Text style={styles.bannerBrand}>FORD</Text>
        {carImage ? (
          <Image source={carImage} style={styles.carPhoto} resizeMode="contain" />
        ) : (
          <Ionicons
            name="car"
            size={100}
            color="rgba(255,255,255,0.2)"
            style={styles.carIcon}
          />
        )}
      </View>

      {/* Info row */}
      <View style={styles.body}>
        <View style={styles.bodyLeft}>
          <Text style={styles.model}>{vehicle.model}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{vehicle.year}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Ionicons name="speedometer-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{vehicle.currentKm.toLocaleString('pt-BR')} km</Text>
          </View>
        </View>

        {/* Color chip */}
        <View style={styles.colorChip}>
          <View style={[styles.colorDot, { backgroundColor: bannerBg }]} />
          <Text style={styles.colorLabel}>{colorLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  // Banner
  banner: {
    height: 150,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceMuted,
  },
  bannerBrand: {
    fontFamily: FontFamily.display,
    fontSize: 13,
    color: Colors.primary,
    letterSpacing: 4,
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
  },
  carPhoto: {
    position: 'absolute',
    bottom: -10,
    right: -20,
    width: 280,
    height: 160,
  },
  carIcon: {
    position: 'absolute',
    bottom: 8,
    right: 16,
  },

  // Info row
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  bodyLeft: {
    gap: 4,
  },
  model: {
    fontFamily: FontFamily.display,
    fontSize: 24,
    color: Colors.primary,
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  metaDot: {
    color: Colors.textSecondary,
    fontSize: 13,
  },

  // Color chip
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  colorLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.textPrimary,
  },
});
