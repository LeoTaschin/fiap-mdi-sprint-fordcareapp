import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, Spacing, LevelColors } from '@/constants/theme';

type Level = 'bronze' | 'prata' | 'ouro';

const LEVEL_COLOR: Record<Level, string> = {
  bronze: LevelColors.bronze,
  prata: LevelColors.prata,
  ouro: LevelColors.ouro,
};

const NEXT_LEVEL_THRESHOLD: Record<Level, number> = {
  bronze: 500,
  prata: 1500,
  ouro: Infinity,
};

type Props = { points: number; level: Level };

export function PointsBadge({ points, level }: Props) {
  const threshold = NEXT_LEVEL_THRESHOLD[level];
  const remaining = threshold === Infinity ? null : threshold - points;

  return (
    <View style={styles.card}>
      <View style={[styles.levelBadge, { backgroundColor: LEVEL_COLOR[level] }]}>
        <Text style={styles.levelText}>{level.toUpperCase()}</Text>
      </View>
      <Text style={styles.points}>{points.toLocaleString('pt-BR')} pts</Text>
      {remaining !== null && (
        <Text style={styles.next}>Faltam {remaining} pts para o próximo nível</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  levelBadge: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: Spacing.sm,
  },
  levelText: {
    fontFamily: FontFamily.display,
    fontSize: 14,
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  points: {
    fontFamily: FontFamily.display,
    fontSize: 40,
    color: Colors.surface,
  },
  next: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
});
