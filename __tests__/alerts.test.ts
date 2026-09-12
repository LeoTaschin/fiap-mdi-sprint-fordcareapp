/**
 * `utils/alerts.ts` — motor de alertas de manutenção.
 *
 * É a regra de negócio mais importante do app: decide o que a Home mostra, o
 * que o Copiloto recomenda e quando o lembrete dispara. Vários testes aqui
 * nasceram de bugs reais encontrados em uso.
 */

import { computeAlerts, historicoDoVeiculo, descreverAlerta } from '@/utils/alerts';
import type { Vehicle, Maintenance } from '@/contexts/UserContext';

const DIA = 86_400_000;
const diasAtras = (n: number) => new Date(Date.now() - n * DIA);

const veiculoBase = {
  brand: 'Ford' as const,
  color: 'blue',
  lastServiceKm: 30000,
  lastServiceDate: diasAtras(400),
};
const ranger: Vehicle = { ...veiculoBase, id: 'v1', vin: 'AAA', model: 'Ranger', year: 2021, currentKm: 41200 };
const territory: Vehicle = { ...veiculoBase, id: 'v2', vin: 'BBB', model: 'Territory', year: 2023, currentKm: 18400 };

function servico(over: Partial<Maintenance> & { type: string }): Maintenance {
  return {
    id: Math.random().toString(36).slice(2),
    inNetwork: true,
    date: diasAtras(0),
    km: 40000,
    dealership: 'Ford Butantã',
    notes: '',
    pointsEarned: 0,
    ...over,
  } as Maintenance;
}

const statusDe = (v: Vehicle, ms: Maintenance[], tipo: string) =>
  computeAlerts(v, ms).find((a) => a.type === tipo)!.status;

describe('computeAlerts — sem histórico', () => {
  it('marca como vencido quando passou do intervalo em dias', () => {
    expect(statusDe(ranger, [], 'Revisão Geral')).toBe('urgente');
  });

  it('devolve lista vazia sem veículo', () => {
    expect(computeAlerts(null, [])).toEqual([]);
  });
});

describe('computeAlerts — serviço fora da rede', () => {
  // O carro foi atendido de qualquer forma. A distinção rede/fora da rede
  // afeta pontos e VIN Share, não se a manutenção aconteceu.
  it('zera o alerta igual a um serviço da rede', () => {
    const fora = [servico({ vin: 'AAA', type: 'Revisão Geral', km: 41000, inNetwork: false })];
    expect(statusDe(ranger, fora, 'Revisão Geral')).toBe('ok');
  });
});

describe('computeAlerts — escopo por veículo', () => {
  // Bug real: o histórico não era filtrado, então uma revisão no Territory
  // zerava o alerta do Ranger.
  const noTerritory = [servico({ vin: 'BBB', type: 'Revisão Geral', km: 18000 })];

  it('serviço de outro veículo não zera o alerta', () => {
    expect(statusDe(ranger, noTerritory, 'Revisão Geral')).toBe('urgente');
  });

  it('serviço do próprio veículo zera', () => {
    expect(statusDe(territory, noTerritory, 'Revisão Geral')).toBe('ok');
  });
});

describe('historicoDoVeiculo — vínculo do registro', () => {
  it('usa o VIN quando os dois lados têm', () => {
    const ms = [servico({ vin: 'AAA', type: 'x' }), servico({ vin: 'BBB', type: 'x' })];
    expect(historicoDoVeiculo(ranger, ms)).toHaveLength(1);
  });

  it('cai para vehicleId em registros anteriores ao chassi', () => {
    const ms = [servico({ vehicleId: 'v1', type: 'x' })];
    expect(historicoDoVeiculo({ ...ranger, vin: undefined }, ms)).toHaveLength(1);
  });

  it('aceita registro só com vehicleId mesmo em veículo com chassi', () => {
    const ms = [servico({ vehicleId: 'v1', type: 'x' })];
    expect(historicoDoVeiculo(ranger, ms)).toHaveLength(1);
  });

  it('ignora registro sem nenhum vínculo — atribuir sem prova seria pior', () => {
    const ms = [servico({ type: 'x' })];
    expect(historicoDoVeiculo(ranger, ms)).toHaveLength(0);
  });
});

describe('computeAlerts — desempate entre serviços do mesmo dia', () => {
  // Bug real: o formulário cria a data à meia-noite, então dois serviços do
  // mesmo tipo no mesmo dia têm timestamps idênticos. Sem desempate, a ordem
  // do array decidia — e um serviço a 30.000 km vencia outro a 40.000 km.
  const bronco: Vehicle = { ...veiculoBase, id: 'v3', vin: 'CCC', model: 'Bronco', year: 2026, currentKm: 40000 };
  const mesmoDia = [
    servico({ vin: 'CCC', type: 'Troca de Óleo', km: 30000 }),
    servico({ vin: 'CCC', type: 'Troca de Óleo', km: 40000 }),
  ];

  it('escolhe o de maior quilometragem', () => {
    expect(statusDe(bronco, mesmoDia, 'Troca de Óleo')).toBe('ok');
  });

  it('independe da ordem do array', () => {
    expect(statusDe(bronco, [...mesmoDia].reverse(), 'Troca de Óleo')).toBe('ok');
  });
});

describe('computeAlerts — independência entre tipos', () => {
  it('resolver a revisão não zera a troca de óleo', () => {
    const so = [servico({ vin: 'AAA', type: 'Revisão Geral', km: 41000 })];
    expect(statusDe(ranger, so, 'Revisão Geral')).toBe('ok');
    expect(statusDe(ranger, so, 'Troca de Óleo')).toBe('urgente');
  });
});

describe('computeAlerts — faixa de atenção', () => {
  it('marca atenção quando falta pouco em quilometragem', () => {
    // Troca de óleo vence a cada 10.000 km; alerta de atenção a 1.500 km.
    const quaseLa: Vehicle = { ...ranger, currentKm: 49000 };
    const ms = [servico({ vin: 'AAA', type: 'Troca de Óleo', km: 40000, date: diasAtras(1) })];
    expect(statusDe(quaseLa, ms, 'Troca de Óleo')).toBe('atencao');
  });
});

describe('descreverAlerta', () => {
  const alerta = (status: string, kmRemaining: number, daysRemaining: number) =>
    ({ type: 'Troca de Óleo', status, kmRemaining, daysRemaining, points: 100 }) as never;

  it('descreve atraso em dias', () => {
    expect(descreverAlerta(alerta('urgente', 5000, -35))).toBe('Vencida há 35 dias');
  });

  it('descreve atraso em quilometragem', () => {
    expect(descreverAlerta(alerta('urgente', -1200, 120))).toBe('Vencida há 1.200 km');
  });

  it('descreve os dois quando ambos estouraram', () => {
    expect(descreverAlerta(alerta('urgente', -1200, -35))).toBe('Vencida há 35 dias e 1.200 km');
  });

  it('não trata dias restantes como atraso quando o limite é de km', () => {
    // Bug real: com kmRemaining exatamente 0, a versão antiga caía no ramo dos
    // dias e imprimia "Vencida há 180 dias" logo abaixo de "revisão: hoje".
    expect(descreverAlerta(alerta('urgente', 0, 180))).toBe('Atingiu o limite de km');
  });

  it('reconhece vencimento por data no dia exato', () => {
    expect(descreverAlerta(alerta('urgente', 5000, 0))).toBe('Vence hoje');
  });

  it('usa quilometragem na faixa de atenção quando ela está próxima', () => {
    expect(descreverAlerta(alerta('atencao', 900, 100))).toBe('Em 900 km');
  });

  it('usa dias na faixa de atenção quando a quilometragem está longe', () => {
    expect(descreverAlerta(alerta('atencao', 8000, 20))).toBe('Em 20 dias');
  });

  it('descreve o estado em dia', () => {
    expect(descreverAlerta(alerta('ok', 8000, 150))).toBe('Em dia');
  });
});
