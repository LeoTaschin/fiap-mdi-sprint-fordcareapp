/**
 * Testes das funções puras de formatação e cálculo de datas.
 *
 * Essas funções aparecem em praticamente toda tela do app (histórico,
 * passaporte, alertas), então uma regressão aqui é visível para o usuário
 * em vários lugares ao mesmo tempo.
 */

import { formatKm, formatDate, formatDateTime } from '@/utils/formatKm';
import { formatDate as formatDateCurto } from '@/utils/formatDate';
import { daysSince, daysUntil } from '@/utils/daysSince';

/** Remove o espaço não-quebrável que o Intl usa como separador de milhar. */
function normalizar(s: string): string {
  return s.replace(/ /g, ' ');
}

describe('formatKm', () => {
  it('usa separador de milhar pt-BR e sufixo km', () => {
    expect(normalizar(formatKm(38540))).toBe('38.540 km');
  });

  it('formata valores abaixo de mil sem separador', () => {
    expect(normalizar(formatKm(950))).toBe('950 km');
  });

  it('formata zero', () => {
    expect(normalizar(formatKm(0))).toBe('0 km');
  });

  it('formata valores acima de um milhão', () => {
    expect(normalizar(formatKm(1234567))).toBe('1.234.567 km');
  });
});

describe('formatDate', () => {
  it('formata um objeto Date como DD/MM/AAAA', () => {
    expect(formatDate(new Date(2024, 2, 15))).toBe('15/03/2024');
  });

  it('aceita string ISO', () => {
    // Meio-dia UTC evita que o fuso do runner empurre a data para o dia anterior.
    expect(formatDate('2024-03-15T12:00:00Z')).toBe('15/03/2024');
  });

  it('preenche dia e mês com zero à esquerda', () => {
    expect(formatDate(new Date(2024, 0, 5))).toBe('05/01/2024');
  });
});

describe('formatDate (utils/formatDate)', () => {
  it('produz o mesmo formato de utils/formatKm — as duas telas não podem divergir', () => {
    const d = new Date(2024, 0, 5);
    expect(formatDateCurto(d)).toBe(formatDate(d));
  });
});

describe('formatDateTime', () => {
  it('inclui data e hora separadas por "às"', () => {
    const resultado = formatDateTime(new Date(2024, 2, 15, 14, 30));
    expect(resultado).toBe('15/03/2024 às 14:30');
  });

  it('usa dois dígitos na hora', () => {
    const resultado = formatDateTime(new Date(2024, 2, 15, 9, 5));
    expect(resultado).toBe('15/03/2024 às 09:05');
  });
});

describe('daysSince', () => {
  it('retorna 0 para agora', () => {
    expect(daysSince(new Date())).toBe(0);
  });

  it('conta dias inteiros passados', () => {
    const dezDiasAtras = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    expect(daysSince(dezDiasAtras)).toBe(10);
  });

  it('arredonda para baixo (23h ainda é 0 dia)', () => {
    const ontemQuase = new Date(Date.now() - 23 * 60 * 60 * 1000);
    expect(daysSince(ontemQuase)).toBe(0);
  });

  it('retorna negativo para data futura', () => {
    const amanha = new Date(Date.now() + 25 * 60 * 60 * 1000);
    expect(daysSince(amanha)).toBeLessThan(0);
  });

  it('aceita string ISO', () => {
    const iso = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysSince(iso)).toBe(5);
  });
});

describe('daysUntil', () => {
  it('conta dias restantes até uma data futura', () => {
    const emSeteDias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(daysUntil(emSeteDias)).toBe(7);
  });

  it('retorna negativo para data vencida — é assim que o alerta vira urgente', () => {
    const tresDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(daysUntil(tresDiasAtras)).toBe(-3);
  });

  it('arredonda para cima (parte de um dia ainda conta como 1)', () => {
    const emDozeHoras = new Date(Date.now() + 12 * 60 * 60 * 1000);
    expect(daysUntil(emDozeHoras)).toBe(1);
  });

  it('é o inverso aproximado de daysSince', () => {
    const data = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    expect(daysUntil(data)).toBe(-daysSince(data));
  });
});
