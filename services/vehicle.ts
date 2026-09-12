import { supabase } from './supabase';

export type VehicleData = {
  brand: 'Ford';
  vin?: string;
  model: string;
  color: string;
  year: number;
  currentKm: number;
  lastServiceKm: number;
  lastServiceDate: Date;
};

export async function salvarVeiculo(userId: string, data: VehicleData): Promise<string> {
  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .insert({
      user_id: userId,
      brand: data.brand,
      vin: data.vin ?? null,
      model: data.model,
      color: data.color,
      year: data.year,
      current_km: data.currentKm,
      last_service_km: data.lastServiceKm,
      last_service_date: data.lastServiceDate.toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return vehicle.id;
}

export async function atualizarKm(vehicleId: string, newKm: number) {
  const { error } = await supabase
    .from('vehicles')
    .update({ current_km: newKm })
    .eq('id', vehicleId);
  if (error) throw error;
}

export async function atualizarServico(vehicleId: string, km: number, date: Date) {
  const { error } = await supabase
    .from('vehicles')
    .update({ last_service_km: km, last_service_date: date.toISOString() })
    .eq('id', vehicleId);
  if (error) throw error;
}

export async function buscarVeiculos(userId: string) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
