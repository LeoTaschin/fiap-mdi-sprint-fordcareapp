/**
 * Design tokens do FordCare.
 *
 * Toda cor, espaçamento e fonte usados nas telas saem daqui. Antes desta
 * consolidação havia dez cinzas de fundo e quatro de borda quase idênticos
 * espalhados pelos arquivos — a mesma superfície mudava de tom de tela para
 * tela. Se precisar de um valor novo, adicione um token; não escreva o hex
 * direto no componente.
 */

export const Colors = {
  // ── Marca ────────────────────────────────────────────────────────────────
  primary: '#133A7C',
  primaryLight: '#2A6BAC',
  accent: '#2A6BAC',

  // ── Estados ──────────────────────────────────────────────────────────────
  success: '#1E8A44',
  danger: '#D62B2B',
  warning: '#F5A623',
  /** Texto sobre fundo de aviso (contraste suficiente sobre warningBg). */
  warningText: '#7A4E00',

  // ── Superfícies ──────────────────────────────────────────────────────────
  /** Fundo das telas. */
  background: '#F4F6FA',
  /** Cards e campos sobre o fundo. */
  surface: '#FFFFFF',
  /** Superfície sutil: ícones em caixa, chips inativos, trilhos. */
  surfaceMuted: '#EEF2FA',
  /** Fundo de faixa neutra (etiquetas, segmentos). */
  surfaceNeutral: '#EEF0F5',
  /** Fundos de estado. */
  successBg: '#E8F5EC',
  warningBg: '#FFF6E5',

  // ── Bordas e divisores ───────────────────────────────────────────────────
  border: '#E6EAF2',
  borderStrong: '#D9E1EF',

  // ── Texto ────────────────────────────────────────────────────────────────
  textPrimary: '#111111',
  textSecondary: '#666680',
  /** Texto e ícones desabilitados, placeholders. */
  textMuted: '#9AA3B2',
  /** Elementos inertes: pontos inativos, ícones de estado vazio. */
  inactive: '#C8CEDB',
  /** Texto sobre superfície escura (card do passaporte). */
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#AFC4E4',
} as const;

/**
 * Cores dos níveis do programa de pontos.
 * Estavam duplicadas em `perfil.tsx` e `PointsBadge.tsx` com valores
 * DIFERENTES para prata e ouro — o mesmo nível mudava de cor entre as telas.
 */
export const LevelColors = {
  bronze: '#CD7F32',
  prata: '#A8A9AD',
  ouro: '#D4A017',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/**
 * Folga inferior das telas com TabBar flutuante.
 * Sem ela o último card fica encoberto — já aconteceu em três telas.
 */
export const TAB_BAR_SPACE = 120;

export const FontFamily = {
  display: 'BarlowCondensed_700Bold',
  displayMedium: 'BarlowCondensed_500Medium',
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodySemiBold: 'Barlow_600SemiBold',
} as const;
