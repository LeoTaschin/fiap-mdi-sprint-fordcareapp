/**
 * `utils/safeError.ts` — sanitização de erros.
 *
 * Requisito de segurança: nome de tabela, política RLS e stack trace nunca
 * podem chegar à interface. Estes testes existem para que uma refatoração não
 * abra esse vazamento sem ninguém perceber.
 */

import { safeErrorMessage } from '@/utils/safeError';

describe('safeErrorMessage — traduções conhecidas', () => {
  it.each([
    ['Invalid login credentials', /senha incorretos/i],
    ['User already registered', /já está cadastrado/i],
    ['Email not confirmed', /confirme seu e-mail/i],
    ['Failed to fetch', /sem conex/i],
    ['duplicate key value violates unique constraint', /já existe/i],
  ])('traduz %s', (bruto, esperado) => {
    expect(safeErrorMessage(new Error(bruto))).toMatch(esperado);
  });
});

describe('safeErrorMessage — não vaza infraestrutura', () => {
  const sensiveis = [
    'new row violates row-level security policy for table "maintenances"',
    'permission denied for table profiles',
    'null value in column "vin" of relation "vehicles"',
  ];

  it.each(sensiveis)('não devolve o texto bruto de: %s', (bruto) => {
    const msg = safeErrorMessage(new Error(bruto));
    expect(msg).not.toContain('table');
    expect(msg).not.toContain('relation');
    expect(msg).not.toContain('policy');
  });

  it('usa o fallback para erro desconhecido', () => {
    expect(safeErrorMessage(new Error('ECONNRESET at socket'), 'Tente de novo.')).toBe('Tente de novo.');
  });

  it('lida com valores que não são Error', () => {
    expect(safeErrorMessage(null)).toEqual(expect.any(String));
    expect(safeErrorMessage(undefined)).toEqual(expect.any(String));
    expect(safeErrorMessage({ codigo: 42 })).toEqual(expect.any(String));
  });
});
