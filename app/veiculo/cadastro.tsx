import { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { FORD_MODELS, COLOR_HEX, COLOR_LABELS, getCarImage, CarColor } from '@/constants/fordModels';
import { salvarVeiculo } from '@/services/vehicle';
import { logDevError, safeErrorMessage } from '@/utils/safeError';
import { analisarVin, normalizarVin } from '@/utils/vin';
import { supabase } from '@/services/supabase';
import { useUser } from '@/contexts/UserContext';

export default function VeiculoCadastroScreen() {
  const { back } = useLocalSearchParams<{ back?: string }>();
  const isAddFlow = back === 'true';
  const { user, dispatch } = useUser();
  const [model, setModel] = useState('');
  const [vin, setVin] = useState('');
  const [color, setColor] = useState<CarColor>('black');
  const [year, setYear] = useState('');
  const [currentKm, setCurrentKm] = useState('');
  const [lastServiceKm, setLastServiceKm] = useState('');
  const [lastServiceDate, setLastServiceDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const vinRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const kmRef = useRef<TextInput>(null);
  const lastKmRef = useRef<TextInput>(null);
  const dateRef = useRef<TextInput>(null);

  const selectedModelConfig = FORD_MODELS.find((m) => m.name === model);
  const previewImage = model ? getCarImage(model, color) : null;

  function handleSelectModel(name: string) {
    setModel(name);
    const config = FORD_MODELS.find((m) => m.name === name);
    if (config && !config.colors.includes(color)) {
      setColor(config.colors[0]);
    }
    setErrors((p) => ({ ...p, model: '' }));
  }

  // Análise do chassi em tempo real: é offline e determinística.
  const vinInfo = useMemo(() => (vin.length === 17 ? analisarVin(vin) : null), [vin]);

  // Ano-modelo do chassi versus ano digitado: divergência acima de 1 ano é suspeita.
  const anoDivergente = useMemo(() => {
    if (!vinInfo?.valido || !vinInfo.anoModelo || !year.trim()) return false;
    return Math.abs(vinInfo.anoModelo - Number(year)) > 1;
  }, [vinInfo, year]);

  function handleVinChange(texto: string) {
    const limpo = normalizarVin(texto).slice(0, 17);
    setVin(limpo);
    setErrors((p) => ({ ...p, vin: '' }));

    // Se o chassi revela o ano-modelo e o campo ainda está vazio, preenche.
    if (limpo.length === 17) {
      const info = analisarVin(limpo);
      if (info.valido && info.anoModelo && !year.trim()) setYear(String(info.anoModelo));
    }
  }

  function formatDateInput(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
    if (digits.length > 4) formatted = formatted.slice(0, 5) + '/' + digits.slice(4);
    setLastServiceDate(formatted);
  }

  function parseDate(str: string): Date | null {
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    const [day, month, yearStr] = parts;
    const d = new Date(`${yearStr}-${month}-${day}`);
    return isNaN(d.getTime()) ? null : d;
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!model) e.model = 'Selecione o modelo';
    const vinCheck = analisarVin(vin);
    if (!vinCheck.valido) e.vin = vinCheck.erro ?? 'Chassi inválido';
    if (!year.trim() || isNaN(Number(year))) e.year = 'Ano inválido';
    if (!currentKm.trim() || isNaN(Number(currentKm))) e.currentKm = 'KM inválido';
    if (!lastServiceKm.trim() || isNaN(Number(lastServiceKm))) e.lastServiceKm = 'KM inválido';
    if (!lastServiceDate.trim() || !parseDate(lastServiceDate)) e.lastServiceDate = 'Data inválida (DD/MM/AAAA)';
    return e;
  }

  async function handleSalvar() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    let userId = user?.id;
    if (!userId) {
      const { data } = await supabase.auth.getSession();
      userId = data.session?.user?.id;
    }
    if (!userId) return;

    setLoading(true);
    try {
      const vehicleId = await salvarVeiculo(userId, {
        brand: 'Ford',
        vin: normalizarVin(vin),
        model,
        color,
        year: parseInt(year),
        currentKm: parseInt(currentKm),
        lastServiceKm: parseInt(lastServiceKm),
        lastServiceDate: parseDate(lastServiceDate)!,
      });
      dispatch({
        type: 'ADD_VEHICLE',
        payload: {
          id: vehicleId,
          brand: 'Ford',
          vin: normalizarVin(vin),
          model,
          color,
          year: parseInt(year),
          currentKm: parseInt(currentKm),
          lastServiceKm: parseInt(lastServiceKm),
          lastServiceDate: parseDate(lastServiceDate)!,
        },
      });
      if (isAddFlow) {
        router.back();
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (err) {
      logDevError('salvarVeiculo', err);
      setErrors({ general: safeErrorMessage(err, 'Erro ao salvar. Tente novamente.') });
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isAddFlow && (
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color={Colors.primary} />
              <Text style={styles.backText}>Voltar</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.title}>Qual é o seu Ford?</Text>
          <Text style={styles.subtitle}>
            Essas informações nos ajudam a calcular quando seu veículo precisa de atenção.
          </Text>

          {/* Preview do carro */}
          <View style={styles.previewCard}>
            {previewImage ? (
              <Image source={previewImage} style={styles.carImage} resizeMode="contain" />
            ) : (
              <Text style={styles.previewPlaceholder}>Selecione um modelo abaixo</Text>
            )}
          </View>

          {/* Seleção de modelo */}
          <Text style={styles.sectionLabel}>Modelo</Text>
          {errors.model ? <Text style={styles.fieldError}>{errors.model}</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {FORD_MODELS.map((m) => (
              <TouchableOpacity
                key={m.name}
                style={[styles.chip, model === m.name && styles.chipActive]}
                onPress={() => handleSelectModel(m.name)}
              >
                <Text style={[styles.chipText, model === m.name && styles.chipTextActive]}>
                  {m.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Seleção de cor */}
          {selectedModelConfig && (
            <>
              <Text style={styles.sectionLabel}>Cor</Text>
              <View style={styles.colorRow}>
                {selectedModelConfig.colors.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={styles.colorOption}
                    onPress={() => setColor(c)}
                  >
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: COLOR_HEX[c] },
                        color === c && styles.colorDotActive,
                      ]}
                    />
                    <Text style={[styles.colorLabel, color === c && styles.colorLabelActive]}>
                      {COLOR_LABELS[c]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Campos numéricos */}
          <View style={styles.form}>
            <Input
              ref={vinRef}
              label="Chassi (VIN)"
              placeholder="17 caracteres — ex: 9BFZH54P8M8123456"
              value={vin}
              onChangeText={handleVinChange}
              error={errors.vin}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={17}
              returnKeyType="next"
              onSubmitEditing={() => yearRef.current?.focus()}
            />
            {vinInfo?.valido ? (
              <>
                <Text style={styles.vinHint}>
                  {[vinInfo.fabricante, vinInfo.paisOrigem, vinInfo.anoModelo && `ano-modelo ${vinInfo.anoModelo}`]
                    .filter(Boolean)
                    .join(' · ')}
                  {vinInfo.aviso ? ` — ${vinInfo.aviso}` : ''}
                </Text>
                {anoDivergente && (
                  <Text style={styles.vinAviso}>
                    O chassi indica {vinInfo.anoModelo}, mas você informou {year}. Confira — pode ser
                    um dígito trocado.
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.vinHelp}>
                Está no documento do veículo (CRLV) e no vidro dianteiro. É ele que mantém o
                histórico do carro mesmo se você vendê-lo.
              </Text>
            )}

            <Input
              ref={yearRef}
              label="Ano do veículo"
              placeholder="Ex: 2022"
              value={year}
              onChangeText={(v) => { setYear(v.replace(/\D/g, '')); setErrors((p) => ({ ...p, year: '' })); }}
              error={errors.year}
              keyboardType="number-pad"
              maxLength={4}
              returnKeyType="next"
              onSubmitEditing={() => kmRef.current?.focus()}
            />
            <Input
              ref={kmRef}
              label="KM atual"
              placeholder="Ex: 38000"
              value={currentKm}
              onChangeText={(v) => { setCurrentKm(v.replace(/\D/g, '')); setErrors((p) => ({ ...p, currentKm: '' })); }}
              error={errors.currentKm}
              keyboardType="number-pad"
              maxLength={7}
              returnKeyType="next"
              onSubmitEditing={() => lastKmRef.current?.focus()}
            />
            <Input
              ref={lastKmRef}
              label="KM da última revisão"
              placeholder="Ex: 30000"
              value={lastServiceKm}
              onChangeText={(v) => { setLastServiceKm(v.replace(/\D/g, '')); setErrors((p) => ({ ...p, lastServiceKm: '' })); }}
              error={errors.lastServiceKm}
              keyboardType="number-pad"
              maxLength={7}
              returnKeyType="next"
              onSubmitEditing={() => dateRef.current?.focus()}
            />
            <Input
              ref={dateRef}
              label="Data da última revisão"
              placeholder="DD/MM/AAAA"
              value={lastServiceDate}
              onChangeText={(v) => { formatDateInput(v); setErrors((p) => ({ ...p, lastServiceDate: '' })); }}
              error={errors.lastServiceDate}
              keyboardType="number-pad"
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={handleSalvar}
            />

            {errors.general ? <Text style={styles.fieldError}>{errors.general}</Text> : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Salvar e acessar o app" onPress={handleSalvar} loading={loading} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  vinHint: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.primary,
    marginTop: -8,
    marginBottom: 12,
  },
  vinAviso: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.warningText,
    marginTop: -6,
    marginBottom: 12,
    lineHeight: 17,
  },
  vinHelp: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: -8,
    marginBottom: 12,
    lineHeight: 17,
  },
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 28,
    color: Colors.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  previewCard: {
    height: 180,
    backgroundColor: Colors.background,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  carImage: {
    width: '90%',
    height: 160,
  },
  previewPlaceholder: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  sectionLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  chipScroll: { marginBottom: Spacing.lg },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    marginRight: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  chipText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.surface,
  },
  colorRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  colorOption: {
    alignItems: 'center',
    gap: 6,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: {
    borderColor: Colors.primary,
    transform: [{ scale: 1.15 }],
  },
  colorLabel: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  colorLabelActive: {
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.primary,
  },
  form: { gap: Spacing.xs },
  fieldError: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.danger,
    marginBottom: Spacing.xs,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  skipLink: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    marginBottom: Spacing.sm,
  },
  backText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    color: Colors.primary,
  },
});
