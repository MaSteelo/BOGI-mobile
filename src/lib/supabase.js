import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const SUPABASE_URL =
  Constants.expoConfig?.extra?.supabaseUrl ||
  process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log("[Supabase] URL:", SUPABASE_URL ?? "❌ undefined");
console.log("[Supabase] KEY:", SUPABASE_ANON_KEY ? "✓ 있음" : "❌ undefined");

// expo-secure-store를 Supabase 세션 스토리지로 사용 (localStorage 대체)
const ExpoSecureStoreAdapter = {
  getItem: async (key) => {
    try {
      const value = await SecureStore.getItemAsync(key);
      console.log("[SecureStore] getItem:", key, "→", value ? "(found)" : "(null)");
      return value;
    } catch (e) {
      console.warn("[SecureStore] getItem error:", key, e);
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      await SecureStore.setItemAsync(key, value);
      console.log("[SecureStore] setItem:", key);
    } catch (e) {
      console.warn("[SecureStore] setItem error:", key, e);
    }
  },
  removeItem: async (key) => {
    try {
      await SecureStore.deleteItemAsync(key);
      console.log("[SecureStore] removeItem:", key);
    } catch (e) {
      console.warn("[SecureStore] removeItem error:", key, e);
    }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
