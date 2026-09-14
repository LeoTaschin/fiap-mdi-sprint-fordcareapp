import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ─── Chaves carregadas do .env (nunca hardcoded) ──────────────────────────────
const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL      ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// ─── Adaptador seguro: substitui AsyncStorage por SecureStore ─────────────────
// SecureStore usa Keychain (iOS) e EncryptedSharedPreferences (Android),
// mantendo o token de sessão criptografado em repouso no dispositivo.
const SecureStoreAdapter = {
  getItem:    (key: string)                => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string)                => SecureStore.deleteItemAsync(key),
};

// ─── Fallback para web ────────────────────────────────────────────────────────
// SecureStore não existe no navegador nem no render SSR do Expo Web (Node),
// onde `localStorage` também é indefinido. Sem esse fallback o client quebra
// logo na inicialização com "getValueWithKeyAsync is not a function".
const WebStorageAdapter = {
  getItem: async (key: string) => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  },
};

const storage = Platform.OS === 'web' ? WebStorageAdapter : SecureStoreAdapter;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false,
  },
});
