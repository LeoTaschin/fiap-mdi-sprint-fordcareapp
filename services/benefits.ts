import { supabase } from './supabase';

export type Redemption = {
  id: string;
  benefitLabel: string;
  pointsSpent: number;
  status: string;
  redeemedAt: string;
};

/** Erros de negócio que a tela sabe traduzir para o usuário. */
export type RedeemError = 'SALDO_INSUFICIENTE' | 'NAO_AUTENTICADO' | 'DESCONHECIDO';

/**
 * Resgata um benefício debitando os pontos de forma atômica no banco.
 * A checagem de saldo acontece dentro da função SQL (com FOR UPDATE), então
 * dois aparelhos do mesmo usuário não conseguem resgatar o mesmo saldo duas vezes.
 */
export async function resgatarBeneficio(label: string, cost: number): Promise<Redemption> {
  const { data, error } = await supabase.rpc('resgatar_beneficio', {
    p_label: label,
    p_cost: cost,
  });

  if (error) {
    const code: RedeemError =
      error.message?.includes('SALDO_INSUFICIENTE') ? 'SALDO_INSUFICIENTE'
      : error.message?.includes('NAO_AUTENTICADO') ? 'NAO_AUTENTICADO'
      : 'DESCONHECIDO';
    throw new Error(code);
  }

  return {
    id:           data.id,
    benefitLabel: data.benefit_label,
    pointsSpent:  data.points_spent,
    status:       data.status,
    redeemedAt:   data.redeemed_at,
  };
}

export async function buscarResgates(userId: string): Promise<Redemption[]> {
  const { data, error } = await supabase
    .from('benefit_redemptions')
    .select('id, benefit_label, points_spent, status, redeemed_at')
    .eq('user_id', userId)
    .order('redeemed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id:           r.id,
    benefitLabel: r.benefit_label,
    pointsSpent:  r.points_spent,
    status:       r.status,
    redeemedAt:   r.redeemed_at,
  }));
}
