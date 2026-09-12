import { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { buscarAgendamentos, Agendamento } from '@/services/agendamentos';
import { useUser } from '@/contexts/UserContext';
import { AgendamentoItem } from '@/components/AgendamentoItem';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

const FILTROS = [
  { key: 'todos',     label: 'Todos' },
  { key: 'agendado',  label: 'Agendados' },
  { key: 'concluido', label: 'Concluídos' },
] as const;

/**
 * Meus agendamentos.
 *
 * A lista de concessionárias saiu daqui de propósito: ela já era o passo 2 do
 * fluxo de `agendamento/novo`. Ter a mesma lista como aba E como etapa criava
 * dois caminhos para a mesma decisão — a origem da confusão de navegação.
 * Agora esta tela responde a uma pergunta só: "o que eu já marquei?"
 */
export default function AgendamentoScreen() {
  const { user, vehicles } = useUser();
  const [appointments, setAppointments] = useState<Agendamento[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof FILTROS)[number]['key']>('todos');
  const [carregando, setCarregando] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      buscarAgendamentos(user.id)
        .then(setAppointments)
        .catch(() => {})
        .finally(() => setCarregando(false));
    }, [user]),
  );

  const filtrados = useMemo(() => {
    if (statusFilter === 'todos') return appointments;
    return appointments.filter((a) => a.status === statusFilter);
  }, [appointments, statusFilter]);

  const semVeiculo = vehicles.length === 0;

  function agendar() {
    if (semVeiculo) {
      router.push('/veiculo/cadastro?back=true');
      return;
    }
    router.push('/agendamento/novo');
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeHeader} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Agendamentos</Text>
          <Text style={styles.subtitle}>Suas visitas à rede oficial Ford.</Text>
        </View>

        <TouchableOpacity style={styles.agendarBtn} onPress={agendar} activeOpacity={0.85}>
          <Ionicons name="calendar-outline" size={18} color={Colors.surface} />
          <Text style={styles.agendarBtnText}>
            {semVeiculo ? 'Cadastrar veículo para agendar' : 'Agendar revisão'}
          </Text>
        </TouchableOpacity>

        {appointments.length > 0 && (
          <View style={styles.filtros}>
            {FILTROS.map((f) => {
              const ativo = statusFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filtroBtn, ativo && styles.filtroBtnAtivo]}
                  onPress={() => setStatusFilter(f.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filtroTexto, ativo && styles.filtroTextoAtivo]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </SafeAreaView>

      <FlatList
        data={filtrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <AgendamentoItem item={item} />}
        ListEmptyComponent={
          carregando ? (
            <View style={styles.empty}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.emptyText}>Carregando seus agendamentos…</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={52} color={Colors.inactive} />
              <Text style={styles.emptyTitle}>
                {appointments.length === 0 ? 'Nenhum agendamento' : 'Nada com esse filtro'}
              </Text>
              <Text style={styles.emptyText}>
                {appointments.length === 0
                  ? 'Marque uma revisão na rede oficial e ela aparece aqui.'
                  : 'Tente outro status.'}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  safeHeader: { backgroundColor: Colors.background, paddingHorizontal: Spacing.lg },

  header: { paddingTop: Spacing.md, marginBottom: Spacing.md },
  title: { fontFamily: FontFamily.display, fontSize: 28, color: Colors.primary },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  agendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    marginBottom: Spacing.md,
  },
  agendarBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Colors.surface },

  filtros: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 999,
    padding: 3,
    marginBottom: Spacing.sm,
  },
  filtroBtn: { flex: 1, paddingVertical: 7, borderRadius: 999, alignItems: 'center' },
  filtroBtnAtivo: {
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  filtroTexto: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  filtroTextoAtivo: { fontFamily: FontFamily.bodySemiBold, color: Colors.primary },

  lista: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    // A TabBar flutua sobre a lista.
    paddingBottom: 120,
    gap: Spacing.sm,
  },

  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyTitle: {
    fontFamily: FontFamily.display,
    fontSize: 19,
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
});
