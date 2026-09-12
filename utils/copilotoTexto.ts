/**
 * Camada 3 do Copiloto — validação da resposta redigida.
 *
 * A camada 1 (`utils/copiloto.ts`) calcula os números; a camada 3 só os
 * REESCREVE em linguagem natural. A IA não decide nada: não escolhe o serviço,
 * não estima custo, não inventa quilometragem.
 *
 * Tudo aqui é função pura, de propósito. O fallback é a parte que precisa
 * funcionar quando a rede não funciona, então ele é testado sem rede.
 */

import type { Vehicle } from '@/contexts/UserContext';
import type { Alert } from '@/utils/alerts';
import type { Recomendacao } from '@/utils/copiloto';

/** Limite de caracteres do parágrafo redigido — um card, não um texto corrido. */
export const MAX_CARACTERES = 240;

/** Tempo máximo de espera. Passou disso, o texto determinístico fica. */
export const TIMEOUT_MS = 2500;

/** Payload enviado à Edge Function. Sem nome, sem e-mail, sem chassi. */
export type EntradaCopilotoTexto = {
  modelo: string;
  ano: number;
  kmAtual: number;
  kmPorMes: number | null;
  alerta: { tipo: string; diasVencido: number; kmVencido: number };
  pendentes: number;
  pontos: number;
};

/**
 * Monta o payload a partir do que já foi calculado localmente.
 *
 * `diasVencido` e `kmVencido` são positivos quando o serviço já venceu, para o
 * texto não precisar interpretar sinal negativo.
 */
export function montarEntrada(
  vehicle: Vehicle,
  alerta: Alert,
  rec: Recomendacao,
  kmPorMes: number | null,
  pendentes: number,
): EntradaCopilotoTexto {
  return {
    modelo: `${vehicle.brand} ${vehicle.model}`,
    ano: vehicle.year,
    kmAtual: vehicle.currentKm,
    kmPorMes,
    alerta: {
      tipo: alerta.type,
      diasVencido: Math.max(0, -alerta.daysRemaining),
      kmVencido: Math.max(0, -alerta.kmRemaining),
    },
    pendentes,
    pontos: alerta.points,
  };
}

/**
 * Aceita a resposta da função só se ela for exatamente o contrato combinado.
 *
 * Qualquer desvio — corpo que não é objeto, `texto` ausente, vazio, longo
 * demais, ou com marcação — devolve `null`, e quem chamou mantém o texto
 * determinístico. Silenciosamente: a tela nunca mostra erro por causa disso.
 */
export function validarTexto(resposta: unknown): string | null {
  if (typeof resposta !== 'object' || resposta === null) return null;

  const bruto = (resposta as { texto?: unknown }).texto;
  if (typeof bruto !== 'string') return null;

  // Colapsa espaços e quebras: o card é de uma coluna só.
  const texto = bruto.replace(/\s+/g, ' ').trim();

  if (texto.length === 0) return null;
  if (texto.length > MAX_CARACTERES) return null;

  // Um modelo às vezes devolve markdown ou um JSON dentro do campo.
  if (/[*_#`]|^\s*[[{]/.test(texto)) return null;

  return texto;
}

/**
 * Guarda de coerência: o texto redigido não pode citar número que a camada 1
 * não calculou. Compara os inteiros presentes no texto com os números que foram
 * enviados; qualquer valor estranho reprova a resposta.
 *
 * Serve contra o caso em que o modelo "arredonda" 41.200 km para 40.000 — o
 * usuário veria um número que o app nunca calculou.
 */
export function numerosConferem(texto: string, entrada: EntradaCopilotoTexto): boolean {
  const permitidos = new Set<number>([
    entrada.ano,
    entrada.kmAtual,
    entrada.alerta.diasVencido,
    entrada.alerta.kmVencido,
    entrada.pendentes,
    entrada.pontos,
  ]);
  if (entrada.kmPorMes != null) permitidos.add(entrada.kmPorMes);

  // Números pequenos aparecem em construções normais ("um", "2 itens") e em
  // meses; abaixo de 10 não vale a pena reprovar.
  const citados = (texto.match(/\d[\d.,]*/g) ?? [])
    .map((n) => Number(n.replace(/[.,]/g, '')))
    .filter((n) => Number.isFinite(n) && n >= 10);

  return citados.every((n) => permitidos.has(n));
}

/**
 * Chave de cache do texto redigido.
 *
 * Deriva do payload inteiro: se a quilometragem, o alerta ou o número de
 * pendências mudarem, a chave muda e o texto é buscado de novo. Enquanto o
 * estado do veículo for o mesmo, o texto vem do disco e a tela não pisca.
 */
export function chaveDeCache(entrada: EntradaCopilotoTexto): string {
  const partes = [
    entrada.modelo, entrada.ano, entrada.kmAtual, entrada.kmPorMes ?? 'x',
    entrada.alerta.tipo, entrada.alerta.diasVencido, entrada.alerta.kmVencido,
    entrada.pendentes, entrada.pontos,
  ];
  return `copiloto:v1:${partes.join('|')}`;
}

/** Quanto tempo um texto em cache continua valendo. */
export const CACHE_VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

export type TextoEmCache = { texto: string; salvoEm: number };

/** Lê o cache, descartando o que expirou ou está corrompido. */
export function lerCache(bruto: string | null, agora = Date.now()): string | null {
  if (!bruto) return null;
  try {
    const dados = JSON.parse(bruto) as TextoEmCache;
    if (typeof dados?.texto !== 'string' || typeof dados?.salvoEm !== 'number') return null;
    if (agora - dados.salvoEm > CACHE_VALIDADE_MS) return null;
    return validarTexto({ texto: dados.texto });
  } catch {
    return null;
  }
}
