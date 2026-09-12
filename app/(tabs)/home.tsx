import { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@/contexts/UserContext';
import { computeAlerts } from '@/hooks/useAlerts';
import { recomendacaoPrincipal, estimarKmPorMes } from '@/utils/copiloto';
import { montarEntrada } from '@/utils/copilotoTexto';
import { useCopilotoTexto } from '@/hooks/useCopilotoTexto';
import { atualizarKm } from '@/services/vehicle';
import { VehicleCard } from '@/components/VehicleCard';
import { TextoSuave } from '@/components/TextoSuave';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

export default function HomeScreen() {
  const { profile, vehicles, maintenances, selectedVehicleIndex, dispatch } = useUser();
  const { width: screenWidth } = useWindowDimensions();
  const swiperRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [showKmSheet, setShowKmSheet] = useState(false);
  const [newKm, setNewKm] = useState('');
  const [kmError, setKmError] = useState('');
  const [kmLoading, setKmLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });

  const firstName = profile?.name?.split(' ')[0] ?? 'você';
  const currentVehicle = vehicles[currentIndex] ?? null;
  const currentAlerts = computeAlerts(currentVehicle, maintenances);
  const recomendacao = recomendacaoPrincipal(currentVehicle, maintenances, currentAlerts);
  const pioreStatus = currentAlerts.some((a) => a.status === 'urgente')
    ? 'urgente'
    : currentAlerts.some((a) => a.status === 'atencao')
    ? 'atencao'
    : 'ok';
  const pendentes = currentAlerts.filter((a) => a.status !== 'ok').length;

  // Camada 3 do Copiloto: o corpo determinístico é o que aparece primeiro; se a
  // Edge Function responder dentro do prazo e os números baterem, o texto
  // redigido entra no lugar. Falha, timeout ou divergência mantêm este aqui.
  const alertaDaRecomendacao = recomendacao
    ? currentAlerts.find((a) => a.type === recomendacao.alertType) ?? null
    : null;
  const entradaCopiloto =
    currentVehicle && recomendacao && alertaDaRecomendacao
      ? montarEntrada(
          currentVehicle,
          alertaDaRecomendacao,
          recomendacao,
          estimarKmPorMes(currentVehicle, maintenances),
          pendentes,
        )
      : null;
  const corpoCopiloto = useCopilotoTexto(entradaCopiloto, recomendacao?.corpo ?? '');

  useEffect(() => {
    if (selectedVehicleIndex > 0 && vehicles.length > 1) {
      setTimeout(() => {
        swiperRef.current?.scrollTo({ x: selectedVehicleIndex * screenWidth, animated: false });
        setCurrentIndex(selectedVehicleIndex);
      }, 50);
    }
  }, []);

  function handleScrollEnd(e: any) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    setCurrentIndex(idx);
    dispatch({ type: 'SELECT_VEHICLE', payload: idx });
  }

  function openKmSheet() {
    setNewKm('');
    setKmError('');
    setShowKmSheet(true);
  }

  async function handleUpdateKm() {
    const km = parseInt(newKm);
    if (!newKm.trim() || isNaN(km)) {
      setKmError('Informe uma quilometragem válida');
      return;
    }
    const currentKm = currentVehicle?.currentKm ?? 0;
    if (km < currentKm) {
      setKmError(`O KM não pode ser menor que o atual (${currentKm.toLocaleString('pt-BR')} km)`);
      return;
    }
    if (!currentVehicle?.id) return;

    setKmLoading(true);
    try {
      await atualizarKm(currentVehicle.id, km);
      dispatch({ type: 'UPDATE_KM', payload: km });
      setShowKmSheet(false);
      setToast({ visible: true, message: `Quilometragem atualizada para ${km.toLocaleString('pt-BR')} km`, type: 'success' });
    } catch {
      setKmError('Erro ao atualizar. Tente novamente.');
    } finally {
      setKmLoading(false);
    }
  }

  const QUICK_ACTIONS = [
    { icon: 'speedometer-outline' as const, label: 'Atualizar\nKM',   onPress: openKmSheet },
    { icon: 'star-outline'        as const, label: 'Meus\npontos',    onPress: () => router.push('/(tabs)/perfil') },
    { icon: 'document-text-outline' as const, label: 'Passaporte\ndo veículo', onPress: () => router.push('/veiculo/passaporte') },
  ];

  const reportBorderColor =
    pioreStatus === 'urgente' ? Colors.danger :
    pioreStatus === 'atencao' ? Colors.warning :
    Colors.success;

  const reportIconColor = reportBorderColor;
  const reportIconName = pioreStatus === 'ok' ? 'checkmark-circle' : 'sparkles';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá, {firstName} 👋</Text>
            <Text style={styles.headerSub}>
              {vehicles.length > 0
                ? `Veja como está seu ${vehicles[currentIndex]?.model ?? 'Ford'}`
                : 'Cadastre seu veículo'}
            </Text>
          </View>
          <View style={styles.pointsBadge}>
            <Ionicons name="star" size={14} color={Colors.warning} />
            <Text style={styles.pointsText}>{profile?.points ?? 0} pts</Text>
          </View>
        </View>

        {/* ── Veículos ────────────────────────────────────────────────── */}
        <View style={styles.vehicleSection}>
          <Text style={styles.sectionLabel}>MEU FORD</Text>
          <TouchableOpacity
            style={styles.addVehicleBtn}
            onPress={() => router.push('/veiculo/cadastro?back=true')}
          >
            <Ionicons name="add" size={15} color={Colors.primary} />
            <Text style={styles.addVehicleText}>Adicionar</Text>
          </TouchableOpacity>
        </View>

        {vehicles.length > 0 ? (
          <>
            <ScrollView
              ref={swiperRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScrollEnd}
              style={styles.swiper}
            >
              {vehicles.map((v) => {
                const vehicleAlerts = computeAlerts(v, maintenances);
                return (
                  <View key={v.id} style={[styles.swiperPage, { width: screenWidth }]}>
                    <View style={styles.cardWrapper}>
                      <VehicleCard
                        vehicle={v}
                        alerts={vehicleAlerts}
                        onAgendar={() => router.push('/agendamento/novo')}
                      />
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {vehicles.length > 1 && (
              <View style={styles.dotsRow}>
                {vehicles.map((_, i) => (
                  <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
                ))}
              </View>
            )}

            {/* ── Copiloto ────────────────────────────────────────────── */}
            <View style={[styles.reportCard, { borderLeftColor: reportBorderColor }]}>
              <View style={styles.reportHeader}>
                <Ionicons name={reportIconName} size={18} color={reportIconColor} />
                <Text style={styles.reportTitle}>Copiloto</Text>
              </View>

              {recomendacao ? (
                <>
                  <Text style={styles.copilotoTitulo}>{recomendacao.titulo}</Text>
                  <TextoSuave style={styles.reportItemText}>{corpoCopiloto}</TextoSuave>

                  {pendentes > 1 && (
                    <Text style={styles.copilotoExtra}>
                      Mais {pendentes - 1} {pendentes - 1 === 1 ? 'item pendente' : 'itens pendentes'} —
                      dá para resolver na mesma visita.
                    </Text>
                  )}

                  <TouchableOpacity
                    style={styles.reportCta}
                    onPress={() =>
                      router.push(
                        `/agendamento/novo?alertType=${encodeURIComponent(recomendacao.alertType)}`,
                      )
                    }
                  >
                    <Text style={styles.reportCtaText}>
                      Agendar {recomendacao.alertType.toLowerCase()} →
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.reportSummary}>
                  Seu {currentVehicle?.model ?? 'Ford'} está em dia. Continue assim — cada serviço na
                  rede oficial vale pontos e histórico.
                </Text>
              )}
            </View>
          </>
        ) : (
          <TouchableOpacity
            style={styles.emptyCard}
            onPress={() => router.push('/veiculo/cadastro')}
          >
            <Ionicons name="car-outline" size={40} color={Colors.primary} />
            <Text style={styles.emptyTitle}>Cadastre seu Ford</Text>
            <Text style={styles.emptySubtitle}>
              Adicione seu veículo para ver alertas e histórico de manutenções.
            </Text>
            <Text style={styles.emptyAction}>Adicionar agora →</Text>
          </TouchableOpacity>
        )}

        {/* ── Atalhos ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Atalhos</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.actionCard}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.actionIcon}>
                <Ionicons name={action.icon} size={22} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>

      {/* ── Km Update BottomSheet ───────────────────────────────────── */}
      <BottomSheet visible={showKmSheet} onClose={() => setShowKmSheet(false)} title="Atualizar KM">
        <Text style={styles.sheetSub}>
          Mantenha o KM atualizado para alertas precisos.
        </Text>
        {currentVehicle && (
          <Text style={styles.sheetCurrentKm}>
            KM atual: {currentVehicle.currentKm.toLocaleString('pt-BR')} km
          </Text>
        )}
        <Input
          label="Novo KM"
          placeholder={`Ex: ${((currentVehicle?.currentKm ?? 0) + 1000).toLocaleString('pt-BR')}`}
          value={newKm}
          onChangeText={(v) => { setNewKm(v); setKmError(''); }}
          error={kmError}
          keyboardType="number-pad"
          returnKeyType="done"
          onSubmitEditing={handleUpdateKm}
        />
        <View style={styles.sheetBtn}>
          <Button label="Atualizar quilometragem" onPress={handleUpdateKm} loading={kmLoading} />
        </View>
      </BottomSheet>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    // A TabBar flutua sobre o conteúdo: sem esta folga o último card fica encoberto.
    paddingBottom: 140,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  greeting: {
    fontFamily: FontFamily.display,
    fontSize: 26,
    color: Colors.primary,
  },
  headerSub: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pointsText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.textPrimary,
  },

  // Vehicle section header
  vehicleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  addVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  addVehicleText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.primary,
  },

  // Swiper
  swiper: { marginHorizontal: -Spacing.lg },
  swiperPage: {},
  cardWrapper: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.inactive,
  },
  dotActive: {
    width: 18,
    backgroundColor: Colors.primary,
  },

  // Report / Diagnóstico
  reportCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  reportTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  reportSummary: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  reportDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  reportItemText: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 19,
  },
  copilotoTitulo: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  copilotoExtra: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  reportCta: {
    marginTop: Spacing.sm,
  },
  reportCtaText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.primary,
  },

  // Empty state
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  emptyTitle: {
    fontFamily: FontFamily.display,
    fontSize: 20,
    color: Colors.primary,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
  },
  emptyAction: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 14,
    color: Colors.primary,
    marginTop: Spacing.md,
  },

  // Quick actions
  sectionTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  actionLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 18,
  },

  // Km sheet
  sheetSub: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  sheetCurrentKm: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  sheetBtn: {
    marginTop: Spacing.md,
  },
});
