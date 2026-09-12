import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@/contexts/UserContext';
import { buscarAgendamentoPorId, confirmarAgendamento, Agendamento } from '@/services/agendamentos';
import { registrarManutencao } from '@/services/maintenance';
import { atualizarServico } from '@/services/vehicle';
import { ReviewCarCard } from '@/components/ReviewCarCard';
import { MAINTENANCE_RULES } from '@/constants/maintenanceRules';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { logAuditEvent } from '@/services/auditLog';
import { logDevError } from '@/utils/safeError';
import { safeErrorMessage } from '@/utils/safeError';

const SERVICE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  'Troca de Óleo':    'water-outline',
  'Revisão Geral':    'construct-outline',
  'Rodízio de Pneus': 'disc-outline',
  'Filtro de Ar':     'funnel-outline',
  'Outro':            'build-outline',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

export default function AgendamentoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, vehicles, profile, dispatch } = useUser();

  function calcLevel(pts: number) {
    if (pts >= 1500) return 'ouro' as const;
    if (pts >= 500) return 'prata' as const;
    return 'bronze' as const;
  }

  const [agendamento, setAgendamento] = useState<Agendamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    buscarAgendamentoPorId(id)
      .then(setAgendamento)
      .catch(() => setError('Não foi possível carregar o agendamento.'))
      .finally(() => setLoading(false));
  }, [id]);

  const vehicle = agendamento
    ? vehicles.find((v) => v.id === agendamento.vehicleId) ?? null
    : null;

  async function handleConfirmarRevisao() {
    if (!agendamento || !user) return;
    setConfirming(true);
    setError('');
    try {
      let earnedTotal = 0;

      for (const problemType of agendamento.problems) {
        const rule = MAINTENANCE_RULES.find((r) => r.type === problemType);
        const points = rule?.points ?? 50;
        const maintenance = await registrarManutencao(user.id, {
          vehicleId: agendamento.vehicleId,
          // Ancora o serviço no chassi: é assim que o histórico sobrevive à venda.
          vin: vehicle?.vin,
          inNetwork: true,
          type: problemType,
          date: new Date(),
          km: vehicle?.currentKm ?? 0,
          dealership: agendamento.dealershipName,
          notes: `Revisão via agendamento FordCare`,
          pointsEarned: points,
        });
        dispatch({
          type: 'ADD_MAINTENANCE',
          payload: {
            id: maintenance,
            vehicleId: agendamento.vehicleId,
            vin: vehicle?.vin,
            inNetwork: true,
            type: problemType,
            date: new Date(),
            km: vehicle?.currentKm ?? 0,
            dealership: agendamento.dealershipName,
            notes: '',
            pointsEarned: points,
          },
        });
        earnedTotal += points;
      }

      const newPoints = (profile?.points ?? 0) + earnedTotal;
      dispatch({ type: 'UPDATE_POINTS', payload: { points: newPoints, level: calcLevel(newPoints) } });

      await confirmarAgendamento(agendamento.id);

      if (vehicle) {
        const now = new Date();
        await atualizarServico(vehicle.id, vehicle.currentKm, now);
        dispatch({
          type: 'UPDATE_VEHICLE',
          payload: { ...vehicle, lastServiceKm: vehicle.currentKm, lastServiceDate: now },
        });
      }

      await logAuditEvent({
        userId: user.id,
        action: 'CONFIRM_AGENDAMENTO',
        resource: agendamento.id,
        status: 'success',
        metadata: { services: agendamento.problems.length, points_earned: earnedTotal },
      });

      setAgendamento((prev) => prev ? { ...prev, status: 'concluido' } : prev);
      router.navigate('/(tabs)/agendamento');
    } catch (err) {
      logDevError('confirmarRevisao', err);
      await logAuditEvent({ userId: user.id, action: 'CONFIRM_AGENDAMENTO', resource: agendamento.id, status: 'failure' });
      setError(safeErrorMessage(err, 'Erro ao confirmar revisão. Tente novamente.'));
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!agendamento) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Agendamento não encontrado.'}</Text>
      </View>
    );
  }

  const isConcluido = agendamento.status === 'concluido';

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeHeader} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhes do agendamento</Text>
          <View style={{ width: 32 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status badge */}
        <View style={[styles.statusBadge, isConcluido && styles.statusBadgeDone]}>
          <Ionicons
            name={isConcluido ? 'checkmark-circle' : 'calendar'}
            size={14}
            color={isConcluido ? Colors.success : Colors.primary}
          />
          <Text style={[styles.statusText, isConcluido && styles.statusTextDone]}>
            {isConcluido ? 'Revisão concluída' : 'Agendado'}
          </Text>
          <Text style={styles.statusDate}>{formatDate(agendamento.createdAt)}</Text>
        </View>

        {/* Vehicle card */}
        {vehicle && <ReviewCarCard vehicle={vehicle} />}

        {/* Dealership */}
        <Text style={styles.sectionTitle}>Concessionária</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoIconWrap}>
            <Ionicons name="storefront-outline" size={20} color={Colors.primary} />
          </View>
          <Text style={styles.infoCardText}>{agendamento.dealershipName}</Text>
        </View>

        {/* Problems */}
        {agendamento.problems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Serviços agendados</Text>
            <View style={styles.problemList}>
              {agendamento.problems.map((p) => (
                <View key={p} style={styles.problemRow}>
                  <View style={styles.problemIconWrap}>
                    <Ionicons
                      name={SERVICE_ICONS[p] ?? 'build-outline'}
                      size={18}
                      color={Colors.primary}
                    />
                  </View>
                  <Text style={styles.problemText}>{p}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      {/* Footer — confirm button (only if not concluded) */}
      {!isConcluido && (
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <TouchableOpacity
            style={[styles.confirmBtn, confirming && styles.confirmBtnDisabled]}
            onPress={handleConfirmarRevisao}
            disabled={confirming}
            activeOpacity={0.85}
          >
            {confirming ? (
              <ActivityIndicator color={Colors.surface} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color={Colors.surface} />
                <Text style={styles.confirmBtnText}>Confirmar revisão</Text>
              </>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  safeHeader: { backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 32, alignItems: 'flex-start' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 32,
    gap: Spacing.sm,
  },

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(19,58,124,0.07)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  statusBadgeDone: {
    backgroundColor: 'rgba(30,138,68,0.1)',
  },
  statusText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.primary,
  },
  statusTextDone: {
    color: Colors.success,
  },
  statusDate: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textSecondary,
    marginLeft: 2,
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

  // Info card (dealership)
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(19,58,124,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoCardText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
  },

  // Problems
  problemList: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  problemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.background,
  },
  problemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(19,58,124,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  problemText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },

  errorText: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.danger,
    textAlign: 'center',
  },

  // Footer
  footer: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  confirmBtn: {
    backgroundColor: Colors.success,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.success,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  confirmBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  confirmBtnText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 16,
    color: Colors.surface,
  },
});
