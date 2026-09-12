import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { CATEGORIAS, ORDEM_CATEGORIAS, categoriaDoServico, CategoriaServico } from '@/constants/serviceCategories';
import { useAlerts, Alert } from '@/hooks/useAlerts';
import { descreverAlerta } from '@/utils/alerts';
import { HistoricoItem, groupMaintenances } from '@/components/HistoricoItem';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  'Troca de Óleo':    'water-outline',
  'Revisão Geral':    'construct-outline',
  'Rodízio de Pneus': 'disc-outline',
  'Filtro de Ar':     'funnel-outline',
  'Outro':            'build-outline',
};

// ─── Alert Card ───────────────────────────────────────────────────────────────

function lastServiceText(date: Date | null): string {
  if (!date) return '';
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days < 1) return 'Última revisão: hoje';
  if (days < 30) return `Última revisão: há ${days} dia${days === 1 ? '' : 's'}`;
  const months = Math.round(days / 30);
  return `Última revisão: há ${months} ${months === 1 ? 'mês' : 'meses'}`;
}

function AlertItem({
  alert,
  lastServiceDate,
  onAgendar,
}: {
  alert: Alert;
  lastServiceDate: Date | null;
  onAgendar: (alertType: string) => void;
}) {
  const isUrgente = alert.status === 'urgente';

  const statusText = descreverAlerta(alert);

  const accentColor = isUrgente ? Colors.danger : Colors.warning;
  const icon = SERVICE_ICONS[alert.type] ?? 'build-outline';

  return (
    <View style={[styles.alertCard, { borderLeftColor: accentColor }]}>
      <View style={styles.alertIconWrap}>
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </View>

      <View style={styles.alertInfo}>
        <Text style={styles.alertTitle} numberOfLines={1}>{alert.type}</Text>
        <Text style={styles.alertStatus}>{statusText}</Text>
        <Text style={styles.alertLastService}>{lastServiceText(lastServiceDate)}</Text>
      </View>

      <TouchableOpacity style={styles.alertBtn} onPress={() => onAgendar(alert.type)} activeOpacity={0.7}>
        <Text style={styles.alertBtnText}>
          {isUrgente ? 'Agendar' : 'Lembrar'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ManutencoesScreen() {
  const { vehicle, vehicles, maintenances } = useUser();
  const alerts = useAlerts();

  // ── Filtros do histórico ─────────────────────────────────────────────────
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaServico | 'todas'>('todas');
  const [filtroOrigem, setFiltroOrigem] = useState<'todas' | 'rede' | 'fora'>('todas');

  /**
   * Histórico filtrado e do mais recente para o mais antigo.
   * A ordenação é explícita aqui — não depende da ordem que veio do banco nem
   * da ordem em que itens novos entraram no estado local.
   */
  const historico = useMemo(() => {
    return maintenances
      .filter((m) => filtroCategoria === 'todas' || categoriaDoServico(m.type) === filtroCategoria)
      .filter((m) =>
        filtroOrigem === 'todas' ? true :
        filtroOrigem === 'rede'  ? m.inNetwork !== false :
                                   m.inNetwork === false,
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [maintenances, filtroCategoria, filtroOrigem]);

  /** Quantos serviços existem por categoria — some das opções vazias. */
  const contagemPorCategoria = useMemo(() => {
    const c = {} as Record<CategoriaServico, number>;
    for (const m of maintenances) {
      const cat = categoriaDoServico(m.type);
      c[cat] = (c[cat] ?? 0) + 1;
    }
    return c;
  }, [maintenances]);

  const filtroAtivo = filtroCategoria !== 'todas' || filtroOrigem !== 'todas';

  /**
   * Descobre a que veículo cada serviço pertence.
   * Prioriza o VIN; cai para o vehicle_id nos registros anteriores ao chassi.
   */
  const rotuloDoVeiculo = useMemo(() => {
    const porVin = new Map<string, string>();
    const porId = new Map<string, string>();
    for (const v of vehicles) {
      const rotulo = `${v.brand} ${v.model} ${v.year}`;
      if (v.vin) porVin.set(v.vin, rotulo);
      porId.set(v.id, rotulo);
    }
    return (m: typeof maintenances[number]) =>
      (m.vin && porVin.get(m.vin)) || (m.vehicleId && porId.get(m.vehicleId)) || undefined;
  }, [vehicles]);

  const activeAlerts = [...alerts]
    .filter((a) => a.status !== 'ok')
    .sort((a, b) => (a.status === 'urgente' ? -1 : 1) - (b.status === 'urgente' ? -1 : 1));

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeHeader} edges={['top']}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>Manutenção</Text>
          <Text style={styles.subtitle}>
            Acompanhe a saúde do seu Ford e nunca perca uma revisão.
          </Text>
        </View>

      </SafeAreaView>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Pendências — do veículo selecionado ────────────────────────── */}
        <View style={styles.secaoTopo}>
          <Text style={styles.secaoTitulo}>Pendências</Text>
          {vehicle && (
            <Text style={styles.secaoEscopo}>
              Ford {vehicle.model} {vehicle.year}
            </Text>
          )}
        </View>

        {activeAlerts.length > 0 ? (
          activeAlerts.map((alert) => (
            <AlertItem
              key={alert.type}
              alert={alert}
              lastServiceDate={vehicle?.lastServiceDate ?? null}
              onAgendar={(type) => router.push(`/agendamento/novo?alertType=${encodeURIComponent(type)}`)}
            />
          ))
        ) : (
          <View style={styles.tudoEmDia}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.tudoEmDiaTexto}>
              Tudo em dia{vehicle ? ` no seu ${vehicle.model}` : ''}.
            </Text>
          </View>
        )}

        {/* ── Histórico — de todos os veículos ───────────────────────────── */}
        <View style={styles.secaoTopo}>
          <Text style={styles.secaoTitulo}>Histórico</Text>
          {vehicles.length > 1 && <Text style={styles.secaoEscopo}>todos os veículos</Text>}
        </View>

        {maintenances.length > 0 ? (
            <>
              {/* Filtro por categoria */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filtroLinha}
                style={styles.filtroScroll}
              >
                <TouchableOpacity
                  style={[styles.filtroChip, filtroCategoria === 'todas' && styles.filtroChipAtivo]}
                  onPress={() => setFiltroCategoria('todas')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filtroChipTexto, filtroCategoria === 'todas' && styles.filtroChipTextoAtivo]}>
                    Todas
                  </Text>
                </TouchableOpacity>

                {ORDEM_CATEGORIAS.filter((cat) => contagemPorCategoria[cat]).map((cat) => {
                  const ativo = filtroCategoria === cat;
                  const def = CATEGORIAS[cat];
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.filtroChip, ativo && { backgroundColor: def.cor, borderColor: def.cor }]}
                      onPress={() => setFiltroCategoria(ativo ? 'todas' : cat)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={def.icone} size={13} color={ativo ? Colors.surface : def.cor} />
                      <Text style={[styles.filtroChipTexto, { color: ativo ? Colors.surface : def.cor }]}>
                        {def.label} ({contagemPorCategoria[cat]})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Filtro por origem — o eixo que importa para o VIN Share */}
              <View style={styles.origemBarra}>
                {([
                  ['todas', 'Todos'],
                  ['rede', 'Rede oficial'],
                  ['fora', 'Fora da rede'],
                ] as const).map(([valor, rotulo]) => (
                  <TouchableOpacity
                    key={valor}
                    style={[styles.origemBtn, filtroOrigem === valor && styles.origemBtnAtivo]}
                    onPress={() => setFiltroOrigem(valor)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.origemTexto, filtroOrigem === valor && styles.origemTextoAtivo]}>
                      {rotulo}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.linhaContagem}>
                <Text style={styles.contagem}>
                  {historico.length} {historico.length === 1 ? 'serviço' : 'serviços'}
                  {filtroAtivo ? ` de ${maintenances.length}` : ''}
                </Text>

                <TouchableOpacity style={styles.registrarBtn} onPress={() => router.push('/servico/externo')} activeOpacity={0.7}>
                  <Ionicons name="add" size={14} color={Colors.primary} />
                  <Text style={styles.registrarBtnText}>Fora da rede</Text>
                </TouchableOpacity>
              </View>

              {historico.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="funnel-outline" size={44} color={Colors.inactive} />
                  <Text style={styles.emptyTitle}>Nada com esse filtro</Text>
                  <Text style={styles.emptyText}>Tente outra categoria ou origem.</Text>
                  <TouchableOpacity
                    onPress={() => { setFiltroCategoria('todas'); setFiltroOrigem('todas'); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.limparFiltro}>Limpar filtros</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                groupMaintenances(historico, rotuloDoVeiculo).map((group, i) => (
                  <HistoricoItem
                    key={`${group.date.toISOString()}__${group.dealership}__${group.vehicleLabel ?? ''}`}
                    group={group}
                    aberturaInicial={i === 0}
                  />
                ))
              )}
            </>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={52} color={Colors.inactive} />
              <Text style={styles.emptyTitle}>Sem registros</Text>
              <Text style={styles.emptyText}>
                Nenhuma revisão registrada ainda.
              </Text>
              <TouchableOpacity style={styles.registrarBtnVazio} onPress={() => router.push('/servico/externo')} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
                <Text style={styles.registrarBtnText}>Registrar serviço feito fora da rede</Text>
              </TouchableOpacity>
            </View>
        )}
      </ScrollView>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  secaoTopo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  secaoTitulo: {
    fontFamily: FontFamily.display,
    fontSize: 19,
    color: Colors.primary,
  },
  secaoEscopo: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  tudoEmDia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.successBg,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  tudoEmDiaTexto: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: Colors.success,
  },
  filtroScroll: { marginHorizontal: -Spacing.lg, marginBottom: Spacing.sm },
  filtroLinha: { gap: 6, paddingHorizontal: Spacing.lg },
  filtroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filtroChipAtivo: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filtroChipTexto: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: Colors.textSecondary },
  filtroChipTextoAtivo: { color: Colors.surface },

  origemBarra: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 999,
    padding: 3,
    marginBottom: Spacing.sm,
  },
  origemBtn: { flex: 1, paddingVertical: 7, borderRadius: 999, alignItems: 'center' },
  origemBtnAtivo: {
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  origemTexto: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  origemTextoAtivo: { fontFamily: FontFamily.bodySemiBold, color: Colors.primary },

  contagem: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  limparFiltro: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.primary,
    marginTop: Spacing.md,
  },
  linhaContagem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  registrarBtnVazio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    marginTop: Spacing.md,
  },
  registrarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
  },
  registrarBtnText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: Colors.primary,
  },
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeHeader: {
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    color: Colors.primary,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },

  // Tab switcher

  // List
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    // A TabBar flutua sobre a lista: sem esta folga o último card fica encoberto.
    paddingBottom: 120,
    gap: Spacing.sm,
  },

  // Alert card
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderLeftWidth: 4,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: 'hidden',
  },
  alertIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(19,58,124,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertInfo: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  alertStatus: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  alertLastService: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textSecondary,
    opacity: 0.7,
  },
  alertBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  alertBtnText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.primary,
  },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    color: Colors.textPrimary,
  },
  emptyText: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
});
