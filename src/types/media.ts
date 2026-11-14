export type MediaCategory =
  | 'movie_cinema'
  | 'movie_digital'
  | 'tv'
  | 'anime'
  | 'game';

export type TabId = 'home' | 'favorites' | MediaCategory;

export type ViewMode = 'list' | 'gallery';

export interface MediaItem {
  id: string;
  externalId: string;
  category: MediaCategory;
  title: string;
  originalTitle?: string;
  posterUrl: string;
  backdropUrl?: string;
  synopsis: string;
  genres: string[];
  // Plataformas de streaming / disponibilidade no Brasil (ex: ['Netflix'], ['HBO Max'], ['Amazon Prime'], ['Globoplay'], ['Disney+'], ['Telecine'], ['Cinema BR'])
  streamingPlatforms?: string[];
  rating?: number;
  // Quantidade de avaliações / reviews / engajamento na semana (TMDB vote_count, AniList popularity/trending, RAWG ratings_count)
  reviewsCount?: number;

  // Duração do filme ou duração média dos episódios (em minutos)
  runtimeMinutes?: number | null;
  episodeDurationMinutes?: number | null;

  // Campos de Filmes (Cinema Type 3 & Digital Type 4 sempre cruzados)
  director?: string;
  cinemaReleaseDate?: string | null; // YYYY-MM-DD (TMDB Type 3)
  digitalReleaseDate?: string | null; // YYYY-MM-DD (TMDB Type 4)
  isDigitalAvailable?: boolean;
  rssReleaseDetected?: boolean;
  rssReleaseTag?: string;

  // Campos de Séries e Animes
  studioOrNetwork?: string;
  seasonStatus?: string;
  nextEpisodeNumber?: number | null;
  nextEpisodeDate?: string | null; // ISO timestamp ou YYYY-MM-DD
  totalEpisodes?: number | null;

  // Campos de Jogos (RAWG + HowLongToBeat)
  developer?: string;
  platforms?: string[];
  releaseDate?: string | null; // YYYY-MM-DD
  hltbMainHours?: number | null;
  hltbExtraHours?: number | null;
  hltbCompletionistHours?: number | null;
  hltbLabel?: string;

  // Data unificada de ordenação cronológica
  sortEventDate?: string | null;
}

export interface AppSettings {
  userName: string;
  notificationsEnabled: boolean;
  tmdbApiKey: string;
  twitchClientId: string;
  twitchClientSecret: string;
  rawgApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  oneSignalAppId: string;
  discordWebhookUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  customRssFeedUrl: string;
  rssDigitalAlertsEnabled: boolean;
  notify3DaysBefore: boolean;
  notify1DayBefore: boolean;
  notifyEpisodeToday: boolean;
  notifyDigitalRelease: boolean;
}

export interface FavoriteRecord {
  id: string;
  user_id?: string;
  external_id: string;
  media_type: MediaCategory;
  title: string;
  poster_url: string;
  cinema_date: string | null;
  digital_date: string | null;
  next_episode_date: string | null;
  next_episode_number?: number | null;
  is_digital_available?: boolean;
  last_notified_at: string | null;
  item_snapshot: MediaItem;
}
