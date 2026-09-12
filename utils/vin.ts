/**
 * VIN (Vehicle Identification Number) — validação e leitura offline.
 *
 * O VIN é o identificador que sobrevive à troca de dono: é ele que a Ford usa
 * para medir VIN Share, e é nele que o histórico de manutenção do FordCare fica
 * ancorado. Toda a análise aqui é determinística e sem rede.
 *
 * Estrutura (ISO 3779), 17 caracteres:
 *   1–3    WMI  — fabricante e país de origem
 *   4–8    VDS  — características do veículo
 *   9      dígito verificador
 *   10     ano do modelo
 *   11     planta de fabricação
 *   12–17  número de série
 */

/** I, O e Q não existem em VIN — evitam confusão com 1 e 0. */
const LETRAS_PROIBIDAS = /[IOQ]/;
const FORMATO_VIN = /^[A-HJ-NPR-Z0-9]{17}$/;

export type VinInfo = {
  /** VIN normalizado: maiúsculas, sem espaços nem hífens. */
  vin: string;
  /** Formato válido segundo a ISO 3779. */
  valido: boolean;
  /** Motivo do formato inválido, pronto para exibir ao usuário. */
  erro?: string;
  /** Ressalva que não impede o cadastro (ex.: dígito verificador). */
  aviso?: string;
  wmi?: string;
  paisOrigem?: string;
  fabricante?: string;
  anoModelo?: number;
};

// ─── Ano do modelo (posição 10) ──────────────────────────────────────────────
// O código se repete a cada 30 anos; resolvemos a ambiguidade escolhendo o ano
// mais recente que não seja futuro (o ano-modelo pode estar 1 ano à frente).
const CODIGOS_ANO = 'ABCDEFGHJKLMNPRSTVWXY123456789';
const ANO_BASE = 1980;

export function anoDoModelo(codigo: string, hoje = new Date()): number | undefined {
  const i = CODIGOS_ANO.indexOf(codigo.toUpperCase());
  if (i < 0) return undefined;

  const limite = hoje.getFullYear() + 1;
  let ano = ANO_BASE + i;
  while (ano + 30 <= limite) ano += 30;
  return ano;
}

// ─── Origem (primeiro caractere do WMI) ──────────────────────────────────────
function paisPorWmi(wmi: string): string | undefined {
  const c = wmi[0];
  if (c >= '1' && c <= '5') return 'Estados Unidos / Canadá';
  if (c === '8') return 'América do Sul';
  if (c === '9') return 'Brasil';
  if (c >= 'J' && c <= 'R') return 'Ásia';
  if (c >= 'S' && c <= 'Z') return 'Europa';
  if (c >= 'A' && c <= 'H') return 'África';
  if (c === '6' || c === '7') return 'Oceania';
  return undefined;
}

/**
 * WMIs conhecidos da Ford. Lista intencionalmente curta e não exaustiva:
 * um WMI fora dela nunca invalida o VIN, apenas deixa de exibir o fabricante.
 */
const WMI_FORD: Record<string, string> = {
  '9BF': 'Ford Brasil',
  '8AF': 'Ford Argentina',
  '3FA': 'Ford México',
  '1FA': 'Ford EUA',
  '1FM': 'Ford EUA',
  '1FT': 'Ford EUA',
  'WF0': 'Ford Alemanha',
};

// ─── Dígito verificador (posição 9) ──────────────────────────────────────────
// Obrigatório no mercado norte-americano; no Brasil não é exigido, então uma
// divergência vira AVISO e nunca bloqueio.
const VALOR_LETRA: Record<string, number> = {
  A:1, B:2, C:3, D:4, E:5, F:6, G:7, H:8,
  J:1, K:2, L:3, M:4, N:5, P:7, R:9,
  S:2, T:3, U:4, V:5, W:6, X:7, Y:8, Z:9,
};
const PESOS = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];

export function digitoVerificadorConfere(vin: string): boolean {
  let soma = 0;
  for (let i = 0; i < 17; i++) {
    const ch = vin[i];
    const valor = ch >= '0' && ch <= '9' ? Number(ch) : VALOR_LETRA[ch];
    if (valor === undefined) return false;
    soma += valor * PESOS[i];
  }
  const resto = soma % 11;
  const esperado = resto === 10 ? 'X' : String(resto);
  return vin[8] === esperado;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export function normalizarVin(entrada: string): string {
  return entrada.replace(/[\s-]/g, '').toUpperCase();
}

export function analisarVin(entrada: string, hoje = new Date()): VinInfo {
  const vin = normalizarVin(entrada ?? '');

  if (!vin) return { vin, valido: false, erro: 'Informe o chassi do veículo.' };
  if (vin.length !== 17) {
    return {
      vin,
      valido: false,
      erro: `O chassi tem 17 caracteres — você digitou ${vin.length}.`,
    };
  }
  if (LETRAS_PROIBIDAS.test(vin)) {
    return { vin, valido: false, erro: 'O chassi não contém as letras I, O ou Q.' };
  }
  if (!FORMATO_VIN.test(vin)) {
    return { vin, valido: false, erro: 'O chassi aceita apenas letras e números.' };
  }

  const wmi = vin.slice(0, 3);
  const info: VinInfo = {
    vin,
    valido: true,
    wmi,
    paisOrigem: paisPorWmi(wmi),
    fabricante: WMI_FORD[wmi],
    anoModelo: anoDoModelo(vin[9], hoje),
  };

  if (!digitoVerificadorConfere(vin)) {
    info.aviso = 'Dígito verificador não confere — confira se digitou certo.';
  }

  return info;
}

/** Exibição parcial, para telas que não precisam mostrar o chassi inteiro. */
export function mascararVin(vin: string): string {
  const v = normalizarVin(vin);
  if (v.length !== 17) return v;
  return `${v.slice(0, 3)}•••••${v.slice(-6)}`;
}
