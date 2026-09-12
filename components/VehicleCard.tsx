import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Vehicle } from '@/contexts/UserContext';
import { Alert } from '@/hooks/useAlerts';
import { getCarImage, COLOR_HEX, COLOR_LABELS, CarColor } from '@/constants/fordModels';
import { formatKm } from '@/utils/formatKm';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  vehicle: Vehicle;
  alerts: Alert[];
  onAgendar?: () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  ok:      { label: 'Veículo em dia',     color: Colors.success, icon: 'checkmark-circle' as const },
  atencao: { label: 'Atenção necessária', color: Colors.warning,      icon: 'warning'          as const },
  urgente: { label: 'Manutenção vencida',  color: Colors.danger,  icon: 'alert-circle'     as const },
};

// Converte "Troca de Óleo" → "Óleo",  "Rodízio de Pneus" → "Pneus", etc.
const SERVICE_SHORT: Record<string, string> = {
  'Troca de Óleo':    'Óleo',
  'Revisão Geral':    'Revisão',
  'Rodízio de Pneus': 'Pneus',
  'Filtro de Ar':     'Filtro',
};

function shortName(type: string) {
  return SERVICE_SHORT[type] ?? type.split(' ')[0];
}

function statColor(alert: Alert): string {
  return alert.status === 'urgente'
    ? Colors.danger
    : alert.status === 'atencao'
    ? Colors.warning
    : Colors.textPrimary;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VehicleCard({ vehicle, alerts, onAgendar }: Props) {
  const carImage = getCarImage(vehicle.model, vehicle.color);
  const colorHex = COLOR_HEX[vehicle.color as CarColor];
  const colorLabel = COLOR_LABELS[vehicle.color as CarColor];

  const urgentAlerts  = alerts.filter((a) => a.status === 'urgente');
  const atencaoAlerts = alerts.filter((a) => a.status === 'atencao');
  const overallStatus = urgentAlerts.length > 0 ? 'urgente' : atencaoAlerts.length > 0 ? 'atencao' : 'ok';

  // Nomear o que está pendente evita o mal-entendido de resolver um item e
  // continuar vendo o mesmo aviso genérico por causa de outro.
  const pendentes = urgentAlerts.length > 0 ? urgentAlerts : atencaoAlerts;
  const rotuloStatus =
    pendentes.length === 0
      ? STATUS_CONFIG.ok.label
      : pendentes.length === 1
      ? `${shortName(pendentes[0].type)} ${urgentAlerts.length > 0 ? 'vencido' : 'a vencer'}`
      : `${pendentes.map((a) => shortName(a.type)).slice(0, 2).join(', ')}${pendentes.length > 2 ? ` +${pendentes.length - 2}` : ''}`;
  const status = STATUS_CONFIG[overallStatus];
  const nextAlert = urgentAlerts[0] ?? atencaoAlerts[0] ?? null;

  // Stat "desde revisão" herda cor do alerta mais urgente que existe
  const sinceServiceAlert = alerts.find(
    (a) => a.status === 'urgente' || a.status === 'atencao'
  );
  const sinceKm = vehicle.currentKm - vehicle.lastServiceKm;

  return (
    <View style={styles.card}>

      {/* ── Imagem ── */}
      <View style={styles.imageArea}>
        {carImage ? (
          <Image source={carImage} style={styles.carImage} resizeMode="contain" />
        ) : (
          <Ionicons name="car-outline" size={80} color={Colors.inactive} />
        )}
        {/* Fade para o branco do body do card */}
        <View style={styles.imageFade} pointerEvents="none" />
      </View>

      {/* ── Body ── */}
      <View style={styles.body}>

        {/* Título + indicador de cor */}
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <Text style={styles.modelText}>Ford {vehicle.model}</Text>
            <Text style={styles.yearText}>{vehicle.year}</Text>
          </View>
          <View style={styles.colorIndicator}>
            <View style={[styles.colorDot, { backgroundColor: colorHex }]} />
            <Text style={styles.colorLabel}>{colorLabel}</Text>
          </View>
        </View>

        {/* Badge de status */}
        <View style={[styles.statusBadge, { backgroundColor: status.color + '18' }]}>
          <Ionicons name={status.icon} size={13} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{rotuloStatus}</Text>
        </View>

        {/* Divisor */}
        <View style={styles.divider} />

        {/* Stats */}
        <View style={styles.statsRow}>
          {/* KM atual — sempre neutro */}
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatKm(vehicle.currentKm)}</Text>
            <Text style={styles.statLabel}>KM atual</Text>
          </View>

          <View style={styles.statSep} />

          {/* Desde revisão — colorido se há alerta */}
          <View style={styles.stat}>
            <Text style={[
              styles.statValue,
              sinceServiceAlert && { color: statColor(sinceServiceAlert) },
            ]}>
              {formatKm(sinceKm)}
            </Text>
            <Text style={styles.statLabel}>Desde revisão</Text>
          </View>

          {/* Próxima revisão — colorida e com nome real do serviço */}
          {nextAlert && (
            <>
              <View style={styles.statSep} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: statColor(nextAlert) }]}>
                  {nextAlert.kmRemaining > 0
                    ? formatKm(nextAlert.kmRemaining)
                    : 'Vencido'}
                </Text>
                <Text style={styles.statLabel}>{shortName(nextAlert.type)}</Text>
              </View>
            </>
          )}
        </View>

        {/* CTA — aparece apenas quando há algo pendente */}
        {overallStatus !== 'ok' && onAgendar && (
          <TouchableOpacity
            style={[styles.agendarBtn, { backgroundColor: status.color }]}
            onPress={onAgendar}
            activeOpacity={0.85}
          >
            <Ionicons name="calendar-outline" size={15} color="#FFF" />
            <Text style={styles.agendarText}>Agendar revisão</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },

  // Imagem
  imageArea: {
    height: 190,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carImage: {
    width: '95%',
    height: 175,
  },
  imageFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    backgroundColor: 'transparent',
    // Simula fade para branco usando múltiplos views não é possível sem LinearGradient,
    // então usamos uma borda suave via shadow no body
  },

  // Body
  body: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  modelText: {
    fontFamily: FontFamily.display,
    fontSize: 24,
    color: Colors.primary,
  },
  yearText: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
  },

  // Indicador de cor
  colorIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  colorLabel: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textSecondary,
  },

  // Status
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: Spacing.md,
  },
  statusText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
  },

  // Divisor
  divider: {
    height: 1,
    backgroundColor: Colors.background,
    marginBottom: Spacing.md,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  statSep: {
    width: 1,
    height: 28,
    backgroundColor: Colors.surfaceMuted,
  },

  // CTA
  agendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingVertical: 12,
    borderRadius: 10,
  },
  agendarText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 14,
    color: Colors.surface,
  },
});
