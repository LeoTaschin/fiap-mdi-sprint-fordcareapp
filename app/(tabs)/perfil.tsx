import { useState, useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { Level } from '@/contexts/UserContext';
import { logout } from '@/services/auth';
import { resgatarBeneficio } from '@/services/benefits';
import { logAuditEvent } from '@/services/auditLog';
import { logDevError } from '@/utils/safeError';
import { Toast } from '@/components/ui/Toast';
import { Colors, FontFamily, Spacing, LevelColors } from '@/constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_NEXT: Record<Level, number | null> = {
  bronze: 500,
  prata: 1500,
  ouro: null,
};

const LEVEL_MIN: Record<Level, number> = {
  bronze: 0,
  prata: 500,
  ouro: 1500,
};



const LEVEL_LABEL: Record<Level, string> = {
  bronze: 'Bronze',
  prata: 'Prata',
  ouro: 'Ouro',
};

const HOW_TO_EARN = [
  { icon: 'construct-outline', label: 'Revisão Geral',    pts: 200 },
  { icon: 'water-outline',     label: 'Troca de Óleo',    pts: 100 },
  { icon: 'disc-outline',      label: 'Rodízio de Pneus', pts: 100 },
  { icon: 'funnel-outline',    label: 'Filtro de Ar',     pts: 80  },
] as const;

const BENEFITS = [
  { icon: 'pricetag-outline',  label: '10% de desconto na revisão', cost: 500  },
  { icon: 'car-outline',       label: 'Lavagem gratuita',           cost: 300  },
  { icon: 'shield-checkmark-outline', label: 'Revisão gratuita',   cost: 1500 },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function progressToNext(points: number, level: Level): number {
  const next = LEVEL_NEXT[level];
  if (!next) return 1;
  const min = LEVEL_MIN[level];
  return Math.min((points - min) / (next - min), 1);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PerfilScreen() {
  const { profile, vehicle, maintenances, dispatch } = useUser();
  const [resgatando, setResgatando] = useState<string | null>(null);
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'success' as 'success' | 'error',
  });

  const level: Level = profile?.level ?? 'bronze';
  const points = profile?.points ?? 0;
  const nextThreshold = LEVEL_NEXT[level];
  const progress = progressToNext(points, level);
  const levelColor = LevelColors[level];

  // ── Índice de histórico na rede oficial ─────────────────────────────────
  // É o mesmo número que a Ford chama de VIN Share, visto do lado do cliente.
  // Só é honesto porque o app deixa registrar serviço feito FORA da rede.
  const impacto = useMemo(() => {
    const doVeiculo = vehicle?.vin
      ? maintenances.filter((m) => m.vin === vehicle.vin)
      : maintenances;
    const total = doVeiculo.length;
    if (total === 0) return null;
    const naRede = doVeiculo.filter((m) => m.inNetwork !== false).length;
    return { total, naRede, pct: Math.round((naRede / total) * 100) };
  }, [maintenances, vehicle?.vin]);

  async function handleLogout() {
    Alert.alert('Sair da conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/WelcomeScreen');
        },
      },
    ]);
  }

  function handleResgate(label: string, cost: number) {
    if (points < cost) {
      Alert.alert(
        'Pontos insuficientes',
        `Você precisa de ${cost} pts para resgatar "${label}". Você tem ${points} pts.`,
      );
      return;
    }

    Alert.alert('Resgatar benefício', `Usar ${cost.toLocaleString('pt-BR')} pts em "${label}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Resgatar',
        onPress: async () => {
          if (resgatando) return;
          setResgatando(label);
          try {
            await resgatarBeneficio(label, cost);
            // O débito acontece no banco; aqui só refletimos o novo saldo.
            // O nível não muda: é calculado sobre os pontos acumulados na vida toda.
            dispatch({ type: 'UPDATE_POINTS', payload: { points: points - cost, level } });
            await logAuditEvent({
              userId: profile?.uid,
              action: 'REDEEM_BENEFIT',
              resource: label,
              metadata: { cost },
            });
            setToast({
              visible: true,
              message: `"${label}" resgatado — apresente na concessionária.`,
              type: 'success',
            });
          } catch (e) {
            logDevError('resgatarBeneficio', e);
            const code = e instanceof Error ? e.message : 'DESCONHECIDO';
            setToast({
              visible: true,
              message:
                code === 'SALDO_INSUFICIENTE'
                  ? 'Seu saldo mudou. Atualize a tela e tente de novo.'
                  : 'Não foi possível resgatar agora. Tente novamente.',
              type: 'error',
            });
            await logAuditEvent({
              userId: profile?.uid,
              action: 'REDEEM_BENEFIT',
              resource: label,
              status: 'failure',
            });
          } finally {
            setResgatando(null);
          }
        },
      },
    ]);
  }

  async function handleConvidar() {
    const primeiroNome = profile?.name?.split(' ')[0] ?? 'Um amigo';
    try {
      await Share.share({
        message:
          `${primeiroNome} está usando o FordCare para manter o Ford em dia: alertas de revisão, ` +
          `histórico completo do veículo e pontos a cada serviço na rede oficial. Baixe você também.`,
      });
    } catch {
      // Usuário fechou a folha de compartilhamento — não é erro.
    }
  }

  return (
    <View style={styles.root}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <SafeAreaView style={styles.safeHeader} edges={['top']}>
        <View style={styles.header}>
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>
              {profile?.name ? initials(profile.name) : '?'}
            </Text>
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>
              {profile?.name ?? 'Usuário'}
            </Text>
            <Text style={styles.headerEmail} numberOfLines={1}>
              {profile?.email ?? ''}
            </Text>
            {vehicle && (
              <View style={styles.vehicleRow}>
                <Ionicons name="car-outline" size={12} color={Colors.textSecondary} />
                <Text style={styles.vehicleText}>
                  Ford {vehicle.model} {vehicle.year}
                </Text>
              </View>
            )}
          </View>

          {/* Level badge */}
          <View style={[styles.levelBadge, { backgroundColor: levelColor }]}>
            <Text style={styles.levelBadgeText}>{LEVEL_LABEL[level]}</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Points card ───────────────────────────────────────────────────── */}
        <View style={styles.pointsCard}>
          <View style={styles.pointsTop}>
            <View>
              <Text style={styles.pointsLabel}>Saldo de pontos</Text>
              <Text style={styles.pointsValue}>{points.toLocaleString('pt-BR')}</Text>
              <Text style={styles.pointsSuffix}>pontos FordCare</Text>
            </View>
            <View style={[styles.levelCircle, { borderColor: levelColor }]}>
              <Ionicons name="star" size={20} color={levelColor} />
              <Text style={[styles.levelCircleText, { color: levelColor }]}>
                {LEVEL_LABEL[level]}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          {nextThreshold !== null ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: levelColor }]} />
              </View>
              <Text style={styles.progressLabel}>
                Faltam {(nextThreshold - points).toLocaleString('pt-BR')} pts para{' '}
                {level === 'bronze' ? 'Prata' : 'Ouro'}
              </Text>
            </View>
          ) : (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: '100%', backgroundColor: levelColor }]} />
              </View>
              <Text style={styles.progressLabel}>Nível máximo atingido!</Text>
            </View>
          )}
        </View>

        {/* ── Impacto: histórico na rede oficial ────────────────────────────── */}
        {impacto && (
          <TouchableOpacity
            style={styles.impactoCard}
            onPress={() => router.push('/veiculo/passaporte')}
            activeOpacity={0.85}
          >
            <View style={styles.impactoTopo}>
              <Text style={styles.impactoLabel}>HISTÓRICO NA REDE OFICIAL</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </View>

            <View style={styles.impactoLinha}>
              <Text style={styles.impactoPct}>{impacto.pct}%</Text>
              <Text style={styles.impactoFracao}>
                {impacto.naRede} de {impacto.total}{' '}
                {impacto.total === 1 ? 'serviço' : 'serviços'}
              </Text>
            </View>

            <View style={styles.impactoBarra}>
              <View style={[styles.impactoBarraFill, { width: `${impacto.pct}%` }]} />
            </View>

            <Text style={styles.impactoTexto}>
              {impacto.pct === 100
                ? 'Histórico completo na rede Ford — é isso que sustenta o valor do seu carro na revenda.'
                : 'Quanto mais serviços na rede oficial, mais o histórico do veículo vale na hora de vender.'}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Como ganhar pontos ────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Como ganhar pontos</Text>
        <View style={styles.listCard}>
          {HOW_TO_EARN.map((item) => (
            <View key={item.label} style={[styles.listRow, styles.listRowBorder]}>
              <View style={styles.listIconWrap}>
                <Ionicons name={item.icon} size={18} color={Colors.primary} />
              </View>
              <Text style={styles.listLabel}>{item.label}</Text>
              <View style={styles.ptsBadge}>
                <Text style={styles.ptsBadgeText}>+{item.pts} pts</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.listRow} onPress={handleConvidar} activeOpacity={0.7}>
            <View style={styles.listIconWrap}>
              <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.listLabel}>Convidar um amigo</Text>
            <Ionicons name="share-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Benefícios ────────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Resgatar benefícios</Text>
        {BENEFITS.map((b) => {
          const canRedeem = points >= b.cost;
          return (
            <TouchableOpacity
              key={b.label}
              style={[styles.benefitCard, !canRedeem && styles.benefitCardLocked]}
              onPress={() => handleResgate(b.label, b.cost)}
              disabled={!canRedeem || resgatando !== null}
              activeOpacity={0.8}
            >
              <View style={[styles.benefitIcon, !canRedeem && styles.benefitIconLocked]}>
                <Ionicons name={b.icon} size={22} color={canRedeem ? Colors.primary : Colors.textSecondary} />
              </View>
              <View style={styles.benefitInfo}>
                <Text style={[styles.benefitLabel, !canRedeem && styles.benefitLabelLocked]}>
                  {b.label}
                </Text>
                <Text style={[styles.benefitCost, { color: canRedeem ? Colors.success : Colors.textSecondary }]}>
                  {b.cost.toLocaleString('pt-BR')} pts
                </Text>
              </View>
              <Ionicons
                name={canRedeem ? 'chevron-forward' : 'lock-closed-outline'}
                size={18}
                color={canRedeem ? Colors.primary : Colors.inactive}
              />
            </TouchableOpacity>
          );
        })}

        {/* ── Configurações ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Configurações</Text>
        <View style={styles.listCard}>
          <TouchableOpacity
            style={[styles.listRow, styles.listRowBorder]}
            onPress={() => router.push('/veiculo/cadastro')}
            activeOpacity={0.7}
          >
            <View style={styles.listIconWrap}>
              <Ionicons name="car-outline" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.listLabel}>Meu veículo</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.inactive} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.listRow}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={[styles.listIconWrap, styles.listIconDanger]}>
              <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
            </View>
            <Text style={[styles.listLabel, styles.listLabelDanger]}>Sair da conta</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>FordCare · v1.0.0</Text>
      </ScrollView>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  impactoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  impactoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  impactoLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.7,
  },
  impactoLinha: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  impactoPct: { fontFamily: FontFamily.display, fontSize: 32, color: Colors.primary },
  impactoFracao: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  impactoBarra: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceNeutral,
    marginTop: 8,
    overflow: 'hidden',
  },
  impactoBarraFill: { height: 6, borderRadius: 3, backgroundColor: Colors.success },
  impactoTexto: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 8,
  },
  root: { flex: 1, backgroundColor: Colors.background },

  // Header
  safeHeader: { backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.surfaceMuted,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,52,120,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    color: Colors.primary,
  },
  headerInfo: { flex: 1, gap: 2 },
  headerName: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  headerEmail: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  vehicleText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  levelBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    flexShrink: 0,
  },
  levelBadgeText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: Colors.surface,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 40,
    gap: Spacing.sm,
  },

  // Points card
  pointsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: Spacing.sm,
  },
  pointsTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  pointsLabel: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  pointsValue: {
    fontFamily: FontFamily.display,
    fontSize: 48,
    color: Colors.primary,
    lineHeight: 52,
  },
  pointsSuffix: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  levelCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  levelCircleText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
  },
  progressWrap: { gap: 6 },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressLabel: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textSecondary,
  },

  // Section title
  sectionTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: Spacing.sm,
  },

  // Generic list card
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  listRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.background,
  },
  listIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(19,58,124,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listIconDanger: {
    backgroundColor: 'rgba(214,43,43,0.07)',
  },
  listLabel: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  listLabelDanger: {
    color: Colors.danger,
  },
  ptsBadge: {
    backgroundColor: 'rgba(30,138,68,0.1)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ptsBadgeText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.success,
  },

  // Benefit cards
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  benefitCardLocked: {
    opacity: 0.6,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(19,58,124,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitIconLocked: {
    backgroundColor: Colors.background,
  },
  benefitInfo: { flex: 1, gap: 2 },
  benefitLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  benefitLabelLocked: {
    color: Colors.textSecondary,
  },
  benefitCost: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
  },

  versionText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.inactive,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
