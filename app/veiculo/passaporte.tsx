import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { groupMaintenances } from '@/components/HistoricoItem';
import { analisarVin } from '@/utils/vin';
import { formatDate } from '@/utils/formatDate';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

/**
 * Passaporte do Veículo.
 *
 * O histórico aqui é lido pelo CHASSI, não pelo usuário — é essa inversão que
 * faz o registro sobreviver à troca de dono e fecha o vazamento de VIN Share
 * que acontece a cada revenda.
 */
export default function PassaporteScreen() {
  const { vehicle, maintenances } = useUser();

  const vin = vehicle?.vin;
  const vinInfo = useMemo(() => (vin ? analisarVin(vin) : null), [vin]);

  const servicos = useMemo(
    () => (vin ? maintenances.filter((m) => m.vin === vin) : []),
    [maintenances, vin],
  );
  const grupos = useMemo(() => groupMaintenances(servicos), [servicos]);

  // Quanto do histórico deste chassi passou pela rede oficial.
  // É o VIN Share do veículo — precisa ser calculado, nunca afirmado.
  const naRede = servicos.filter((m) => m.inNetwork !== false).length;
  const pctRede = servicos.length ? Math.round((naRede / servicos.length) * 100) : 0;

  const desde = servicos.length
    ? servicos.reduce((a, m) => (m.date < a ? m.date : a), servicos[0].date)
    : null;
  const anosDeHistorico = desde
    ? Math.max(1, Math.round((Date.now() - desde.getTime()) / (365 * 86_400_000)))
    : 0;

  async function compartilhar() {
    if (!vehicle || !vin) return;
    const linhas = grupos
      .slice(0, 8)
      .map((g) => `• ${formatDate(g.date)} — ${g.items.map((i) => i.type).join(', ')} (${g.dealership})`);
    await Share.share({
      message:
        `Passaporte FordCare — ${vehicle.brand} ${vehicle.model} ${vehicle.year}\n` +
        `Chassi: ${vin}\n` +
        `${servicos.length} ${servicos.length === 1 ? 'serviço registrado' : 'serviços registrados'}, ` +
        `${naRede} na rede oficial Ford (${pctRede}%)` +
        (desde ? ` desde ${formatDate(desde)}` : '') +
        `\n\n${linhas.join('\n')}`,
    }).catch(() => {});
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Cabecalho />
        <View style={styles.empty}>
          <Ionicons name="car-outline" size={48} color={Colors.inactive} />
          <Text style={styles.emptyTitle}>Nenhum veículo selecionado</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Cabecalho />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.idCard}>
          <Text style={styles.idModelo}>
            {vehicle.brand} {vehicle.model} <Text style={styles.idAno}>{vehicle.year}</Text>
          </Text>

          {vin ? (
            <>
              <Text style={styles.idLabel}>CHASSI</Text>
              <Text style={styles.idVin}>{vin}</Text>
              {vinInfo?.valido && (
                <Text style={styles.idMeta}>
                  {[vinInfo.fabricante, vinInfo.paisOrigem, vinInfo.anoModelo && `ano-modelo ${vinInfo.anoModelo}`]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.idMeta}>
              Este veículo ainda não tem chassi cadastrado. Sem ele, o histórico não acompanha o
              carro numa futura venda.
            </Text>
          )}
        </View>

        {vin && (
          <View style={styles.selo}>
            <View style={styles.seloItem}>
              <Text style={styles.seloNumero}>{servicos.length}</Text>
              <Text style={styles.seloLabel}>{servicos.length === 1 ? 'serviço' : 'serviços'}</Text>
            </View>
            <View style={styles.seloDivisor} />
            <View style={styles.seloItem}>
              <Text style={styles.seloNumero}>{anosDeHistorico || '—'}</Text>
              <Text style={styles.seloLabel}>
                {anosDeHistorico === 1 ? 'ano de histórico' : 'anos de histórico'}
              </Text>
            </View>
            <View style={styles.seloDivisor} />
            <View style={styles.seloItem}>
              <Text style={styles.seloNumero}>{pctRede}%</Text>
              <Text style={styles.seloLabel}>na rede oficial</Text>
            </View>
          </View>
        )}

        {vin && servicos.length > 0 && (
          <TouchableOpacity style={styles.shareBtn} onPress={compartilhar} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={17} color={Colors.primary} />
            <Text style={styles.shareBtnText}>Compartilhar passaporte</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Linha do tempo</Text>

        {grupos.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={44} color={Colors.inactive} />
            <Text style={styles.emptyTitle}>Histórico começa agora</Text>
            <Text style={styles.emptyText}>
              Cada revisão feita na rede oficial entra aqui e passa a valorizar o veículo na revenda.
            </Text>
          </View>
        ) : (
          grupos.map((g, i) => (
            <View key={`${g.date.toISOString()}__${g.dealership}`} style={styles.linha}>
              <View style={styles.trilho}>
                <View
                  style={[
                    styles.bolinha,
                    g.items.every((i) => i.inNetwork === false) && styles.bolinhaFora,
                  ]}
                />
                {i < grupos.length - 1 && <View style={styles.fio} />}
              </View>

              <View style={styles.evento}>
                <View style={styles.eventoTopo}>
                  <Text style={styles.eventoData}>{formatDate(g.date)}</Text>
                  {g.items.every((i) => i.inNetwork === false) && (
                    <View style={styles.foraTag}>
                      <Text style={styles.foraTagTexto}>fora da rede</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.eventoLocal}>{g.dealership}</Text>
                {g.items.map((item) => {
                  const naRedeItem = item.inNetwork !== false;
                  return (
                    <View key={item.id} style={styles.servicoRow}>
                      <Ionicons
                        name={naRedeItem ? 'checkmark-circle' : 'ellipse-outline'}
                        size={13}
                        color={naRedeItem ? Colors.success : Colors.textMuted}
                      />
                      <Text style={[styles.servicoTexto, !naRedeItem && styles.servicoFora]}>
                        {item.type} · {item.km.toLocaleString('pt-BR')} km
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}

        <Text style={styles.rodape}>
          O histórico pertence ao chassi, não à conta. Ao vender o veículo, o próximo dono recebe
          este registro técnico — sem nenhum dado pessoal seu.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Cabecalho() {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={26} color={Colors.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitulo}>Passaporte do veículo</Text>
      <View style={{ width: 26 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerTitulo: { fontFamily: FontFamily.display, fontSize: 19, color: Colors.primary },

  scroll: { padding: Spacing.lg, paddingBottom: 60 },

  idCard: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  idModelo: { fontFamily: FontFamily.display, fontSize: 24, color: Colors.surface },
  idAno: { color: Colors.onPrimaryMuted },
  idLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: Colors.onPrimaryMuted,
    letterSpacing: 1.4,
    marginTop: Spacing.md,
  },
  idVin: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 17,
    color: Colors.surface,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  idMeta: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.onPrimaryMuted,
    marginTop: 6,
    lineHeight: 18,
  },

  selo: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  seloItem: { flex: 1, alignItems: 'center' },
  seloNumero: { fontFamily: FontFamily.display, fontSize: 22, color: Colors.primary },
  seloLabel: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  seloDivisor: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginBottom: Spacing.lg,
  },
  shareBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Colors.primary },

  sectionTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.md,
  },

  linha: { flexDirection: 'row' },
  trilho: { width: 22, alignItems: 'center' },
  bolinha: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    marginTop: 5,
  },
  fio: { flex: 1, width: 2, backgroundColor: Colors.borderStrong, marginVertical: 3 },

  evento: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  eventoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  foraTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.surfaceNeutral,
  },
  foraTagTexto: { fontFamily: FontFamily.bodyMedium, fontSize: 10, color: Colors.textSecondary },
  servicoFora: { color: Colors.textSecondary },
  bolinhaFora: { backgroundColor: Colors.inactive },
  eventoData: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Colors.textPrimary },
  eventoLocal: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  servicoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  servicoTexto: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.textPrimary },

  empty: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyTitle: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: Colors.primary,
    marginTop: Spacing.sm,
  },
  emptyText: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 19,
    paddingHorizontal: Spacing.lg,
  },

  rodape: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
});
