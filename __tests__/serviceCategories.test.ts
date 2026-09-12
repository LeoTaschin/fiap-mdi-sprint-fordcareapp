/**
 * `constants/serviceCategories.ts` — classificação dos serviços.
 *
 * A camada de palavras-chave é o que impede que todo serviço digitado no fluxo
 * "fora da rede" caia em "Outros" e a categorização morra no primeiro uso real.
 */

import { categoriaDoServico, CATEGORIAS, ORDEM_CATEGORIAS } from '@/constants/serviceCategories';
import { MAINTENANCE_RULES } from '@/constants/maintenanceRules';

describe('categoriaDoServico — tipos conhecidos', () => {
  it.each([
    ['Troca de Óleo', 'motor'],
    ['Filtro de Ar', 'motor'],
    ['Rodízio de Pneus', 'pneus'],
    ['Revisão Geral', 'revisao'],
  ])('classifica "%s" como %s', (tipo, esperado) => {
    expect(categoriaDoServico(tipo as string)).toBe(esperado);
  });

  it('cobre todos os tipos das regras de manutenção', () => {
    MAINTENANCE_RULES.forEach((r) => {
      expect(categoriaDoServico(r.type)).not.toBe('outros');
    });
  });
});

describe('categoriaDoServico — texto livre', () => {
  // Serviços digitados no fluxo externo não passam pela tabela de tipos.
  it.each([
    ['Alinhamento e Balanceamento', 'pneus'],
    ['Troca de pneus dianteiros', 'pneus'],
    ['Pastilhas de Freio', 'freios'],
    ['Amortecedor traseiro', 'freios'],
    ['Correia dentada', 'motor'],
    ['Troca de bateria', 'motor'],
    ['Inspeção anual', 'revisao'],
  ])('classifica "%s" como %s pela palavra-chave', (tipo, esperado) => {
    expect(categoriaDoServico(tipo as string)).toBe(esperado);
  });

  it('é insensível a acento e caixa nas palavras-chave', () => {
    expect(categoriaDoServico('TROCA DE OLEO DO MOTOR')).toBe('motor');
  });

  it('cai em "outros" quando nada casa', () => {
    expect(categoriaDoServico('Higienização interna')).toBe('outros');
    expect(categoriaDoServico('Outro')).toBe('outros');
  });
});

describe('tabela de categorias', () => {
  it('define rótulo, ícone e cor para toda categoria da ordem de exibição', () => {
    ORDEM_CATEGORIAS.forEach((cat) => {
      expect(CATEGORIAS[cat]).toMatchObject({
        label: expect.any(String),
        icone: expect.any(String),
        cor: expect.stringMatching(/^#[0-9A-F]{6}$/i),
      });
    });
  });

  it('não repete cor entre categorias — elas precisam ser distinguíveis', () => {
    const cores = ORDEM_CATEGORIAS.map((c) => CATEGORIAS[c].cor);
    expect(new Set(cores).size).toBe(cores.length);
  });
});
