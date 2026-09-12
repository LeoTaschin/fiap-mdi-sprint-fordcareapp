import { supabase } from './supabase';

export type MaintenanceData = {
  vehicleId?: string;
  vin?: string;
  /** Padrão true. false marca serviço feito fora da rede oficial. */
  inNetwork?: boolean;
  type: string;
  date: Date;
  km: number;
  dealership: string;
  notes: string;
  pointsEarned: number;
};

export async function registrarManutencao(userId: string, data: MaintenanceData): Promise<string> {
  const { data: maintenance, error } = await supabase
    .from('maintenances')
    .insert({
      user_id: userId,
      vehicle_id: data.vehicleId ?? null,
      vin: data.vin ?? null,
      in_network: data.inNetwork ?? true,
      type: data.type,
      date: data.date.toISOString(),
      km: data.km,
      dealership: data.dealership,
      notes: data.notes,
      points_earned: data.pointsEarned,
    })
    .select('id')
    .single();
  if (error) throw error;

  const { data: profile } = await supabase
    .from('profiles')
    .select('points')
    .eq('id', userId)
    .single();

  if (profile) {
    const newPoints = (profile.points ?? 0) + data.pointsEarned;
    const level = newPoints >= 1500 ? 'ouro' : newPoints >= 500 ? 'prata' : 'bronze';
    await supabase
      .from('profiles')
      .update({ points: newPoints, level })
      .eq('id', userId);
  }

  return maintenance.id;
}

export async function buscarManutencoes(userId: string) {
  const { data, error } = await supabase
    .from('maintenances')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
