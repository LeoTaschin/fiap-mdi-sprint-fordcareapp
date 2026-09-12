import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@/contexts/UserContext';
import { computeAlerts } from '@/hooks/useAlerts';
import { AgendamentoCarCard } from '@/components/AgendamentoCarCard';
import { ReviewCarCard } from '@/components/ReviewCarCard';
import { FORD_DEALERSHIPS, Dealership } from '@/constants/fordDealerships';
import { DealershipPicker } from '@/components/DealershipPicker';
import { criarAgendamento } from '@/services/agendamentos';
import { agendarLembrete, requestNotificationPermission } from '@/services/notifications';
import { logAuditEvent } from '@/services/auditLog';
import { safeErrorMessage } from '@/utils/safeError';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { Vehicle } from '@/contexts/UserContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  'Troca de Óleo':    'water-outline',
  'Revisão Geral':    'construct-outline',
  'Rodízio de Pneus': 'disc-outline',
  'Filtro de Ar':     'funnel-outline',
  'Outro':            'build-outline',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.stepRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.stepDot, i + 1 <= current && styles.stepDotActive, i + 1 < current && styles.stepDotDone]}
        />
      ))}
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NovoAgendamento() {
  const { dealershipId, alertType } = useLocalSearchParams<{ dealershipId?: string; alertType?: string }>();
  const { user, vehicles, maintenances } = useUser();

  const preselectedDealer = useMemo(
    () => FORD_DEALERSHIPS.find((d) => d.id === dealershipId) ?? null,
    [dealershipId],
  );

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedProblems, setSelectedProblems] = useState<string[]>(
    alertType ? [alertType] : [],
  );
  const [selectedDealer, setSelectedDealer] = useState<Dealership | null>(preselectedDealer);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const vehicleAlerts = useMemo(() => {
    return computeAlerts(selectedVehicle, maintenances).filter((a) => a.status !== 'ok');
  }, [selectedVehicle]);

  function goBack() {
    if (step === 1) { router.back(); return; }
    setStep((s) => (s - 1) as 1 | 2 | 3);
  }

  function goNext() {
    setStep((s) => (s + 1) as 2 | 3);
  }

  function toggleProblem(type: string) {
    setSelectedProblems((prev) =>
      prev.includes(type) ? prev.filter((p) => p !== type) : [...prev, type],
    );
  }

  async function handleConfirm() {
    if (!user || !selectedVehicle || !selectedDealer) return;
    setError('');
    setLoading(true);
    try {
      await criarAgendamento({
        userId: user.id,
        vehicleId: selectedVehicle.id,
        vehicleModel: selectedVehicle.model,
        vehicleColor: selectedVehicle.color,
        vehicleYear: selectedVehicle.year,
        dealershipId: selectedDealer.id,
        dealershipName: selectedDealer.name,
        problems: selectedProblems,
      });

      await logAuditEvent({
        userId: user.id,
        action: 'CREATE_AGENDAMENTO',
        status: 'success',
        metadata: { dealership: selectedDealer.name, vehicle: selectedVehicle.model, services: selectedProblems.length },
      });

      const granted = await requestNotificationPermission();
      if (granted) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        await agendarLembrete(
          'Lembrete FordCare 🔧',
          `Sua revisão do Ford ${selectedVehicle.model} está agendada na ${selectedDealer.name}.`,
          tomorrow,
        );
      }

      router.replace('/(tabs)/agendamento');
    } catch (err) {
      await logAuditEvent({ userId: user.id, action: 'CREATE_AGENDAMENTO', status: 'failure' });
      setError(safeErrorMessage(err, 'Erro ao salvar agendamento. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  }

  const canGoNextStep2 = selectedProblems.length > 0 && selectedDealer !== null;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeHeader} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {step === 1 ? 'Selecione o veículo' : step === 2 ? 'Selecione os problemas' : 'Revisar agendamento'}
            </Text>
            <StepIndicator current={step} total={3} />
          </View>
          <View style={{ width: 32 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── STEP 1: Vehicle ───────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <Text style={styles.stepSubtitle}>
              Qual Ford vamos levar para a concessionária?
            </Text>

            {vehicles.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="car-outline" size={44} color={Colors.inactive} />
                <Text style={styles.emptyText}>Nenhum veículo cadastrado.</Text>
                <TouchableOpacity onPress={() => router.push('/veiculo/cadastro')}>
                  <Text style={styles.emptyAction}>Cadastrar veículo →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.vehicleList}>
                {vehicles.map((v) => (
                  <AgendamentoCarCard
                    key={v.id}
                    vehicle={v}
                    isSelected={selectedVehicle?.id === v.id}
                    onPress={() => setSelectedVehicle(v)}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* ── STEP 2: Problems + Dealership ─────────────────────────────── */}
        {step === 2 && selectedVehicle && (
          <>
            <Text style={styles.stepSubtitle}>
              Selecione os problemas identificados para o Ford {selectedVehicle.model}.
            </Text>

            <SectionTitle>Problemas identificados</SectionTitle>

            {vehicleAlerts.length === 0 ? (
              <View style={styles.inlineEmpty}>
                <Ionicons name="checkmark-circle-outline" size={32} color={Colors.success} />
                <Text style={styles.inlineEmptyText}>Nenhum alerta pendente para este veículo.</Text>
              </View>
            ) : (
              <View style={styles.problemList}>
                {vehicleAlerts.map((alert) => {
                  const checked = selectedProblems.includes(alert.type);
                  const accentColor = alert.status === 'urgente' ? Colors.danger : Colors.warning;
                  const icon = SERVICE_ICONS[alert.type] ?? 'build-outline';
                  return (
                    <TouchableOpacity
                      key={alert.type}
                      style={[styles.problemCard, checked && styles.problemCardChecked]}
                      onPress={() => toggleProblem(alert.type)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.problemAccent, { backgroundColor: accentColor }]} />
                      <View style={styles.problemIconWrap}>
                        <Ionicons name={icon} size={20} color={Colors.primary} />
                      </View>
                      <View style={styles.problemInfo}>
                        <Text style={styles.problemTitle}>{alert.type}</Text>
                        <Text style={styles.problemStatus}>
                          {alert.status === 'urgente' ? 'Urgente' : 'Atenção necessária'}
                        </Text>
                      </View>
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked && <Ionicons name="checkmark" size={13} color={Colors.surface} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Seleção da concessionária — busca, distância e status vêm do picker */}
            {!preselectedDealer && (
              <>
                <SectionTitle>Concessionária</SectionTitle>
                <DealershipPicker selecionada={selectedDealer} onSelecionar={setSelectedDealer} />
              </>
            )}

            {preselectedDealer && (
              <>
                <SectionTitle>Concessionária</SectionTitle>
                <View style={styles.dealerFixed}>
                  <Ionicons name="storefront-outline" size={20} color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dealerFixedName}>{preselectedDealer.name}</Text>
                    <Text style={styles.dealerFixedSub}>{preselectedDealer.address}</Text>
                  </View>
                </View>
              </>
            )}
          </>
        )}

        {/* ── STEP 3: Review ────────────────────────────────────────────── */}
        {step === 3 && selectedVehicle && selectedDealer && (
          <>
            <Text style={styles.stepSubtitle}>Confirme as informações antes de agendar.</Text>

            {/* Vehicle preview */}
            <SectionTitle>Veículo</SectionTitle>
            <ReviewCarCard vehicle={selectedVehicle} />

            {/* Problems */}
            <SectionTitle>Problemas selecionados</SectionTitle>
            {selectedProblems.length === 0 ? (
              <Text style={styles.reviewNone}>Nenhum problema selecionado.</Text>
            ) : (
              <View style={styles.reviewProblemList}>
                {selectedProblems.map((p) => (
                  <View key={p} style={styles.reviewProblemItem}>
                    <Ionicons name={SERVICE_ICONS[p] ?? 'build-outline'} size={16} color={Colors.primary} />
                    <Text style={styles.reviewProblemText}>{p}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Dealership */}
            <SectionTitle>Concessionária</SectionTitle>
            <View style={styles.reviewDealerCard}>
              <Ionicons name="storefront-outline" size={22} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewDealerName}>{selectedDealer.name}</Text>
                <Text style={styles.reviewDealerSub}>{selectedDealer.address} · {selectedDealer.neighborhood}</Text>
                <Text style={styles.reviewDealerSub}>{selectedDealer.hours}</Text>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </>
        )}
      </ScrollView>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        {step === 1 && (
          <TouchableOpacity
            style={[styles.footerBtn, !selectedVehicle && styles.footerBtnDisabled]}
            onPress={goNext}
            disabled={!selectedVehicle}
            activeOpacity={0.85}
          >
            <Text style={styles.footerBtnText}>Próximo</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.surface} />
          </TouchableOpacity>
        )}

        {step === 2 && (
          <TouchableOpacity
            style={[styles.footerBtn, !canGoNextStep2 && styles.footerBtnDisabled]}
            onPress={goNext}
            disabled={!canGoNextStep2}
            activeOpacity={0.85}
          >
            <Text style={styles.footerBtnText}>Revisar</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.surface} />
          </TouchableOpacity>
        )}

        {step === 3 && (
          <TouchableOpacity
            style={[styles.footerBtn, loading && styles.footerBtnDisabled]}
            onPress={handleConfirm}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.surface} />
              : <>
                  <Ionicons name="checkmark-circle-outline" size={18} color={Colors.surface} />
                  <Text style={styles.footerBtnText}>Confirmar agendamento</Text>
                </>
            }
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  safeHeader: { backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 32, alignItems: 'flex-start' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 6 },
  headerTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  stepRow: { flexDirection: 'row', gap: 6 },
  stepDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
  },
  stepDotActive: { backgroundColor: Colors.primary },
  stepDotDone: { backgroundColor: Colors.primaryLight ?? Colors.primary, opacity: 0.5 },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: 32 },

  stepSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },

  sectionTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },

  // Step 1 - Vehicle
  vehicleList: { gap: Spacing.md },

  // Step 2 - Problems
  problemList: { gap: Spacing.sm },
  problemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  problemCardChecked: { borderColor: Colors.primary },
  problemAccent: { width: 4, alignSelf: 'stretch' },
  problemIconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(19,58,124,0.07)',
    borderRadius: 10,
    margin: Spacing.sm,
    flexShrink: 0,
  },
  problemInfo: { flex: 1, paddingVertical: Spacing.sm },
  problemTitle: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  problemStatus: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  // Step 2 - Dealer chips
  dealerList: { gap: Spacing.sm },
  dealerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  dealerChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dealerChipInfo: { flex: 1 },
  dealerChipName: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: Colors.textPrimary },
  dealerChipNameSelected: { color: Colors.surface },
  dealerChipSub: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 1 },

  dealerFixed: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  dealerFixedName: { fontFamily: FontFamily.bodyMedium, fontSize: 14, color: Colors.textPrimary },
  dealerFixedSub: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  // Step 3 - Review
  reviewProblemList: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  reviewProblemItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  reviewProblemText: { fontFamily: FontFamily.bodyMedium, fontSize: 14, color: Colors.textPrimary },
  reviewNone: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.textSecondary },

  reviewDealerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
  },
  reviewDealerName: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Colors.textPrimary },
  reviewDealerSub: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  // Empty / Error
  emptyState: { alignItems: 'center', paddingTop: 60, gap: Spacing.sm },
  emptyText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.textSecondary },
  emptyAction: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Colors.primary },
  inlineEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
  },
  inlineEmptyText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.textSecondary, flex: 1 },
  errorText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.danger, marginTop: Spacing.sm },

  // Footer
  footer: { backgroundColor: Colors.background, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, paddingTop: Spacing.sm },
  footerBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  footerBtnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  footerBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: Colors.surface },
});
