import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

export type Benefit = {
  id: string;
  title: string;
  description: string;
  points: number;
};

export const BENEFITS: Benefit[] = [
  { id: '1', title: '10% de desconto', description: 'Na próxima revisão', points: 500 },
  { id: '2', title: 'Lavagem grátis', description: 'Presente na concessionária', points: 300 },
  { id: '3', title: 'Revisão grátis', description: 'Revisão completa sem custo', points: 1500 },
];

type Props = {
  benefit: Benefit;
  userPoints: number;
  onResgatar: () => void;
};

export function BenefitCard({ benefit, userPoints, onResgatar }: Props) {
  const canRedeem = userPoints >= benefit.points;

  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.title}>{benefit.title}</Text>
        <Text style={styles.desc}>{benefit.description}</Text>
        <Text style={styles.cost}>{benefit.points} pts</Text>
      </View>
      <TouchableOpacity
        style={[styles.btn, !canRedeem && styles.btnDisabled]}
        onPress={onResgatar}
        disabled={!canRedeem}
      >
        <Text style={styles.btnText}>Resgatar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  info: { flex: 1 },
  title: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  desc: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cost: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.accent,
    marginTop: 4,
  },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.surface,
  },
});
