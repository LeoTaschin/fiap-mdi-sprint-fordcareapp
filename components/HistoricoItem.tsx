import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Maintenance } from '@/contexts/UserContext';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { CATEGORIAS, categoriaDoServico } from '@/constants/serviceCategories';

export type MaintenanceGroup = {
  date: Date;
  dealership: string;
  /** Ex.: "Ford Ranger 2021" — indefinido quando o veículo não é identificável. */
  vehicleLabel?: string;
  items: Maintenance[];
  totalPoints: number;
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

// LayoutAnimation precisa ser habilitada explicitamente no Android.
// Se não estiver disponível, a expansão simplesmente acontece sem animar.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  group: MaintenanceGroup;
  /** A visita mais recente já abre expandida; as demais começam recolhidas. */
  aberturaInicial?: boolean;
};

export function HistoricoItem({ group, aberturaInicial = false }: Props) {
  // Um grupo nasce de uma visita só, então todos os itens compartilham a origem.
  const foraDaRede = group.items.length > 0 && group.items.every((i) => i.inNetwork === false);

  const [aberto, setAberto] = useState(aberturaInicial);

  function alternar() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAberto((v) => !v);
  }

  const qtd = group.items.length;
  const resumo = group.items.map((i) => i.type).join(', ');

  return (
    <View style={[styles.card, foraDaRede && styles.cardForaDaRede]}>

      {/* Header — toca para expandir ou recolher */}
      <TouchableOpacity
        style={styles.header}
        onPress={alternar}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberto }}
        accessibilityLabel={`${formatDate(group.date)}, ${qtd} ${qtd === 1 ? 'serviço' : 'serviços'}`}
      >
        <View style={styles.headerLeft}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
            <Text style={styles.dateText}>{formatDate(group.date)}</Text>
          </View>
          {group.vehicleLabel ? (
            <View style={styles.veiculoRow}>
              <Ionicons name="car-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.veiculoText} numberOfLines={1}>{group.vehicleLabel}</Text>
            </View>
          ) : null}

          {group.dealership ? (
            <View style={styles.dealerRow}>
              <Ionicons
                name={foraDaRede ? 'build-outline' : 'storefront-outline'}
                size={12}
                color={Colors.textSecondary}
              />
              <Text style={styles.dealerText} numberOfLines={1}>{group.dealership}</Text>
            </View>
          ) : null}

          {/* Recolhido: uma linha resume o que foi feito na visita */}
          {!aberto && (
            <Text style={styles.resumo} numberOfLines={1}>
              {qtd} {qtd === 1 ? 'serviço' : 'serviços'} · {resumo}
            </Text>
          )}
        </View>

        <View style={styles.headerRight}>
          {foraDaRede ? (
            <View style={styles.foraBadge}>
              <Text style={styles.foraBadgeText}>fora da rede</Text>
            </View>
          ) : (
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsValue}>+{group.totalPoints}</Text>
              <Text style={styles.pointsLabel}>pts</Text>
            </View>
          )}
          <Ionicons
            name={aberto ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {!aberto ? null : (
      <>
      {/* Divider */}
      <View style={styles.divider} />

      {/* Service rows */}
      {group.items.map((item, i) => (
        <View
          key={item.id}
          style={[styles.serviceRow, i < group.items.length - 1 && styles.serviceRowBorder]}
        >
          <View style={[styles.serviceIconWrap, { backgroundColor: `${CATEGORIAS[categoriaDoServico(item.type)].cor}14` }]}>
            <Ionicons
              name={CATEGORIAS[categoriaDoServico(item.type)].icone}
              size={16}
              color={CATEGORIAS[categoriaDoServico(item.type)].cor}
            />
          </View>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceType}>{item.type}</Text>
            <View style={styles.serviceMetaRow}>
              <Text style={[styles.categoriaTag, { color: CATEGORIAS[categoriaDoServico(item.type)].cor }]}>
                {CATEGORIAS[categoriaDoServico(item.type)].label}
              </Text>
              {item.km > 0 && (
                <Text style={styles.serviceMeta}>· {item.km.toLocaleString('pt-BR')} km</Text>
              )}
            </View>
          </View>
          <View style={styles.servicePoints}>
            <Text style={styles.servicePointsText}>+{item.pointsEarned} pts</Text>
          </View>
        </View>
      ))}
      </>
      )}

    </View>
  );
}

// ─── Group helper ─────────────────────────────────────────────────────────────

/**
 * Agrupa manutenções por VISITA: mesmo dia, mesma unidade e mesmo veículo.
 *
 * O veículo entra na chave de propósito — sem ele, dois carros atendidos no
 * mesmo dia e na mesma concessionária virariam um card só, misturando históricos.
 *
 * @param resolveVeiculo opcional; quando ausente, o agrupamento ignora o veículo
 *        (é o caso do Passaporte, que já trata de um chassi só).
 */
export function groupMaintenances(
  maintenances: Maintenance[],
  resolveVeiculo?: (m: Maintenance) => string | undefined,
): MaintenanceGroup[] {
  const map = new Map<string, MaintenanceGroup>();

  for (const m of maintenances) {
    const day = m.date.toISOString().slice(0, 10);
    const vehicleLabel = resolveVeiculo?.(m);
    const key = `${day}__${m.dealership}__${vehicleLabel ?? ''}`;
    if (!map.has(key)) {
      map.set(key, { date: m.date, dealership: m.dealership, vehicleLabel, items: [], totalPoints: 0 });
    }
    const group = map.get(key)!;
    group.items.push(m);
    group.totalPoints += m.pointsEarned;
  }

  return Array.from(map.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  veiculoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  veiculoText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: Colors.primary,
  },
  resumo: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  serviceMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  categoriaTag: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
  },
  cardForaDaRede: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.inactive,
  },
  foraBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.surfaceNeutral,
  },
  foraBadgeText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.primary,
  },
  dealerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dealerText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },

  // Points badge
  pointsBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(30,138,68,0.09)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 52,
  },
  pointsValue: {
    fontFamily: FontFamily.display,
    fontSize: 17,
    color: Colors.success,
    lineHeight: 20,
  },
  pointsLabel: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: Colors.success,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.surfaceMuted,
    marginHorizontal: Spacing.md,
  },

  // Service rows
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  serviceRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.background,
  },
  serviceIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(19,58,124,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  serviceInfo: {
    flex: 1,
    gap: 2,
  },
  serviceType: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  serviceMeta: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  servicePoints: {
    alignItems: 'flex-end',
  },
  servicePointsText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: Colors.success,
  },
});
