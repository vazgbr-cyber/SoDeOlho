import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppSettings } from '../types/media';

const STORAGE_KEY = 'so_de_olho_settings_v2';
export const DEFAULT_TMDB_API_KEY = '44c784d7e41455be0c03cb503201b61e';

export function getDefaultSettings(): AppSettings {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env || {};
  return {
    userName: 'Nebula_99',
    notificationsEnabled: true,
    tmdbApiKey: env.VITE_TMDB_API_KEY || DEFAULT_TMDB_API_KEY,
    rawgApiKey: env.VITE_RAWG_API_KEY || '',
    supabaseUrl: env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY || '',
    oneSignalAppId: env.VITE_ONESIGNAL_APP_ID || env.ONESIGNAL_APP_ID || '',
    discordWebhookUrl: '',
    telegramBotToken: '',
    telegramChatId: '',
    customRssFeedUrl: '',
    rssDigitalAlertsEnabled: true,
    notify3DaysBefore: true,
    notify1DayBefore: true,
    notifyEpisodeToday: true,
    notifyDigitalRelease: true,
  };
}

export function loadSettings(): AppSettings {
  const defaults = getDefaultSettings();
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem('so_de_olho_settings_v1');
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...defaults,
      ...parsed,
      userName: parsed.userName || defaults.userName,
      notificationsEnabled:
        parsed.notificationsEnabled ?? defaults.notificationsEnabled,
      // Garante que a chave TMDB do usuário seja sempre preenchida mesmo se o localStorage antigo estava vazio
      tmdbApiKey:
        parsed.tmdbApiKey && parsed.tmdbApiKey.trim()
          ? parsed.tmdbApiKey.trim()
          : defaults.tmdbApiKey,
      rawgApiKey: parsed.rawgApiKey ?? defaults.rawgApiKey,
      supabaseUrl: parsed.supabaseUrl ?? defaults.supabaseUrl,
      supabaseAnonKey: parsed.supabaseAnonKey ?? defaults.supabaseAnonKey,
      oneSignalAppId: parsed.oneSignalAppId ?? defaults.oneSignalAppId,
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Erro ao salvar configurações no navegador:', err);
  }
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

export function getSupabaseClient(settings?: AppSettings): SupabaseClient | null {
  const active = settings || loadSettings();
  const url = active.supabaseUrl?.trim();
  const key = active.supabaseAnonKey?.trim();

  if (!url || !key || !url.startsWith('http')) {
    return null;
  }

  const configKey = `${url}::${key}`;
  if (cachedClient && cachedConfigKey === configKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key);
    cachedConfigKey = configKey;
    return cachedClient;
  } catch {
    return null;
  }
}
