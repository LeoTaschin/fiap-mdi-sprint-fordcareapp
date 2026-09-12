/**
 * Motor de alertas de manutenção — lógica pura, sem React e sem rede.
 *
 * Fica separado do hook de propósito: é a regra de negócio mais importante do
 * app (decide o que o Copiloto recomenda e o que a Home mostra) e precisa ser
 * testável isoladamente.
 */

import type { Vehicle, Maintenance } from '@/contexts/UserContext';
import {
  MAINTENANCE_RULES,
  ALERT_THRESHOLD_KM,
  ALERT_THRESHOLD_DAYS,
} from '@/constants/maintenanceRules';
import { daysSince } from '@/utils/daysSince';

export type AlertStatus = 'urgente' | 'atencao' | 'ok';

export type Alert = {
  type: string;
  status: AlertStatus;
  kmRemaining: number;
  daysRemaining: number;
  points: number;
};

/** Manutenções feitas neste veículo. Usa o VIN; cai no id nos registros legados. */
export function historicoDoVeiculo(vehicle: Vehicle, maintenances: Maintenance[]): Maintenance[] {
  return maintenances.filter((m) => {
    // O VIN é a âncora preferida quando os dois lados têm.
    if (vehicle.vin && m.vin) return m.vin === vehicle.vin;
    // Senão, o id do veículo — inclusive para registros anteriores ao chassi.
    if (m.vehicleId) return m.vehicleId === vehicle.id;
    // Sem VIN e sem id não há como atribuir o serviço a um carro específico.
    return false;
  });
}

export function computeAlerts(vehicle: Vehicle | null, maintenances: Maintenance[]): Alert[] {
  if (!vehicle) return [];

  // Só o histórico DESTE veículo conta. Sem este filtro, uma revisão feita no
  // Territory zerava o alerta do Ranger — uma conta pode ter vários veículos.
  const doVeiculo = historicoDoVeiculo(vehicle, maintenances);

  return MAINTENANCE_RULES.map((rule) => {
    // Serviço mais recente deste tipo, feito neste veículo.
    // Serviço fora da rede também conta: o carro foi atendido de qualquer forma.
    // Ordena por data e, em caso de EMPATE, pelo maior KM.
    //
    // O empate não é raro — é a regra: o formulário de serviço externo cria a
    // data com `new Date(ano, mes, dia)`, ou seja, meia-noite. Dois serviços
    // do mesmo tipo registrados no mesmo dia têm timestamps idênticos, e o
    // desempate ficava por conta da ordem do array. Era assim que uma troca de
    // óleo a 30.000 km vencia outra a 40.000 km do mesmo dia, e a pendência
    // continuava de pé. Com o odômetro só crescendo, maior KM = mais recente.
    const lastOfType = doVeiculo
      .filter((m) => m.type === rule.type)
      .sort((a, b) => b.date.getTime() - a.date.getTime() || b.km - a.km)[0];

    // Sem registro específico, cai para a última revisão global do veículo.
    const baseKm = lastOfType?.km ?? vehicle.lastServiceKm;
    const baseDate = lastOfType?.date ?? vehicle.lastServiceDate;

    const kmSinceService = vehicle.currentKm - baseKm;
    const daysSinceService = daysSince(baseDate);

    const kmRemaining = rule.intervalKm - kmSinceService;
    const daysRemaining = rule.intervalDays - daysSinceService;

    let status: AlertStatus = 'ok';
    if (kmRemaining <= 0 || daysRemaining <= 0) {
      status = 'urgente';
    } else if (kmRemaining <= ALERT_THRESHOLD_KM || daysRemaining <= ALERT_THRESHOLD_DAYS) {
      status = 'atencao';
    }

    return { type: rule.type, status, kmRemaining, daysRemaining, points: rule.points };
  });
}

/**
 * Frase curta que explica a situação do alerta.
 *
 * Fonte única para o card de pendências e para o Copiloto. Existe porque a
 * versão anterior estava duplicada nos dois lugares e errava o mesmo caso: com
 * `kmRemaining` exatamente 0 ela caía no ramo dos dias e imprimia os dias
 * RESTANTES como se fossem de atraso ("vencida há 180 dias" logo abaixo de
 * "última revisão: hoje").
 */
export function descreverAlerta(alert: Alert): string {
  const { kmRemaining: km, daysRemaining: dias } = alert;

  if (alert.status === 'urgente') {
    const partes: string[] = [];
    if (dias < 0) partes.push(`${Math.abs(dias)} dias`);
    if (km < 0) partes.push(`${Math.abs(km).toLocaleString('pt-BR')} km`);

    if (partes.length > 0) return `Vencida há ${partes.join(' e ')}`;
    // Chegou ao limite exato: nem km nem dias ficaram negativos.
    return km <= 0 ? 'Atingiu o limite de km' : 'Vence hoje';
  }

  if (alert.status === 'atencao') {
    return km <= ALERT_THRESHOLD_KM
      ? `Em ${km.toLocaleString('pt-BR')} km`
      : `Em ${dias} dias`;
  }

  return 'Em dia';
}
