/**
 * Copiloto FordCare — camada de sinais e priorização.
 *
 * Tudo aqui é determinístico e offline: os números saem do histórico do veículo,
 * nunca de um modelo generativo. É essa camada que alimenta tanto o card da Home
 * quanto o texto dos lembretes proativos.
 */

import { Vehicle, Maintenance } from '@/contexts/UserContext';
import { Alert } from '@/hooks/useAlerts';
import { descreverAlerta } from '@/utils/alerts';
import { daysSince } from '@/utils/daysSince';

const DIA_MS = 86_400_000;
const HORA_DO_LEMBRETE = 10; // 10h da manhã, horário local
const ANTECEDENCIA_DIAS = 7; // avisa uma semana antes de vencer
const MAX_LEMBRETES = 2;     // no máximo 2 notificações agendadas por vez

export type Recomendacao = {
  alertType: string;
  titulo: string;
  corpo: string;
  dispararEm: Date;
  prioridade: number; // maior = mais urgente
};

/**
 * Estima o ritmo de uso do veículo em km/mês.
 * Usa o histórico de manutenções quando há dados suficientes; senão cai para a
 * média desde a última revisão. Retorna null quando não dá para estimar com honestidade.
 */
export function estimarKmPorMes(vehicle: Vehicle, maintenances: Maintenance[]): number | null {
  const pontos = [
    ...maintenances.map((m) => ({ km: m.km, t: new Date(m.date).getTime() })),
    { km: vehicle.currentKm, t: Date.now() },
  ].sort((a, b) => a.t - b.t);

  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  let kmMes: number | null = null;

  const dias = (ultimo.t - primeiro.t) / DIA_MS;
  if (pontos.length >= 2 && dias >= 15 && ultimo.km > primeiro.km) {
    kmMes = ((ultimo.km - primeiro.km) / dias) * 30;
  } else {
    const diasDesde = daysSince(vehicle.lastServiceDate);
    const delta = vehicle.currentKm - vehicle.lastServiceKm;
    if (diasDesde >= 15 && delta > 0) kmMes = (delta / diasDesde) * 30;
  }

  if (kmMes == null || !isFinite(kmMes)) return null;
  // Limites de sanidade: fora disso o dado é ruído, não sinal.
  if (kmMes < 100 || kmMes > 8000) return null;
  return Math.round(kmMes / 50) * 50;
}

/** Em quantos dias o veículo deve atingir o limite de km daquele alerta. */
function diasAteOLimiteDeKm(kmRestante: number, kmMes: number | null): number | null {
  if (kmMes == null || kmMes <= 0 || kmRestante <= 0) return null;
  return Math.round((kmRestante / kmMes) * 30);
}

function proximaData(emDias: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(1, emDias));
  d.setHours(HORA_DO_LEMBRETE, 0, 0, 0);
  return d;
}

function textoDoMotivo(alert: Alert, kmMes: number | null): string {
  const ritmo = kmMes ? ` Você roda cerca de ${kmMes.toLocaleString('pt-BR')} km por mês.` : '';

  return `${descreverAlerta(alert)}.${ritmo}`;
}

/**
 * Transforma os alertas em recomendações priorizadas e datadas.
 * Vencidos vêm primeiro; entre os que ainda não venceram, o mais próximo do
 * limite ganha prioridade.
 */
export function gerarRecomendacoes(
  vehicle: Vehicle,
  maintenances: Maintenance[],
  alerts: Alert[],
): Recomendacao[] {
  const kmMes = estimarKmPorMes(vehicle, maintenances);

  return alerts
    .filter((a) => a.status !== 'ok')
    .map((alert) => {
      const urgente = alert.status === 'urgente';

      // Horizonte: o menor entre o prazo em dias e o prazo estimado em km.
      const porKm = diasAteOLimiteDeKm(alert.kmRemaining, kmMes);
      const horizonte = Math.min(
        alert.daysRemaining > 0 ? alert.daysRemaining : 0,
        porKm ?? Number.MAX_SAFE_INTEGER,
      );

      const dispararEm = urgente
        ? proximaData(1)
        : proximaData(Math.max(1, horizonte - ANTECEDENCIA_DIAS));

      return {
        alertType: alert.type,
        titulo: urgente
          ? `${alert.type} vencida no seu ${vehicle.model}`
          : `${alert.type} chegando no seu ${vehicle.model}`,
        corpo: `${textoDoMotivo(alert, kmMes)} Toque para agendar na rede oficial e ganhar ${alert.points} pts.`,
        dispararEm,
        prioridade: (urgente ? 1000 : 0) + Math.max(0, 500 - horizonte),
      };
    })
    .sort((a, b) => b.prioridade - a.prioridade)
    .slice(0, MAX_LEMBRETES);
}

/** Recomendação única para o card da Home (a de maior prioridade). */
export function recomendacaoPrincipal(
  vehicle: Vehicle | null,
  maintenances: Maintenance[],
  alerts: Alert[],
): Recomendacao | null {
  if (!vehicle) return null;
  return gerarRecomendacoes(vehicle, maintenances, alerts)[0] ?? null;
}
