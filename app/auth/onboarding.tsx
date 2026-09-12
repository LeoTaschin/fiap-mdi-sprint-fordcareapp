import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

export const ONBOARDING_KEY = '@fordcare/onboarding_visto_v1';

/**
 * Onboarding — a ideia do app antes do login.
 *
 * Responde ao feedback da Ford de "contar melhor a ideia": se a proposta só
 * existe no README, ela não existe no produto. Aqui o usuário entende o
 * problema de negócio em três telas, antes de criar conta.
 */
const SLIDES = [
  {
    icone: 'warning-outline' as const,
    titulo: 'A oficina barata sai cara',
    texto:
      'Fora da rede oficial você abre mão de peça original, de garantia — e do histórico do seu carro, que simplesmente deixa de existir.',
  },
  {
    icone: 'shield-checkmark-outline' as const,
    titulo: 'O histórico é do carro,\nnão da sua conta',
    texto:
      'Cada revisão fica registrada no chassi. Se você vender o veículo, o histórico vai junto — e é isso que faz um seminovo valer mais.',
  },
  {
    icone: 'sparkles-outline' as const,
    titulo: 'Um copiloto que avisa antes',
    texto:
      'O FordCare acompanha o seu ritmo de uso, calcula quando cada serviço vence e avisa na hora certa. Cada revisão na rede oficial vale pontos.',
  },
];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [indice, setIndice] = useState(0);

  const ultimo = indice === SLIDES.length - 1;

  async function concluir() {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1').catch(() => {});
    router.replace('/auth/WelcomeScreen');
  }

  function avancar() {
    if (ultimo) return concluir();
    const proximo = indice + 1;
    scrollRef.current?.scrollTo({ x: proximo * width, animated: true });
    setIndice(proximo);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topo}>
        <Text style={styles.marca}>FordCare</Text>
        <TouchableOpacity onPress={concluir} hitSlop={12}>
          <Text style={styles.pular}>Pular</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setIndice(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        style={styles.pager}
      >
        {SLIDES.map((slide) => (
          <View key={slide.titulo} style={[styles.slide, { width }]}>
            <View style={styles.iconeWrap}>
              <Ionicons name={slide.icone} size={44} color={Colors.primary} />
            </View>
            <Text style={styles.titulo}>{slide.titulo}</Text>
            <Text style={styles.texto}>{slide.texto}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.rodape}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.titulo} style={[styles.dot, i === indice && styles.dotAtivo]} />
          ))}
        </View>

        <TouchableOpacity style={styles.botao} onPress={avancar} activeOpacity={0.85}>
          <Text style={styles.botaoTexto}>{ultimo ? 'Começar' : 'Continuar'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },

  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  marca: { fontFamily: FontFamily.display, fontSize: 20, color: Colors.primary },
  pular: { fontFamily: FontFamily.bodyMedium, fontSize: 14, color: Colors.textSecondary },

  pager: { flex: 1 },
  slide: {
    // Sem a altura explícita o filho de um ScrollView horizontal não estica,
    // e o conteúdo fica ancorado no topo em vez de centralizado.
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconeWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  titulo: {
    fontFamily: FontFamily.display,
    fontSize: 30,
    lineHeight: 34,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  texto: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 23,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  rodape: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Spacing.lg,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.inactive },
  dotAtivo: { width: 20, backgroundColor: Colors.primary },

  botao: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  botaoTexto: { fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: Colors.surface },
});
