import { View, Text, StyleSheet } from 'react-native';
import { Maintenance } from '@/contexts/UserContext';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { formatKm } from '@/utils/formatKm';
import { formatDate } from '@/utils/formatDate';

type Props = { item: Maintenance };

export function MaintenanceItem({ item }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={styles.type}>{item.type}</Text>
        <Text style={styles.meta}>{formatDate(item.date)} · {formatKm(item.km)}</Text>
        {item.dealership ? <Text style={styles.dealership}>{item.dealership}</Text> : null}
      </View>
      <View style={styles.points}>
        <Text style={styles.pointsText}>+{item.pointsEarned}</Text>
        <Text style={styles.pointsLabel}>pts</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  left: { flex: 1 },
  type: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  meta: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dealership: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  points: { alignItems: 'center' },
  pointsText: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: Colors.success,
  },
  pointsLabel: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textSecondary,
  },
});
