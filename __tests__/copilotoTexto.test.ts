/**
 * Camada 3 do Copiloto — o que garante que a IA não estrague o card.
 *
 * O requisito de aceite da tarefa 2.5 é que o app caia no texto determinístico
 * sempre que a resposta não for exatamente o contrato. Como a validação é pura,
 * dá para provar isso sem subir a Edge Function e sem rede.
 */

import {
  validarTexto,
  numerosConferem,
  montarEntrada,
  chaveDeCache,
  lerCache,
  CACHE_VALIDADE_MS,
  MAX_CARACTERES,
  TIMEOUT_MS,
  type EntradaCopilotoTexto,
} from '@/utils/copilotoTexto';
import type { Vehicle } from '@/contexts/UserContext';
import type { Alert } from '@/utils/alerts';
import type { Recomendacao } from '@/utils/copiloto';

const entrada: EntradaCopilotoTexto = {
  modelo: 'Ford Ranger',
  ano: 2021,
  kmAtual: 41200,
  kmPorMes: 850,
  alerta: { tipo: 'Revisão Geral', diasVencido: 35, kmVencido: 1200 },
  pendentes: 2,
  pontos: 200,
};

describe('validarTexto — aceita só o contrato', () => {
  it('aceita um parágrafo limpo', () => {
    expect(validarTexto({ texto: 'Sua revisão está vencida. Agende na rede oficial.' }))
      .toBe('Sua revisão está vencida. Agende na rede oficial.');
  });

  it('colapsa quebras de linha — o card é de uma coluna só', () => {
    expect(validarTexto({ texto: 'Primeira linha.\n\n  Segunda linha.' }))
      .toBe('Primeira linha. Segunda linha.');
  });

  it.each([
    ['resposta nula', null],
    ['resposta sem objeto', 'texto solto'],
    ['objeto sem o campo', { outro: 'x' }],
    ['campo com tipo errado', { texto: 42 }],
    ['texto vazio', { texto: '   ' }],
  ])('reprova %s', (_rotulo, resposta) => {
    expect(validarTexto(resposta)).toBeNull();
  });

  it('reprova texto acima do limite de caracteres', () => {
    expect(validarTexto({ texto: 'a'.repeat(MAX_CARACTERES + 1) })).toBeNull();
  });

  it('aceita exatamente no limite', () => {
    expect(validarTexto({ texto: 'a'.repeat(MAX_CARACTERES) })).toHaveLength(MAX_CARACTERES);
  });

  it.each([
    ['markdown', { texto: 'Sua **revisão** está vencida.' }],
    ['título', { texto: '# Revisão vencida' }],
    ['JSON aninhado', { texto: '{"texto": "Revisão vencida"}' }],
  ])('reprova %s — o modelo às vezes devolve isso', (_rotulo, resposta) => {
    expect(validarTexto(resposta)).toBeNull();
  });
});

describe('numerosConferem — a IA não pode inventar número', () => {
  it('aceita o texto que só cita números calculados', () => {
    const t = 'Sua Revisão Geral está vencida há 35 dias e 1.200 km. Você roda cerca de 850 km por mês e ganha 200 pts na rede oficial.';
    expect(numerosConferem(t, entrada)).toBe(true);
  });

  it('reprova arredondamento — 41.200 km virando 40.000 seria um número que o app nunca calculou', () => {
    expect(numerosConferem('Seu Ranger está com 40.000 km rodados.', entrada)).toBe(false);
  });

  it('reprova valor inventado', () => {
    expect(numerosConferem('A revisão custa cerca de 890 reais.', entrada)).toBe(false);
  });

  it('ignora números pequenos, que aparecem em construção normal de frase', () => {
    expect(numerosConferem('Resolva os 2 itens na mesma visita.', entrada)).toBe(true);
  });

  it('aceita texto sem número nenhum', () => {
    expect(numerosConferem('Sua revisão está vencida. Agende na rede oficial.', entrada)).toBe(true);
  });
});

describe('montarEntrada — payload sem dado pessoal', () => {
  const veiculo = {
    id: 'v1', brand: 'Ford', model: 'Ranger', color: 'blue', year: 2021,
    vin: '9BFZH54P8M8123456', currentKm: 41200,
    lastServiceKm: 30000, lastServiceDate: new Date(),
  } as Vehicle;
  const alerta: Alert = {
    type: 'Revisão Geral', status: 'urgente',
    kmRemaining: -1200, daysRemaining: -35, points: 200,
  };
  const rec = { alertType: 'Revisão Geral' } as Recomendacao;

  it('converte vencimento negativo em número positivo', () => {
    const e = montarEntrada(veiculo, alerta, rec, 850, 2);
    expect(e.alerta.diasVencido).toBe(35);
    expect(e.alerta.kmVencido).toBe(1200);
  });

  it('zera o vencimento quando o serviço ainda não venceu', () => {
    const futuro: Alert = { ...alerta, kmRemaining: 900, daysRemaining: 20, status: 'atencao' };
    const e = montarEntrada(veiculo, futuro, rec, 850, 1);
    expect(e.alerta.diasVencido).toBe(0);
    expect(e.alerta.kmVencido).toBe(0);
  });

  it('não envia chassi, nome nem e-mail — requisito de Cybersecurity', () => {
    const e = montarEntrada(veiculo, alerta, rec, 850, 2);
    const serializado = JSON.stringify(e);
    expect(serializado).not.toContain(veiculo.vin);
    expect(Object.keys(e).sort()).toEqual(
      ['alerta', 'ano', 'kmAtual', 'kmPorMes', 'modelo', 'pendentes', 'pontos'],
    );
  });

  it('aceita ritmo de uso desconhecido', () => {
    expect(montarEntrada(veiculo, alerta, rec, null, 2).kmPorMes).toBeNull();
  });
});

describe('parâmetros do fallback', () => {
  it('o timeout é curto o bastante para não travar a Home', () => {
    expect(TIMEOUT_MS).toBeLessThanOrEqual(3000);
  });
});

describe('cache — o que impede a troca visível a cada abertura', () => {
  it('a chave muda quando o estado do veículo muda', () => {
    const outro = { ...entrada, kmAtual: 41500 };
    expect(chaveDeCache(entrada)).not.toBe(chaveDeCache(outro));
  });

  it('a chave é estável para o mesmo estado', () => {
    expect(chaveDeCache(entrada)).toBe(chaveDeCache({ ...entrada }));
  });

  it('a chave distingue alertas diferentes do mesmo veículo', () => {
    const pneus = { ...entrada, alerta: { ...entrada.alerta, tipo: 'Rodízio de Pneus' } };
    expect(chaveDeCache(entrada)).not.toBe(chaveDeCache(pneus));
  });

  it('lê um texto salvo dentro da validade', () => {
    const bruto = JSON.stringify({ texto: 'Revisão vencida. Agende na rede oficial.', salvoEm: Date.now() });
    expect(lerCache(bruto)).toBe('Revisão vencida. Agende na rede oficial.');
  });

  it('descarta o que passou da validade', () => {
    const velho = JSON.stringify({ texto: 'Texto antigo.', salvoEm: Date.now() - CACHE_VALIDADE_MS - 1 });
    expect(lerCache(velho)).toBeNull();
  });

  it.each([
    ['cache vazio', null],
    ['JSON inválido', '{quebrado'],
    ['sem o campo texto', JSON.stringify({ salvoEm: Date.now() })],
    ['sem o carimbo de tempo', JSON.stringify({ texto: 'Oi.' })],
  ])('devolve null para %s', (_rotulo, bruto) => {
    expect(lerCache(bruto as string | null)).toBeNull();
  });

  it('aplica as mesmas regras de validação ao que veio do disco', () => {
    const comMarkdown = JSON.stringify({ texto: 'Revisão **vencida**.', salvoEm: Date.now() });
    expect(lerCache(comMarkdown)).toBeNull();
  });
});
