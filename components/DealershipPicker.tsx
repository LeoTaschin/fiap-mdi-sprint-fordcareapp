import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FORD_DEALERSHIPS, Dealership } from '@/constants/fordDealerships';
import { requestLocationPermission, getCurrentLocation, getDealershipsNearby } from '@/services/location';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

type DealershipComDistancia = Dealership & { distanceKm?: number };

/** A concessionária está aberta agora? */
export function estaAberta(d: Dealership, agora = new Date()): boolean {
  const dia = agora.getDay(); // 0 = domingo, 6 = sábado
  const hora = agora.getHours() + agora.getMinutes() / 60;
  if (dia === 0) return false;
  if (dia === 6) return d.openSaturday != null && hora >= d.openSaturday[0] && hora < d.openSaturday[1];
  return hora >= d.openWeekday[0] && hora < d.openWeekday[1];
}

type Props = {
  selecionada: Dealership | null;
  onSelecionar: (d: Dealership) => void;
};

/**
 * Seletor de concessionária: busca por nome ou bairro, ordenação por distância
 * quando há permissão de localização, indicador de aberto/fechado e atalho para
 * ligar. Vive dentro do fluxo de agendamento — é lá que a escolha acontece.
 */
export function DealershipPicker({ selecionada, onSelecionar }: Props) {
  const [busca, setBusca] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const permitido = await requestLocationPermission();
        if (!permitido || cancelado) return;
        const pos = await getCurrentLocation();
        if (!cancelado) setCoords({ latitude: pos.latitude, longitude: pos.longitude });
      } catch {
        // Localização é melhoria, não requisito.
      }
    })();
    return () => { cancelado = true; };
  }, []);

  const lista = useMemo<DealershipComDistancia[]>(() => {
    const base: DealershipComDistancia[] = coords
      ? getDealershipsNearby(coords.latitude, coords.longitude)
      : FORD_DEALERSHIPS;

    const q = busca.toLowerCase().trim();
    if (!q) return base;
    return base.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.neighborhood.toLowerCase().includes(q) ||
        d.city.toLowerCase().includes(q),
    );
  }, [busca, coords]);

  return (
    <View>
      <View style={styles.buscaWrap}>
        <Ionicons name="search" size={16} color={Colors.textSecondary} />
        <TextInput
          style={styles.buscaInput}
          placeholder="Buscar por nome ou bairro..."
          placeholderTextColor={Colors.textMuted}
          value={busca}
          onChangeText={setBusca}
          returnKeyType="search"
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca('')} hitSlop={10}>
            <Ionicons name="close-circle" size={16} color={Colors.inactive} />
          </TouchableOpacity>
        )}
      </View>

      {lista.length === 0 ? (
        <Text style={styles.vazio}>Nenhuma concessionária encontrada.</Text>
      ) : (
        lista.map((d) => {
          const escolhida = selecionada?.id === d.id;
          const aberta = estaAberta(d);
          return (
            <TouchableOpacity
              key={d.id}
              style={[styles.item, escolhida && styles.itemEscolhido]}
              onPress={() => onSelecionar(d)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={escolhida ? 'checkmark-circle' : 'storefront-outline'}
                size={20}
                color={escolhida ? Colors.surface : Colors.primary}
              />

              <View style={styles.info}>
                <Text style={[styles.nome, escolhida && styles.textoEscolhido]} numberOfLines={1}>
                  {d.name}
                </Text>
                <Text style={[styles.endereco, escolhida && styles.subEscolhido]} numberOfLines={1}>
                  {d.neighborhood} · {d.city}
                  {d.distanceKm != null ? ` · ${d.distanceKm.toFixed(1)} km` : ''}
                </Text>
                <Text
                  style={[
                    styles.status,
                    { color: escolhida ? 'rgba(255,255,255,0.85)' : aberta ? Colors.success : Colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {aberta ? 'Aberto agora' : 'Fechado'} · {d.hours}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${d.phone.replace(/\D/g, '')}`)}
                hitSlop={10}
                style={styles.ligar}
              >
                <Ionicons name="call-outline" size={17} color={escolhida ? Colors.surface : Colors.primary} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  buscaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buscaInput: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textPrimary,
    padding: 0,
  },
  vazio: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemEscolhido: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  info: { flex: 1 },
  nome: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Colors.textPrimary },
  endereco: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  status: { fontFamily: FontFamily.bodyMedium, fontSize: 11, marginTop: 2 },
  textoEscolhido: { color: Colors.surface },
  subEscolhido: { color: 'rgba(255,255,255,0.75)' },
  ligar: { padding: 4 },
});
