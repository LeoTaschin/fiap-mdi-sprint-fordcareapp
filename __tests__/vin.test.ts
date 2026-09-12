/**
 * `utils/vin.ts` — validação e leitura do chassi.
 *
 * O VIN é a âncora do histórico no FordCare: se a validação estiver errada, o
 * Passaporte do Veículo perde a confiabilidade. Tudo aqui é função pura, então
 * os testes rodam sem mock, sem rede e sem renderizar componente.
 */

import {
  analisarVin,
  digitoVerificadorConfere,
  anoDoModelo,
  normalizarVin,
  mascararVin,
} from '@/utils/vin';

/** Data fixa: o código de ano depende do ano corrente e não pode ser flaky. */
const HOJE = new Date('2026-09-08');

/** VIN de referência público, com dígito verificador "X" documentado. */
const REF = '1M8GDM9AXKP042788';

describe('digitoVerificadorConfere', () => {
  it('valida o VIN de referência', () => {
    expect(digitoVerificadorConfere(REF)).toBe(true);
  });

  it('reprova quando um caractere é trocado', () => {
    const alterado = REF.slice(0, 8) + '1' + REF.slice(9);
    expect(digitoVerificadorConfere(alterado)).toBe(false);
  });
});

describe('anoDoModelo', () => {
  // O código da posição 10 se repete a cada 30 anos. A regra é escolher o ano
  // mais recente que não passe do ano seguinte ao corrente.
  it.each([
    ['K', 2019],
    ['M', 2021],
    ['S', 2025],
    ['T', 2026],
    ['V', 2027], // ano-modelo pode estar um ano à frente
    ['W', 1998], // 2028 passaria do limite
  ])('resolve o código %s para %i', (codigo, esperado) => {
    expect(anoDoModelo(codigo as string, HOJE)).toBe(esperado);
  });

  it('não resolve letras que não existem em VIN', () => {
    expect(anoDoModelo('I', HOJE)).toBeUndefined();
    expect(anoDoModelo('O', HOJE)).toBeUndefined();
    expect(anoDoModelo('Q', HOJE)).toBeUndefined();
  });
});

describe('normalizarVin', () => {
  it('remove espaços e hífens e sobe para maiúsculas', () => {
    expect(normalizarVin(' 9bf-abc 12345678901 ')).toBe('9BFABC12345678901');
  });
});

describe('analisarVin — formato', () => {
  it('aceita um VIN bem formado', () => {
    expect(analisarVin(REF, HOJE).valido).toBe(true);
  });

  it('reprova com menos de 17 caracteres e explica o motivo', () => {
    const r = analisarVin('1M8GDM9AXKP04278', HOJE);
    expect(r.valido).toBe(false);
    expect(r.erro).toContain('17 caracteres');
  });

  it('reprova as letras I, O e Q', () => {
    const r = analisarVin('1M8GDM9AXKPO42788', HOJE);
    expect(r.valido).toBe(false);
    expect(r.erro).toContain('I, O ou Q');
  });

  it('reprova entrada vazia', () => {
    expect(analisarVin('', HOJE).valido).toBe(false);
  });
});

describe('analisarVin — dígito verificador é aviso, não bloqueio', () => {
  // Regra de negócio: o dígito é obrigatório no mercado norte-americano, mas
  // não no Brasil. Reprovar por ele rejeitaria chassis brasileiros legítimos.
  const divergente = REF.slice(0, 8) + '1' + REF.slice(9);

  it('mantém o VIN válido', () => {
    expect(analisarVin(divergente, HOJE).valido).toBe(true);
  });

  it('devolve um aviso', () => {
    expect(analisarVin(divergente, HOJE).aviso).toEqual(expect.any(String));
  });

  it('não gera aviso quando o dígito confere', () => {
    expect(analisarVin(REF, HOJE).aviso).toBeUndefined();
  });
});

describe('analisarVin — WMI', () => {
  const brasileiro = '9BF' + REF.slice(3);

  it('identifica país e fabricante conhecidos', () => {
    const r = analisarVin(brasileiro, HOJE);
    expect(r.paisOrigem).toBe('Brasil');
    expect(r.fabricante).toBe('Ford Brasil');
  });

  it('não invalida WMI desconhecido — a tabela é intencionalmente curta', () => {
    const r = analisarVin('ZZZ' + REF.slice(3), HOJE);
    expect(r.valido).toBe(true);
  });

  it('não inventa fabricante para WMI desconhecido', () => {
    expect(analisarVin('ZZZ' + REF.slice(3), HOJE).fabricante).toBeUndefined();
  });
});

describe('mascararVin', () => {
  it('preserva início e fim', () => {
    expect(mascararVin(REF)).toBe('1M8•••••042788');
  });

  it('devolve a entrada quando não tem 17 caracteres', () => {
    expect(mascararVin('ABC')).toBe('ABC');
  });
});
