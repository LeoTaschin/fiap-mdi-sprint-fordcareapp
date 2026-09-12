import { TouchableOpacity, View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { computeAlerts } from '@/hooks/useAlerts';
import { Vehicle } from '@/contexts/UserContext';
import { useUser } from '@/contexts/UserContext';
import { getCarImage, COLOR_HEX } from '@/constants/fordModels';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

type Props = {
  vehicle: Vehicle;
  isSelected: boolean;
  onPress: () => void;
};

export function AgendamentoCarCard({ vehicle, isSelected, onPress }: Props) {
  const { maintenances } = useUser();
  const alerts = computeAlerts(vehicle, maintenances).filter((a) => a.status !== 'ok');
  const urgente = alerts.filter((a) => a.status === 'urgente').length;
  const atencao = alerts.filter((a) => a.status === 'atencao').length;

  // getCarImage uses @/assets/Carros/ paths (same as cadastro screen — guaranteed to resolve)
  const carImage = getCarImage(vehicle.model, vehicle.color);
  const bannerBg  = COLOR_HEX[vehicle.color as keyof typeof COLOR_HEX] ?? Colors.primary;

  function AlertBadge() {
    if (urgente > 0) {
      return (
        <View style={styles.alertRow}>
          <View style={[styles.alertDot, { backgroundColor: Colors.danger }]} />
          <Text style={[styles.alertText, { color: Colors.danger }]}>
            {urgente} {urgente === 1 ? 'alerta urgente' : 'alertas urgentes'}
            {atencao > 0 ? ` · ${atencao} atenção` : ''}
          </Text>
        </View>
      );
    }
    if (atencao > 0) {
      return (
        <View style={styles.alertRow}>
          <View style={[styles.alertDot, { backgroundColor: Colors.warning }]} />
          <Text style={[styles.alertText, { color: Colors.warning }]}>
            {atencao} {atencao === 1 ? 'item requer atenção' : 'itens requerem atenção'}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.alertRow}>
        <View style={[styles.alertDot, { backgroundColor: Colors.success }]} />
        <Text style={[styles.alertText, { color: Colors.success }]}>Em dia</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.body}>

        {/* Left — vehicle info */}
        <View style={styles.info}>
          <Text style={styles.infoLabel}>FORD</Text>
          <Text style={styles.infoModel} numberOfLines={1}>{vehicle.model}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{vehicle.year}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Ionicons name="speedometer-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{vehicle.currentKm.toLocaleString('pt-BR')} km</Text>
          </View>
          <AlertBadge />
          {isSelected && (
            <View style={styles.checkRow}>
              <Ionicons name="checkmark-circle" size={15} color={Colors.primary} />
              <Text style={styles.checkLabel}>Selecionado</Text>
            </View>
          )}
        </View>

        {/* Right — car photo, cropped to show only the nose */}
        <View style={styles.photoWrap}>
          {carImage ? (
            <Image source={carImage} style={styles.carPhoto} resizeMode="cover" />
          ) : (
            <View style={[styles.photoFallback, { backgroundColor: bannerBg }]}>
              <Ionicons name="car" size={44} color="rgba(255,255,255,0.3)" />
            </View>
          )}
        </View>

      </View>

      {/* Bottom selection indicator */}
      <View style={[styles.selectionBar, isSelected && styles.selectionBarActive]} />
    </TouchableOpacity>
  );
}

/** Altura do card. Comporta o estado selecionado, que ganha a linha "Selecionado".
    Com 120 o conteudo estourava e o nome do modelo saia cortado. */
const CARD_ALTURA = 146;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardSelected: {
    borderColor: Colors.primary,
  },

  body: {
    flexDirection: 'row',
    height: CARD_ALTURA,
  },

  // Left info
  info: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    justifyContent: 'center',
    gap: 3,
  },
  infoLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
  },
  infoModel: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    color: Colors.primary,
    lineHeight: 26,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  metaDot: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  alertDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  alertText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    flexShrink: 1,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  checkLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: Colors.primary,
  },

  // Right photo — container clips the image; marginLeft negative shifts the image
  // left so only the right portion (nose) is visible
  photoWrap: {
    width: 110,
    height: CARD_ALTURA,
    overflow: 'hidden',
  },
  carPhoto: {
    width: 260,
    height: CARD_ALTURA,
    marginLeft: -35, // hides left 150px of 260px image → shows only the rightmost 110px (nose)
  },
  photoFallback: {
    width: 110,
    height: CARD_ALTURA,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom bar
  selectionBar: {
    height: 3,
    backgroundColor: 'transparent',
  },
  selectionBarActive: {
    backgroundColor: Colors.primary,
  },
});
