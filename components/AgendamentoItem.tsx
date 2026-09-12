import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Agendamento } from '@/services/agendamentos';
import { getCarImage } from '@/constants/fordModels';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

type Props = {
  item: Agendamento;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function AgendamentoItem({ item }: Props) {
  const carImage = getCarImage(item.vehicleModel, item.vehicleColor);

  return (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/agendamento/${item.id}`)} activeOpacity={0.85}>
      <View style={styles.body}>

        {/* Left — info */}
        <View style={styles.info}>
          <Text style={styles.infoLabel}>FORD</Text>
          <Text style={styles.infoModel} numberOfLines={1}>{item.vehicleModel}</Text>

          {/* Dealership */}
          <View style={styles.row}>
            <Ionicons name="storefront-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.rowText} numberOfLines={1}>{item.dealershipName}</Text>
          </View>

          {/* Problems */}
          {item.problems.length > 0 && (
            <View style={styles.row}>
              <Ionicons name="construct-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.rowText} numberOfLines={1}>
                {item.problems.slice(0, 2).join(' · ')}
                {item.problems.length > 2 ? ` +${item.problems.length - 2}` : ''}
              </Text>
            </View>
          )}

          {/* Status + date */}
          <View style={styles.footer}>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, item.status === 'concluido' && styles.statusDotDone]} />
              <Text style={[styles.statusText, item.status === 'concluido' && styles.statusTextDone]}>
                {item.status === 'concluido' ? 'Concluído' : 'Agendado'}
              </Text>
            </View>
            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>

        {/* Right — car photo cropped to nose */}
        <View style={styles.photoWrap}>
          {carImage ? (
            <Image source={carImage} style={styles.carPhoto} resizeMode="cover" />
          ) : (
            <View style={styles.photoFallback}>
              <Ionicons name="car-outline" size={44} color={Colors.inactive} />
            </View>
          )}
        </View>

      </View>

      {/* Bottom accent bar */}
      <View style={[styles.accentBar, item.status === 'concluido' && styles.accentBarDone]} />
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
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  body: {
    flexDirection: 'row',
    height: CARD_ALTURA,
  },

  // Left — info
  info: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    justifyContent: 'center',
    gap: 4,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rowText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  statusDotDone: {
    backgroundColor: Colors.textSecondary,
  },
  statusText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: Colors.success,
  },
  statusTextDone: {
    color: Colors.textSecondary,
  },
  dateText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textSecondary,
  },

  // Right — car photo cropped to show only the nose
  photoWrap: {
    width: 110,
    height: CARD_ALTURA,
    overflow: 'hidden',
  },
  carPhoto: {
    width: 260,
    height: CARD_ALTURA,
    marginLeft: -35,
  },
  photoFallback: {
    width: 110,
    height: CARD_ALTURA,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom green accent
  accentBar: {
    height: 3,
    backgroundColor: Colors.success,
  },
  accentBarDone: {
    backgroundColor: Colors.textSecondary,
  },
});
