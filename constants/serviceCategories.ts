/**
 * Categorias de serviço.
 *
 * Agrupam os tipos de manutenção em famílias que fazem sentido para quem é dono
 * do carro — não para quem é mecânico. Servem para filtrar o histórico e para
 * dar leitura rápida do que o veículo já consumiu.
 *
 * Para adicionar uma categoria, basta editar este arquivo: o mapeamento por
 * tipo e as palavras-chave são a única fonte de verdade.
 */

import { Ionicons } from '@expo/vector-icons';

export type CategoriaServico = 'motor' | 'pneus' | 'freios' | 'revisao' | 'outros';

type Definicao = {
  label: string;
  icone: React.ComponentProps<typeof Ionicons>['name'];
  cor: string;
};

export const CATEGORIAS: Record<CategoriaServico, Definicao> = {
  motor:   { label: 'Motor',   icone: 'water-outline',       cor: '#1D4E89' },
  pneus:   { label: 'Pneus',   icone: 'disc-outline',        cor: '#0E7C66' },
  freios:  { label: 'Freios',  icone: 'stop-circle-outline', cor: '#B3261E' },
  revisao: { label: 'Revisão', icone: 'construct-outline',   cor: '#7A4E00' },
  outros:  { label: 'Outros',  icone: 'build-outline',       cor: '#5B6478' },
};

/** Ordem de exibição dos filtros. */
export const ORDEM_CATEGORIAS: CategoriaServico[] = ['motor', 'pneus', 'freios', 'revisao', 'outros'];

/** Tipos já conhecidos do app (constants/maintenanceRules.ts). */
const POR_TIPO: Record<string, CategoriaServico> = {
  'Troca de Óleo':    'motor',
  'Filtro de Ar':     'motor',
  'Rodízio de Pneus': 'pneus',
  'Revisão Geral':    'revisao',
};

/**
 * Palavras-chave para serviços digitados livremente (o tipo "Outro", e qualquer
 * tipo novo que venha a existir sem passar por aqui). Evita que tudo caia em
 * "Outros" só porque a tabela acima não foi atualizada.
 */
const POR_PALAVRA: Array<{ termos: RegExp; categoria: CategoriaServico }> = [
  { termos: /óleo|oleo|filtro|vela|correia|arrefec|radiador|bateria/i, categoria: 'motor' },
  { termos: /pneu|roda|alinha|balancea|calibra/i,                      categoria: 'pneus' },
  { termos: /freio|pastilha|disco|suspens|amortec/i,                   categoria: 'freios' },
  { termos: /revis|inspe/i,                                            categoria: 'revisao' },
];

export function categoriaDoServico(tipo: string): CategoriaServico {
  const direto = POR_TIPO[tipo];
  if (direto) return direto;

  for (const { termos, categoria } of POR_PALAVRA) {
    if (termos.test(tipo)) return categoria;
  }
  return 'outros';
}
