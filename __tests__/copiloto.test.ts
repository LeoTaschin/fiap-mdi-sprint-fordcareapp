/**
 * `utils/copiloto.ts` — camada de sinais e priorização.
 *
 * É o que sustenta a promessa de "sugestão personalizada": os números da
 * recomendação saem daqui, nunca de um modelo generativo. Se a estimativa de
 * ritmo de uso mentir, o Copiloto mente junto.
 */

import { estimarKmPorMes, gerarRecomendacoes, recomendacaoPrincipal } from '@/utils/copiloto';
import { computeAlerts } from '@/utils/alerts';
import type { Vehicle, Maintenance } from '@/contexts/UserContext';

const DIA = 86_400_000;
const diasAtras = (n: number) => new Date(Date.now() - n * DIA);

const veiculo = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1',
  brand: 'Ford',
  vin: 'AAA',
  model: 'Ranger',
  color: 'blue',
  year: 2021,
  currentKm: 33000,
  lastServiceKm: 30000,
  lastServiceDate: diasAtras(100),
  ...over,
});

describe('estimarKmPorMes', () => {
  it('estima a partir da última revisão quando não há histórico', () => {
    // 3.000 km em 100 dias => 900 km/mês
    expect(estimarKmPorMes(veiculo(), [])).toBe(900);
  });

  it('devolve null quando o intervalo é curto demais para ser confiável', () => {
    // Menos de 15 dias: qualquer média seria ruído, não sinal.
    expect(estimarKmPorMes(veiculo({ lastServiceDate: diasAtras(5) }), [])).toBeNull();
  });

  it('devolve null quando o resultado fica abaixo do limite de sanidade', () => {
    // 50 km em 100 dias => 15 km/mês, fora da faixa plausível.
    expect(estimarKmPorMes(veiculo({ currentKm: 30050 }), [])).toBeNull();
  });

  it('devolve null quando o resultado fica acima do limite de sanidade', () => {
    // 40.000 km em 100 dias => 12.000 km/mês.
    expect(estimarKmPorMes(veiculo({ currentKm: 70000 }), [])).toBeNull();
  });

  it('arredonda para múltiplos de 50 — precisão falsa não ajuda ninguém', () => {
    const km = estimarKmPorMes(veiculo({ currentKm: 33333 }), []);
    expect(km! % 50).toBe(0);
  });
});

describe('gerarRecomendacoes', () => {
  const v = veiculo({ currentKm: 45000, lastServiceKm: 30000, lastServiceDate: diasAtras(400) });
  const alerts = computeAlerts(v, []);

  it('ignora o que está em dia', () => {
    const recs = gerarRecomendacoes(v, [], alerts);
    const tipos = recs.map((r) => r.alertType);
    const emDia = alerts.filter((a) => a.status === 'ok').map((a) => a.type);
    emDia.forEach((t) => expect(tipos).not.toContain(t));
  });

  it('limita a duas recomendações para não virar spam de notificação', () => {
    expect(gerarRecomendacoes(v, [], alerts).length).toBeLessThanOrEqual(2);
  });

  it('agenda sempre no futuro', () => {
    gerarRecomendacoes(v, [], alerts).forEach((r) => {
      expect(r.dispararEm.getTime()).toBeGreaterThan(Date.now());
    });
  });

  it('prioriza o vencido sobre o que ainda vai vencer', () => {
    const recs = gerarRecomendacoes(v, [], alerts);
    const prioridades = recs.map((r) => r.prioridade);
    expect([...prioridades].sort((a, b) => b - a)).toEqual(prioridades);
  });

  it('cita o modelo do veículo no título', () => {
    const [rec] = gerarRecomendacoes(v, [], alerts);
    expect(rec.titulo).toContain(v.model);
  });

  it('devolve lista vazia quando está tudo em dia', () => {
    const novo = veiculo({ currentKm: 30100, lastServiceKm: 30000, lastServiceDate: diasAtras(1) });
    expect(gerarRecomendacoes(novo, [], computeAlerts(novo, []))).toEqual([]);
  });
});

describe('recomendacaoPrincipal', () => {
  it('devolve null sem veículo', () => {
    expect(recomendacaoPrincipal(null, [], [])).toBeNull();
  });

  it('devolve a de maior prioridade', () => {
    const v = veiculo({ currentKm: 45000, lastServiceDate: diasAtras(400) });
    const alerts = computeAlerts(v, []);
    const principal = recomendacaoPrincipal(v, [], alerts);
    const todas = gerarRecomendacoes(v, [], alerts);
    expect(principal).toEqual(todas[0]);
  });
});
