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
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUser, Vehicle } from '@/contexts/UserContext';
import { registrarManutencao } from '@/services/maintenance';
import { atualizarServico } from '@/services/vehicle';
import { MAINTENANCE_RULES } from '@/constants/maintenanceRules';
import { CATEGORIAS, categoriaDoServico } from '@/constants/serviceCategories';
import { AgendamentoCarCard } from '@/components/AgendamentoCarCard';
import { Input } from '@/components/ui/Input';
import { logDevError, safeErrorMessage } from '@/utils/safeError';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

const TIPOS_SERVICO = [...MAINTENANCE_RULES.map((r) => r.type), 'Outro'];

/** Aceita DD/MM/AAAA e devolve Date, ou null se a data não existir ou for futura. */
function parseDataBR(texto: string): Date | null {
  const m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, aaaa] = m;
  const d = new Date(Number(aaaa), Number(mm) - 1, Number(dd));
  if (d.getDate() !== Number(dd) || d.getMonth() !== Number(mm) - 1) return null;
  if (d.getTime() > Date.now()) return null;
  return d;
}

/**
 * Nenhuma chamada de rede pode travar a tela para sempre.
 * Sem isso, uma promessa que nunca resolve deixa o botão girando eternamente e
 * o `catch` nunca dispara — foi exatamente o que aconteceu aqui.
 */
function comTimeout<T>(promessa: Promise<T>, rotulo: string, ms = 12000): Promise<T> {
  return Promise.race([
    promessa,
    new Promise<T>((_, rejeitar) =>
      setTimeout(() => rejeitar(new Error(`TIMEOUT: ${rotulo}`)), ms),
    ),
  ]);
}

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

/**
 * Registro de serviço feito FORA da rede oficial.
 *
 * Mesmo desenho do fluxo de agendamento (veículo → serviços → revisão), porque
 * é a mesma tarefa mental. A diferença é o destino do dado: aqui nada pontua e
 * tudo entra marcado como fora da rede — é esse registro que dá à Ford o
 * denominador real do VIN Share.
 */
export default function ServicoExternoScreen() {
  const { user, vehicles, selectedVehicleIndex, dispatch } = useUser();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  // Escolha explícita do usuário. O inicializador do useState roda uma vez só —
  // se o contexto ainda não tiver carregado, ele fixaria null para sempre.
  const [escolhido, setEscolhido] = useState<Vehicle | null>(null);
  const veiculo = escolhido ?? vehicles[selectedVehicleIndex] ?? null;

  const [tipos, setTipos] = useState<string[]>([]);

  // O caso comum é "acabei de fazer": KM atual do veículo e data de hoje já
  // preenchidos. Guardamos só o que o usuário digitou, para o padrão continuar
  // válido enquanto o veículo carrega ou se ele trocar de carro na etapa 1.
  const [kmDigitado, setKmDigitado] = useState<string | null>(null);
  const [dataDigitada, setDataDigitada] = useState<string | null>(null);
  const km = kmDigitado ?? (veiculo ? String(veiculo.currentKm) : '');
  const data = dataDigitada ?? new Date().toLocaleDateString('pt-BR');

  const [local, setLocal] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const quando = useMemo(() => parseDataBR(data), [data]);

  function voltar() {
    if (step === 1) { router.back(); return; }
    setErros({});
    setStep((s) => (s - 1) as 1 | 2 | 3);
  }

  function alternarTipo(t: string) {
    setTipos((atual) => (atual.includes(t) ? atual.filter((x) => x !== t) : [...atual, t]));
    setErros((p) => ({ ...p, tipos: '' }));
  }

  function formatarData(texto: string) {
    const d = texto.replace(/\D/g, '').slice(0, 8);
    setDataDigitada([d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/'));
    setErros((p) => ({ ...p, data: '' }));
  }

  function avancar() {
    if (step === 2) {
      const e: Record<string, string> = {};
      if (tipos.length === 0) e.tipos = 'Selecione ao menos um serviço';
      if (!km.trim() || isNaN(Number(km))) e.km = 'Informe a quilometragem';
      else if (veiculo && Number(km) > veiculo.currentKm) {
        e.km = `Maior que o KM atual do veículo (${veiculo.currentKm.toLocaleString('pt-BR')} km)`;
      }
      if (!quando) e.data = 'Data inválida (DD/MM/AAAA) e não pode ser futura';
      if (!local.trim()) e.local = 'Onde o serviço foi feito?';
      if (Object.keys(e).length) { setErros(e); return; }
    }
    setStep((s) => (s + 1) as 1 | 2 | 3);
  }

  async function confirmar() {
    if (!user || !veiculo || !quando) return;
    setSalvando(true);
    try {
      logDevError('externo:inicio', `${tipos.length} serviços, veiculo=${veiculo.id}`);

      for (const tipo of tipos) {
        logDevError('externo:gravando', tipo);
        const id = await comTimeout(registrarManutencao(user.id, {
          vehicleId: veiculo.id,
          vin: veiculo.vin,
          inNetwork: false,   // o ponto inteiro desta tela
          type: tipo,
          date: quando,
          km: Number(km),
          dealership: local.trim(),
          notes: 'Serviço declarado pelo cliente, fora da rede oficial',
          pointsEarned: 0,    // fora da rede não pontua
        }), `registrarManutencao(${tipo})`);
        logDevError('externo:gravado', `${tipo} id=${id}`);
        dispatch({
          type: 'ADD_MAINTENANCE',
          payload: {
            id,
            // vehicleId é obrigatório aqui: sem ele o registro fica sem vínculo
            // no estado local e o motor de alertas não o atribui a este veículo.
            vehicleId: veiculo.id,
            vin: veiculo.vin,
            inNetwork: false,
            type: tipo,
            date: quando,
            km: Number(km),
            dealership: local.trim(),
            notes: '',
            pointsEarned: 0,
          },
        });
      }

      // O carro foi atendido — o status dele muda mesmo tendo sido fora da rede.
      // Só avança o marcador se este serviço for mais recente que o último:
      // registrar algo antigo não pode "desatualizar" o veículo.
      const kmServico = Number(km);
      // Mesmo critério do motor de alertas: data mais nova, ou mesma data com
      // KM maior. Sem isso um registro do mesmo dia com KM menor faria o
      // marcador do veículo andar para trás.
      const ultimaData = new Date(veiculo.lastServiceDate).getTime();
      const maisRecente =
        quando.getTime() > ultimaData ||
        (quando.getTime() === ultimaData && kmServico >= veiculo.lastServiceKm);
      if (maisRecente) {
        try {
          await comTimeout(atualizarServico(veiculo.id, kmServico, quando), 'atualizarServico');
        } catch (err) {
          // O serviço já está gravado; o marcador é secundário e não deve
          // derrubar a operação inteira.
          logDevError('atualizarServico (externo)', err);
        }
        dispatch({
          type: 'UPDATE_VEHICLE',
          payload: { ...veiculo, lastServiceKm: kmServico, lastServiceDate: quando },
        });
      }

      logDevError('externo:fim', 'navegando de volta');
      router.back();
    } catch (err) {
      logDevError('registrarServicoExterno', err);
      setErros({
        geral:
          err instanceof Error && err.message.startsWith('TIMEOUT')
            ? `A conexão com o servidor não respondeu (${err.message}). Verifique a internet e tente de novo.`
            : safeErrorMessage(err, 'Não foi possível registrar agora. Tente novamente.'),
      });
    } finally {
      // Faltava: sem isto o botão fica girando para sempre quando algo trava.
      setSalvando(false);
    }
  }

  const titulo =
    step === 1 ? 'Selecione o veículo' : step === 2 ? 'O que foi feito' : 'Revisar registro';

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeHeader} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={voltar} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{titulo}</Text>
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
        {/* ── ETAPA 1: veículo ──────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <Text style={styles.stepSubtitle}>Em qual Ford o serviço foi feito?</Text>

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
                    isSelected={veiculo?.id === v.id}
                    onPress={() => setEscolhido(v)}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* ── ETAPA 2: serviços + onde e quando ─────────────────────────── */}
        {step === 2 && veiculo && (
          <>
            <Text style={styles.stepSubtitle}>
              Registre o que foi feito no Ford {veiculo.model} fora da rede oficial.
            </Text>

            <SectionTitle>Serviços realizados</SectionTitle>
            <View style={styles.tiposLista}>
              {TIPOS_SERVICO.map((t) => {
                const marcado = tipos.includes(t);
                const cat = CATEGORIAS[categoriaDoServico(t)];
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tipoCard, marcado && styles.tipoCardMarcado]}
                    onPress={() => alternarTipo(t)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.tipoIcone, { backgroundColor: `${cat.cor}14` }]}>
                      <Ionicons name={cat.icone} size={19} color={cat.cor} />
                    </View>
                    <View style={styles.tipoInfo}>
                      <Text style={styles.tipoNome}>{t}</Text>
                      <Text style={[styles.tipoCategoria, { color: cat.cor }]}>{cat.label}</Text>
                    </View>
                    <View style={[styles.checkbox, marcado && styles.checkboxMarcado]}>
                      {marcado && <Ionicons name="checkmark" size={13} color={Colors.surface} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {erros.tipos ? <Text style={styles.erro}>{erros.tipos}</Text> : null}

            <SectionTitle>Onde e quando</SectionTitle>
            <Input
              label="Quilometragem do veículo"
              placeholder={String(veiculo.currentKm)}
              value={km}
              onChangeText={(v) => { setKmDigitado(v.replace(/\D/g, '')); setErros((p) => ({ ...p, km: '' })); }}
              error={erros.km}
              keyboardType="number-pad"
            />
            <Text style={styles.dica}>
              Já preenchemos com o KM atual e a data de hoje. Ajuste apenas se o serviço foi feito
              antes — é a partir daí que o próximo vencimento é calculado.
            </Text>
            <Input
              label="Data do serviço"
              placeholder="DD/MM/AAAA"
              value={data}
              onChangeText={formatarData}
              error={erros.data}
              keyboardType="number-pad"
              maxLength={10}
            />
            <Input
              label="Onde foi feito"
              placeholder="Ex: Oficina do Zé"
              value={local}
              onChangeText={(v) => { setLocal(v); setErros((p) => ({ ...p, local: '' })); }}
              error={erros.local}
            />
          </>
        )}

        {/* ── ETAPA 3: revisão ──────────────────────────────────────────── */}
        {step === 3 && veiculo && quando && (
          <>
            <Text style={styles.stepSubtitle}>Confira antes de gravar no histórico do veículo.</Text>

            <SectionTitle>Veículo</SectionTitle>
            <View style={styles.revisaoBloco}>
              <Ionicons name="car-outline" size={19} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.revisaoTitulo}>
                  {veiculo.brand} {veiculo.model} {veiculo.year}
                </Text>
                {veiculo.vin ? <Text style={styles.revisaoSub}>Chassi {veiculo.vin}</Text> : null}
              </View>
            </View>

            <SectionTitle>Serviços</SectionTitle>
            <View style={styles.revisaoBlocoColuna}>
              {tipos.map((t) => {
                const cat = CATEGORIAS[categoriaDoServico(t)];
                return (
                  <View key={t} style={styles.revisaoServico}>
                    <Ionicons name={cat.icone} size={15} color={cat.cor} />
                    <Text style={styles.revisaoServicoNome}>{t}</Text>
                    <Text style={[styles.revisaoServicoCat, { color: cat.cor }]}>{cat.label}</Text>
                  </View>
                );
              })}
            </View>

            <SectionTitle>Onde e quando</SectionTitle>
            <View style={styles.revisaoBloco}>
              <Ionicons name="build-outline" size={19} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.revisaoTitulo}>{local.trim()}</Text>
                <Text style={styles.revisaoSub}>
                  {quando.toLocaleDateString('pt-BR')} · {Number(km).toLocaleString('pt-BR')} km
                </Text>
              </View>
            </View>

            <View style={styles.aviso}>
              <Ionicons name="information-circle-outline" size={18} color={Colors.warningText} />
              <Text style={styles.avisoTexto}>
                Serviço fora da rede oficial não gera pontos e entra no histórico marcado como tal —
                é isso que mantém o passaporte do veículo confiável.
              </Text>
            </View>

            {erros.geral ? <Text style={styles.erro}>{erros.geral}</Text> : null}
          </>
        )}
      </ScrollView>

      {/* ── Rodapé ─────────────────────────────────────────────────────── */}
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        {step === 1 && (
          <TouchableOpacity
            style={[styles.footerBtn, !veiculo && styles.footerBtnDisabled]}
            onPress={avancar}
            disabled={!veiculo}
            activeOpacity={0.85}
          >
            <Text style={styles.footerBtnText}>Próximo</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.surface} />
          </TouchableOpacity>
        )}

        {step === 2 && (
          <TouchableOpacity style={styles.footerBtn} onPress={avancar} activeOpacity={0.85}>
            <Text style={styles.footerBtnText}>Revisar</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.surface} />
          </TouchableOpacity>
        )}

        {step === 3 && (
          <TouchableOpacity
            style={[styles.footerBtn, salvando && styles.footerBtnDisabled]}
            onPress={confirmar}
            disabled={salvando}
            activeOpacity={0.85}
          >
            {salvando ? (
              <ActivityIndicator color={Colors.surface} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color={Colors.surface} />
                <Text style={styles.footerBtnText}>Registrar no histórico</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  safeHeader: { backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  backBtn: { width: 32 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: FontFamily.display, fontSize: 18, color: Colors.primary },

  stepRow: { flexDirection: 'row', gap: 5, marginTop: 6 },
  stepDot: { width: 22, height: 4, borderRadius: 2, backgroundColor: Colors.borderStrong },
  stepDotActive: { backgroundColor: Colors.primary },
  stepDotDone: { backgroundColor: Colors.primaryLight },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },

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
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },

  vehicleList: { gap: Spacing.sm },

  tiposLista: { gap: 8 },
  tipoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tipoCardMarcado: { borderColor: Colors.primary },
  tipoIcone: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipoInfo: { flex: 1 },
  tipoNome: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Colors.textPrimary },
  tipoCategoria: { fontFamily: FontFamily.bodyMedium, fontSize: 11, marginTop: 1 },
  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.inactive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxMarcado: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  revisaoBloco: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
  },
  revisaoBlocoColuna: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 8,
  },
  revisaoTitulo: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Colors.textPrimary },
  revisaoSub: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  revisaoServico: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  revisaoServicoNome: { flex: 1, fontFamily: FontFamily.body, fontSize: 14, color: Colors.textPrimary },
  revisaoServicoCat: { fontFamily: FontFamily.bodySemiBold, fontSize: 11 },

  aviso: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.warningBg,
    borderRadius: 12,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  avisoTexto: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.warningText,
    lineHeight: 18,
  },

  dica: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginTop: -8,
    marginBottom: Spacing.md,
  },
  erro: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.danger,
    marginTop: Spacing.sm,
  },

  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyText: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  emptyAction: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 14,
    color: Colors.primary,
    marginTop: Spacing.sm,
  },

  footer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceNeutral,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 15,
    marginBottom: Spacing.sm,
  },
  footerBtnDisabled: { opacity: 0.45 },
  footerBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Colors.surface },
});
