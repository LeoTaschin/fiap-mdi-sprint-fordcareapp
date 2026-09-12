import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Level = 'bronze' | 'prata' | 'ouro';

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  points: number;
  level: Level;
};

export type Vehicle = {
  id: string;
  brand: 'Ford';
  /** Chassi — âncora do histórico, sobrevive à troca de dono. */
  vin?: string;
  model: string;
  color: string;
  year: number;
  currentKm: number;
  lastServiceKm: number;
  lastServiceDate: Date;
};

export type Maintenance = {
  id: string;
  /** Chassi do veículo em que o serviço foi feito. */
  vin?: string;
  /** false = serviço declarado pelo cliente fora da rede oficial Ford. */
  inNetwork: boolean;
  /** Fallback para registros antigos, anteriores ao VIN. */
  vehicleId?: string;
  type: string;
  date: Date;
  km: number;
  dealership: string;
  notes: string;
  pointsEarned: number;
};

type State = {
  initialized: boolean;
  user: User | null;
  profile: UserProfile | null;
  vehicles: Vehicle[];
  selectedVehicleIndex: number;
  vehicle: Vehicle | null;
  maintenances: Maintenance[];
};

type Action =
  | { type: 'SET_INITIALIZED' }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_PROFILE'; payload: UserProfile }
  | { type: 'SET_VEHICLES'; payload: Vehicle[] }
  | { type: 'ADD_VEHICLE'; payload: Vehicle }
  | { type: 'SELECT_VEHICLE'; payload: number }
  | { type: 'SET_VEHICLE'; payload: Vehicle }
  | { type: 'UPDATE_VEHICLE'; payload: Vehicle }
  | { type: 'SET_MAINTENANCES'; payload: Maintenance[] }
  | { type: 'UPDATE_KM'; payload: number }
  | { type: 'ADD_MAINTENANCE'; payload: Maintenance }
  | { type: 'UPDATE_POINTS'; payload: { points: number; level: Level } }
  | { type: 'RESET' };

const CACHE_KEY = '@fordcare/user_data_v2';

// ─── Reducer ──────────────────────────────────────────────────────────────────

const initialState: State = {
  initialized: false,
  user: null,
  profile: null,
  vehicles: [],
  selectedVehicleIndex: 0,
  vehicle: null,
  maintenances: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_INITIALIZED':
      return { ...state, initialized: true };
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_PROFILE':
      return { ...state, profile: action.payload };
    case 'SET_VEHICLES': {
      const idx = Math.min(state.selectedVehicleIndex, Math.max(0, action.payload.length - 1));
      return { ...state, vehicles: action.payload, selectedVehicleIndex: idx, vehicle: action.payload[idx] ?? null };
    }
    case 'ADD_VEHICLE':
      return { ...state, vehicles: [...state.vehicles, action.payload] };
    case 'SELECT_VEHICLE': {
      const idx = Math.max(0, Math.min(action.payload, state.vehicles.length - 1));
      return { ...state, selectedVehicleIndex: idx, vehicle: state.vehicles[idx] ?? null };
    }
    // Atualiza pelo ID. O SET_VEHICLE escreve no índice selecionado — se o
    // usuário registrar serviço num veículo que não é o ativo no swiper, ele
    // sobrescreveria o carro errado.
    case 'UPDATE_VEHICLE': {
      const vehicles = state.vehicles.map((v) => (v.id === action.payload.id ? action.payload : v));
      const atual = vehicles[state.selectedVehicleIndex] ?? null;
      return { ...state, vehicles, vehicle: atual };
    }
    case 'SET_VEHICLE': {
      const updated = state.vehicles.map((v, i) => i === state.selectedVehicleIndex ? action.payload : v);
      return { ...state, vehicle: action.payload, vehicles: updated };
    }
    case 'SET_MAINTENANCES':
      return { ...state, maintenances: action.payload };
    case 'UPDATE_KM': {
      if (!state.vehicle) return state;
      const updated = { ...state.vehicle, currentKm: action.payload };
      const updatedVehicles = state.vehicles.map((v, i) => i === state.selectedVehicleIndex ? updated : v);
      return { ...state, vehicle: updated, vehicles: updatedVehicles };
    }
    case 'ADD_MAINTENANCE':
      return { ...state, maintenances: [action.payload, ...state.maintenances] };
    case 'UPDATE_POINTS':
      return state.profile ? { ...state, profile: { ...state.profile, ...action.payload } } : state;
    case 'RESET':
      return { ...initialState, initialized: true };
    default:
      return state;
  }
}

// ─── Data loader ──────────────────────────────────────────────────────────────

async function loadUserData(userId: string, dispatch: React.Dispatch<Action>) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profile) {
    dispatch({
      type: 'SET_PROFILE',
      payload: { uid: userId, name: profile.name, email: profile.email, points: profile.points, level: profile.level },
    });
  }

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const mappedVehicles: Vehicle[] = (vehicles ?? []).map((v) => ({
    id: v.id,
    brand: 'Ford' as const,
    vin: v.vin ?? undefined,
    model: v.model,
    color: v.color,
    year: v.year,
    currentKm: v.current_km,
    lastServiceKm: v.last_service_km,
    lastServiceDate: new Date(v.last_service_date),
  }));
  dispatch({ type: 'SET_VEHICLES', payload: mappedVehicles });

  const { data: maintenances } = await supabase
    .from('maintenances')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  const mappedMaint: Maintenance[] = (maintenances ?? []).map((m) => ({
    id: m.id,
    vin: m.vin ?? undefined,
    inNetwork: m.in_network ?? true,
    vehicleId: m.vehicle_id ?? undefined,
    type: m.type,
    date: new Date(m.date),
    km: m.km,
    dealership: m.dealership ?? '',
    notes: m.notes ?? '',
    pointsEarned: m.points_earned,
  }));
  dispatch({ type: 'SET_MAINTENANCES', payload: mappedMaint });

  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ profile, vehicles: mappedVehicles, maintenances: mappedMaint }));
}

// ─── Context ──────────────────────────────────────────────────────────────────

type ContextValue = State & { dispatch: React.Dispatch<Action> };

const UserContext = createContext<ContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const cached = JSON.parse(raw);
        if (cached.profile) dispatch({ type: 'SET_PROFILE', payload: cached.profile });
        if (cached.vehicles?.length) {
          dispatch({
            type: 'SET_VEHICLES',
            payload: cached.vehicles.map((v: any) => ({ ...v, lastServiceDate: new Date(v.lastServiceDate) })),
          });
        }
        if (cached.maintenances?.length) {
          dispatch({
            type: 'SET_MAINTENANCES',
            payload: cached.maintenances.map((m: any) => ({ ...m, date: new Date(m.date) })),
          });
        }
      } catch {}
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      dispatch({ type: 'SET_USER', payload: user });

      if (user) {
        await loadUserData(user.id, dispatch);
      } else {
        await AsyncStorage.removeItem(CACHE_KEY);
        dispatch({ type: 'RESET' });
      }

      dispatch({ type: 'SET_INITIALIZED' });
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ ...state, dispatch }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside UserProvider');
  return ctx;
}
