import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@/hooks/useAlerts';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { formatKm } from '@/utils/formatKm';

type Props = { alert: Alert; onAgendar?: () => void };

const STATUS_COLOR: Record<string, string> = {
  urgente: Colors.danger,
  atencao: Colors.warning,
  ok: Colors.success,
};

const STATUS_LABEL: Record<string, string> = {
  urgente: 'Urgente',
  atencao: 'Atenção',
  ok: 'Em dia',
};

const STATUS_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  urgente: 'alert-circle',
  atencao: 'warning',
  ok: 'checkmark-circle',
};

export function AlertCard({ alert, onAgendar }: Props) {
  const color = STATUS_COLOR[alert.status];

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.header}>
        <Text style={styles.type}>{alert.type}</Text>
        <View style={[styles.badge, { backgroundColor: color + '18' }]}>
          <Ionicons name={STATUS_ICON[alert.status]} size={11} color={color} />
          <Text style={[styles.badgeText, { color }]}>{STATUS_LABEL[alert.status]}</Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Ionicons name="speedometer-outline" size={13} color={Colors.textSecondary} />
          <Text style={[styles.infoText, alert.kmRemaining <= 0 && { color: Colors.danger }]}>
            {alert.kmRemaining > 0
              ? `Faltam ${formatKm(alert.kmRemaining)}`
              : `Vencido há ${formatKm(Math.abs(alert.kmRemaining))}`}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="calendar-outline" size={13} color={Colors.textSecondary} />
          <Text style={[styles.infoText, alert.daysRemaining <= 0 && { color: Colors.danger }]}>
            {alert.daysRemaining > 0
              ? `${alert.daysRemaining}d restantes`
              : `${Math.abs(alert.daysRemaining)}d vencido`}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="star" size={13} color={Colors.warning} />
          <Text style={styles.infoText}>+{alert.points} pts</Text>
        </View>
      </View>

      {alert.status !== 'ok' && onAgendar && (
        <TouchableOpacity onPress={onAgendar} style={styles.agendarBtn}>
          <Text style={[styles.agendarText, { color }]}>Agendar revisão →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  type: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  agendarBtn: {
    marginTop: 8,
  },
  agendarText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
  },
});
