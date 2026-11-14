import { AppSettings, MediaCategory, MediaItem } from '../types/media';
import { getCuratedFallbackData } from '../data/curatedFallbackData';
import {
  getSupabaseClient,
  DEFAULT_TMDB_API_KEY,
  DEFAULT_TWITCH_CLIENT_ID,
  DEFAULT_TWITCH_CLIENT_SECRET,
} from '../lib/settings';
import { getLocalIsoDate, extractIsoDatePart } from '../lib/dateUtils';

const TMDB_MOVIE_GENRES: Record<number, string> = {
  28: 'Ação',
  12: 'Aventura',
  16: 'Animação',
  35: 'Comédia',
  80: 'Crime',
  99: 'Documentário',
  18: 'Drama',
  10751: 'Família',
  14: 'Fantasia',
  36: 'História',
  27: 'Terror',
  10402: 'Música',
  9648: 'Mistério',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'Cinema TV',
  53: 'Suspense',
  10752: 'Guerra',
  37: 'Faroeste',
};

const TMDB_TV_GENRES: Record<number, string> = {
  10759: 'Ação & Aventura',
  16: 'Animação',
  35: 'Comédia',
  80: 'Crime',
  99: 'Documentário',
  18: 'Drama',
  10751: 'Família',
  10762: 'Kids',
  9648: 'Mistério',
  10763: 'Notícias',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasia',
  10766: 'Novela',
  10767: 'Talk Show',
  10768: 'Guerra & Política',
  37: 'Faroeste',
};

function buildTmdbHeadersAndParam(apiKey: string): {
  headers: Record<string, string>;
  queryParam: string;
} {
  const clean = (apiKey || DEFAULT_TMDB_API_KEY).trim();
  if (clean.startsWith('eyJ')) {
    return {
      headers: {
        Authorization: `Bearer ${clean}`,
        Accept: 'application/json',
      },
      queryParam: '',
    };
  }
  return {
    headers: { Accept: 'application/json' },
    queryParam: `&api_key=${encodeURIComponent(clean)}`,
  };
}

interface TmdbRawMovie {
  id: number;
  title?: string;
  original_title?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  release_date?: string;
  runtime?: number;
}

interface TmdbRawTv {
  id: number;
  name?: string;
  original_name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  first_air_date?: string;
}

// ============================================================================
// PROVEDORES DE STREAMING E REDES OFICIAIS NO BRASIL (TMDB WATCH_REGION = BR)
// ============================================================================

export interface BrStreamingConfig {
  label: string;
  providerIds: string;
  networkIds?: string;
}

export const BR_STREAMING_PLATFORMS: BrStreamingConfig[] = [
  { label: 'Netflix', providerIds: '8', networkIds: '213' },
  { label: 'Amazon Prime', providerIds: '119', networkIds: '1024' },
  { label: 'HBO Max', providerIds: '1899|384', networkIds: '49|3186' },
  { label: 'Globoplay', providerIds: '307', networkIds: '3290|60' },
  { label: 'Disney+', providerIds: '337', networkIds: '2739' },
  { label: 'Telecine', providerIds: '227' },
];

export const ALL_BR_PROVIDER_IDS = '8|119|1899|384|307|337|227';
export const ALL_BR_NETWORK_IDS = '213|1024|49|3186|3290|60|2739';

// Cache local de Diretor + Produtora/Estúdio dos filmes por ID da TMDB
const MOVIE_CREDITS_STORAGE_KEY = 'so_de_olho_movie_credits_v1';
let movieDirectorCompanyCache: Record<string, { directorAndCompany: string; runtime?: number }> | null = null;

function getMovieCreditsCache(): Record<string, { directorAndCompany: string; runtime?: number }> {
  if (movieDirectorCompanyCache) return movieDirectorCompanyCache;
  try {
    const raw = localStorage.getItem(MOVIE_CREDITS_STORAGE_KEY);
    if (raw) {
      movieDirectorCompanyCache = JSON.parse(raw);
      return movieDirectorCompanyCache || {};
    }
  } catch {
    // Ignore storage errors
  }
  movieDirectorCompanyCache = {};
  return movieDirectorCompanyCache;
}

function saveMovieCreditsCache(): void {
  if (!movieDirectorCompanyCache) return;
  try {
    localStorage.setItem(
      MOVIE_CREDITS_STORAGE_KEY,
      JSON.stringify(movieDirectorCompanyCache)
    );
  } catch {
    // Ignore storage quota errors
  }
}

function extractDirectorAndCompanyFromTmdbDetail(detail: {
  credits?: { crew?: Array<{ job?: string; name?: string }> };
  production_companies?: Array<{ name?: string }>;
}): string | null {
  const crew = detail?.credits?.crew || [];
  const directors = crew
    .filter((c) => c.job === 'Director' && c.name)
    .slice(0, 2)
    .map((c) => c.name!.trim());

  const companies = (detail?.production_companies || [])
    .filter((pc) => pc.name && pc.name.trim().length > 0)
    .slice(0, 2)
    .map((pc) => pc.name!.trim());

  const dirStr = directors.join(' & ');
  const compStr = companies[0] || '';

  if (dirStr && compStr) {
    return `${dirStr} (${compStr})`;
  }
  if (dirStr) {
    return dirStr;
  }
  if (compStr) {
    return compStr;
  }
  return null;
}

async function enrichMoviesWithDirectorAndCompany(
  items: MediaItem[],
  headers: Record<string, string>,
  queryParam: string
): Promise<MediaItem[]> {
  const cache = getMovieCreditsCache();
  const missingIds = Array.from(
    new Set(
      items
        .filter(
          (it) =>
            (it.category === 'movie_cinema' || it.category === 'movie_digital') &&
            it.externalId &&
            !cache[it.externalId]
        )
        .map((it) => it.externalId)
    )
  );

  // Busca em lotes paralelos os detalhes (credits + production_companies) dos filmes ainda não cacheados
  const BATCH_SIZE = 16;
  for (let i = 0; i < missingIds.length; i += BATCH_SIZE) {
    const batch = missingIds.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (extId) => {
        try {
          const url = `https://api.themoviedb.org/3/movie/${encodeURIComponent(
            extId
          )}?language=pt-BR&append_to_response=credits${queryParam}`;
          const res = await fetch(url, { headers });
          if (res.ok) {
            const detail = await res.json();
            const formatted = extractDirectorAndCompanyFromTmdbDetail(detail);
            if (formatted) {
              cache[extId] = {
                directorAndCompany: formatted,
                runtime:
                  typeof detail?.runtime === 'number' && detail.runtime > 0
                    ? detail.runtime
                    : undefined,
              };
            }
          }
        } catch {
          // Ignore individual fetch errors
        }
      })
    );
  }

  if (missingIds.length > 0) {
    saveMovieCreditsCache();
  }

  return items.map((it) => {
    if (it.category !== 'movie_cinema' && it.category !== 'movie_digital') {
      return it;
    }
    const cached = cache[it.externalId];
    if (cached?.directorAndCompany) {
      return {
        ...it,
        director: cached.directorAndCompany,
        runtimeMinutes: cached.runtime || it.runtimeMinutes,
      };
    }
    return it;
  });
}

function mapTmdbRawMovieToItem(
  m: TmdbRawMovie,
  category: 'movie_cinema' | 'movie_digital',
  todayIso: string,
  overrideReleaseDate?: string | null,
  streamingPlatforms?: string[],
  directorAndCompany?: string | null
): MediaItem {
  const relDate = overrideReleaseDate || m.release_date || null;
  const genreNames = m.genres?.length
    ? m.genres.map((g) => g.name)
    : (m.genre_ids || [])
        .map((id) => TMDB_MOVIE_GENRES[id])
        .filter(Boolean)
        .slice(0, 3);

  const isDigitalAvail =
    category === 'movie_digital' && Boolean(relDate && relDate <= todayIso);

  const cleanPlatforms = (streamingPlatforms || []).filter(
    (p) => p && p !== 'Cinema BR' && p !== 'Digital BR'
  );

  const cachedCredits = getMovieCreditsCache()[String(m.id)];

  return {
    id: `tmdb-${category}-${m.id}`,
    externalId: String(m.id),
    category,
    title: m.title || m.original_title || 'Filme',
    originalTitle: m.original_title,
    posterUrl: m.poster_path
      ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
      : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80',
    backdropUrl: m.backdrop_path
      ? `https://image.tmdb.org/t/p/original${m.backdrop_path}`
      : undefined,
    synopsis:
      m.overview && m.overview.trim().length > 0
        ? m.overview
        : 'Lançamento confirmado no circuito brasileiro.',
    genres: genreNames.length > 0 ? genreNames : ['Cinema'],
    streamingPlatforms: cleanPlatforms,
    rating: m.vote_average ? Math.round(m.vote_average * 10) / 10 : undefined,
    reviewsCount:
      typeof m.vote_count === 'number' && m.vote_count > 0
        ? m.vote_count
        : m.popularity
        ? Math.round(m.popularity * 85)
        : 450,
    runtimeMinutes: cachedCredits?.runtime || m.runtime || 124,
    director:
      directorAndCompany ||
      cachedCredits?.directorAndCompany ||
      'Direção & Estúdio Oficial',
    cinemaReleaseDate: category === 'movie_cinema' ? relDate : null,
    digitalReleaseDate: category === 'movie_digital' ? relDate : null,
    isDigitalAvailable: isDigitalAvail,
  };
}

function mapTmdbRawTvToItem(
  tv: TmdbRawTv,
  airDateOverride?: string | null,
  nextEpNumber?: number | null,
  studioText?: string,
  totalEps?: number | null,
  streamingPlatforms?: string[]
): MediaItem {
  const effectiveDate = airDateOverride || tv.first_air_date || null;
  const genreNames = tv.genres?.length
    ? tv.genres.map((g) => g.name)
    : (tv.genre_ids || [])
        .map((id) => TMDB_TV_GENRES[id])
        .filter(Boolean)
        .slice(0, 3);

  const platforms =
    streamingPlatforms && streamingPlatforms.length > 0
      ? streamingPlatforms
      : ['Streaming BR'];

  return {
    id: `tmdb-tv-${tv.id}`,
    externalId: String(tv.id),
    category: 'tv',
    title: tv.name || tv.original_name || 'Série',
    originalTitle: tv.original_name,
    posterUrl: tv.poster_path
      ? `https://image.tmdb.org/t/p/w500${tv.poster_path}`
      : 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=600&q=80',
    backdropUrl: tv.backdrop_path
      ? `https://image.tmdb.org/t/p/original${tv.backdrop_path}`
      : undefined,
    synopsis:
      tv.overview && tv.overview.trim().length > 0
        ? tv.overview
        : 'Série confirmada no catálogo de streaming no Brasil.',
    genres: genreNames.length > 0 ? genreNames : ['Série'],
    streamingPlatforms: platforms,
    rating: tv.vote_average ? Math.round(tv.vote_average * 10) / 10 : undefined,
    reviewsCount:
      typeof tv.vote_count === 'number' && tv.vote_count > 0
        ? tv.vote_count
        : tv.popularity
        ? Math.round(tv.popularity * 95)
        : 520,
    studioOrNetwork:
      studioText || `Original / Catálogo Brasil • ${platforms.join(' / ')}`,
    seasonStatus: 'Catálogo Oficial Brasil',
    nextEpisodeNumber: nextEpNumber ?? 1,
    nextEpisodeDate: effectiveDate,
    totalEpisodes: totalEps || null,
    episodeDurationMinutes: 48,
  };
}

function deduplicateByExternalId(items: MediaItem[]): MediaItem[] {
  const map = new Map<string, MediaItem>();
  for (const item of items) {
    if (!item.externalId) continue;
    const existing = map.get(item.externalId);
    if (!existing) {
      map.set(item.externalId, item);
    } else if (item.streamingPlatforms && item.streamingPlatforms.length > 0) {
      const mergedPlatforms = Array.from(
        new Set([
          ...(existing.streamingPlatforms || []),
          ...item.streamingPlatforms,
        ])
      ).filter((p) => p && p !== 'Cinema BR' && p !== 'Digital BR');
      existing.streamingPlatforms = mergedPlatforms;
      if (existing.category === 'tv' && mergedPlatforms.length > 0) {
        existing.studioOrNetwork = `Catálogo Brasil • ${mergedPlatforms.join(' / ')}`;
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Busca Filmes (Cinema e Digital/Streaming) disponíveis EXCLUSIVAMENTE no Brasil (region=BR e watch_region=BR)
 * e adiciona tags do streaming onde está disponível (Netflix, Amazon Prime, HBO Max, Globoplay, Disney+, Telecine, Cinema BR).
 */
export async function fetchTmdbMovies(
  settings: AppSettings,
  pastPagesCount = 2
): Promise<{
  cinema: MediaItem[];
  digital: MediaItem[];
  isLive: boolean;
}> {
  const fallback = getCuratedFallbackData();
  const apiKey = (settings.tmdbApiKey || DEFAULT_TMDB_API_KEY).trim();
  if (!apiKey) {
    return {
      cinema: fallback.movie_cinema,
      digital: fallback.movie_digital,
      isLive: false,
    };
  }

  try {
    const { headers, queryParam } = buildTmdbHeadersAndParam(apiKey);
    const todayIso = getLocalIsoDate(0);
    const yesterdayIso = getLocalIsoDate(-1);
    const futureLimitIso = getLocalIsoDate(365);
    const pastPageNums = Array.from({ length: pastPagesCount }, (_, i) => i + 1);

    // 1. FILMES NOS CINEMAS DO BRASIL (Projeção completa de 1 ano: hoje até +365 dias)
    const cinemaUpcomingUrls = [
      ...[1, 2, 3, 4].map(
        (page) =>
          `https://api.themoviedb.org/3/discover/movie?language=pt-BR&region=BR&with_release_type=3|2&release_date.gte=${todayIso}&release_date.lte=${futureLimitIso}&sort_by=release_date.asc&page=${page}${queryParam}`
      ),
      ...[1, 2, 3].map(
        (page) =>
          `https://api.themoviedb.org/3/discover/movie?language=pt-BR&region=BR&with_release_type=3|2&release_date.gte=${todayIso}&release_date.lte=${futureLimitIso}&sort_by=popularity.desc&page=${page}${queryParam}`
      ),
    ];

    const cinemaPastUrls = pastPageNums.map(
      (page) =>
        `https://api.themoviedb.org/3/discover/movie?language=pt-BR&region=BR&with_release_type=3|2&release_date.lte=${yesterdayIso}&sort_by=release_date.desc&vote_count.gte=20&page=${page}${queryParam}`
    );

    // 2. FILMES NOS STREAMINGS DO BRASIL (Netflix, Amazon Prime, HBO Max, Globoplay, Disney+, Telecine — Projeção de 1 ano)
    // Buscamos por plataforma em watch_region=BR para saber exatamente a tag do streaming de cada filme!
    const fetchMoviesForPlatform = async (
      platform: BrStreamingConfig
    ): Promise<{ past: MediaItem[]; upcoming: MediaItem[] }> => {
      const upUrls = [
        `https://api.themoviedb.org/3/discover/movie?language=pt-BR&region=BR&watch_region=BR&with_watch_providers=${platform.providerIds}&release_date.gte=${todayIso}&release_date.lte=${futureLimitIso}&sort_by=release_date.asc&page=1${queryParam}`,
        `https://api.themoviedb.org/3/discover/movie?language=pt-BR&region=BR&watch_region=BR&with_watch_providers=${platform.providerIds}&release_date.gte=${todayIso}&release_date.lte=${futureLimitIso}&sort_by=popularity.desc&page=1${queryParam}`,
      ];
      const pastUrlsForPlat = pastPageNums
        .slice(0, 2)
        .map(
          (page) =>
            `https://api.themoviedb.org/3/discover/movie?language=pt-BR&region=BR&watch_region=BR&with_watch_providers=${platform.providerIds}&release_date.lte=${yesterdayIso}&sort_by=release_date.desc&vote_count.gte=15&page=${page}${queryParam}`
        );

      const [upRes1, upRes2, ...pastResponses] = await Promise.all([
        fetch(upUrls[0], { headers }).catch(() => null),
        fetch(upUrls[1], { headers }).catch(() => null),
        ...pastUrlsForPlat.map((u) => fetch(u, { headers }).catch(() => null)),
      ]);

      const upMovies: MediaItem[] = [];
      for (const upRes of [upRes1, upRes2]) {
        if (upRes && upRes.ok) {
          const d = await upRes.json();
          for (const m of (d?.results || []) as TmdbRawMovie[]) {
            if (
              m?.id &&
              m.poster_path &&
              m.release_date &&
              m.release_date >= todayIso &&
              m.release_date <= futureLimitIso
            ) {
              upMovies.push(
                mapTmdbRawMovieToItem(
                  m,
                  'movie_digital',
                  todayIso,
                  m.release_date,
                  [platform.label]
                )
              );
            }
          }
        }
      }

      const pastMovies: MediaItem[] = [];
      for (const r of pastResponses) {
        if (r && r.ok) {
          const d = await r.json();
          for (const m of (d?.results || []) as TmdbRawMovie[]) {
            if (m?.id && m.poster_path && m.release_date) {
              pastMovies.push(
                mapTmdbRawMovieToItem(
                  m,
                  'movie_digital',
                  todayIso,
                  m.release_date,
                  [platform.label]
                )
              );
            }
          }
        }
      }

      return { past: pastMovies, upcoming: upMovies };
    };

    // Também busca lançamentos futuros em VOD/Digital no Brasil (Tipo 4/6 em region=BR)
    const vodUpcomingUrl = `https://api.themoviedb.org/3/discover/movie?language=pt-BR&region=BR&with_release_type=4|6&release_date.gte=${todayIso}&release_date.lte=${futureLimitIso}&sort_by=release_date.asc&vote_count.gte=5&page=1${queryParam}`;

    const fetchPageList = async (urls: string[]): Promise<TmdbRawMovie[]> => {
      const responses = await Promise.all(
        urls.map((u) => fetch(u, { headers }).catch(() => null))
      );
      const all: TmdbRawMovie[] = [];
      for (const r of responses) {
        if (r && r.ok) {
          const data = await r.json();
          if (Array.isArray(data?.results)) {
            all.push(...data.results);
          }
        }
      }
      // Filtra apenas filmes que tenham título, capa, data e sinopse ou relevância no Brasil
      return all.filter(
        (m) =>
          m &&
          m.id &&
          m.poster_path &&
          m.release_date &&
          Boolean(
            (m.overview && m.overview.trim().length > 0) ||
              (m.popularity && m.popularity >= 8)
          )
      );
    };

    const [cinemaUpcomingRaw, cinemaPastRaw, vodUpcomingRaw, ...platformResults] =
      await Promise.all([
        fetchPageList(cinemaUpcomingUrls),
        fetchPageList(cinemaPastUrls),
        fetchPageList([vodUpcomingUrl]),
        ...BR_STREAMING_PLATFORMS.map(fetchMoviesForPlatform),
      ]);

    // Cria mapas de datas distintas de Cinema e de Streaming/Digital para cruzar sem repetir a mesma data
    const movieStreamingMap = new Map<string, string[]>();
    const digitalReleaseDateMap = new Map<string, string>();
    for (const pRes of platformResults) {
      for (const item of [...pRes.past, ...pRes.upcoming]) {
        const existing = movieStreamingMap.get(item.externalId) || [];
        movieStreamingMap.set(
          item.externalId,
          Array.from(new Set([...existing, ...(item.streamingPlatforms || [])]))
        );
        if (item.digitalReleaseDate && !digitalReleaseDateMap.has(item.externalId)) {
          digitalReleaseDateMap.set(item.externalId, item.digitalReleaseDate);
        }
      }
    }
    for (const m of vodUpcomingRaw) {
      if (m.id && m.release_date) {
        digitalReleaseDateMap.set(String(m.id), m.release_date);
      }
    }

    const cinemaReleaseDateMap = new Map<string, string>();
    for (const m of [...cinemaPastRaw, ...cinemaUpcomingRaw]) {
      if (m.id && m.release_date) {
        cinemaReleaseDateMap.set(String(m.id), m.release_date);
      }
    }

    const rawCinemaItems = deduplicateByExternalId([
      ...cinemaPastRaw.map((m) => {
        const extId = String(m.id);
        const streamTags = movieStreamingMap.get(extId) || [];
        const item = mapTmdbRawMovieToItem(
          m,
          'movie_cinema',
          todayIso,
          m.release_date,
          streamTags
        );
        const digDate = digitalReleaseDateMap.get(extId);
        if (digDate && digDate !== m.release_date) {
          item.digitalReleaseDate = digDate;
          item.isDigitalAvailable = digDate <= todayIso;
        }
        return item;
      }),
      ...cinemaUpcomingRaw.map((m) => {
        const extId = String(m.id);
        const streamTags = movieStreamingMap.get(extId) || [];
        const item = mapTmdbRawMovieToItem(
          m,
          'movie_cinema',
          todayIso,
          m.release_date,
          streamTags
        );
        const digDate = digitalReleaseDateMap.get(extId);
        if (digDate && digDate !== m.release_date) {
          item.digitalReleaseDate = digDate;
        }
        return item;
      }),
    ]);

    const rawDigitalMerged = [
      ...platformResults.flatMap((p) => p.past),
      ...platformResults.flatMap((p) => p.upcoming),
      ...vodUpcomingRaw.map((m) =>
        mapTmdbRawMovieToItem(m, 'movie_digital', todayIso, m.release_date, [])
      ),
    ].map((item) => {
      const cinDate = cinemaReleaseDateMap.get(item.externalId);
      // Só preenche cinemaReleaseDate se existir uma data de cinema real E diferente da data digital!
      if (cinDate && cinDate !== item.digitalReleaseDate) {
        return { ...item, cinemaReleaseDate: cinDate };
      }
      return { ...item, cinemaReleaseDate: null };
    });

    const rawDigitalItems = deduplicateByExternalId(rawDigitalMerged);

    const [cinemaItems, digitalItems] = await Promise.all([
      enrichMoviesWithDirectorAndCompany(rawCinemaItems, headers, queryParam),
      enrichMoviesWithDirectorAndCompany(rawDigitalItems, headers, queryParam),
    ]);

    return {
      cinema: cinemaItems.length > 0 ? cinemaItems : fallback.movie_cinema,
      digital: digitalItems.length > 0 ? digitalItems : fallback.movie_digital,
      isLive: cinemaItems.length > 0 || digitalItems.length > 0,
    };
  } catch {
    return {
      cinema: fallback.movie_cinema,
      digital: fallback.movie_digital,
      isLive: false,
    };
  }
}

/**
 * Busca Séries da TMDB EXCLUSIVAMENTE da Netflix, Amazon Prime, HBO Max, Globoplay, Disney+ e Telecine no Brasil!
 * Inclui automaticamente a tag de qual streaming a série pertence.
 */
export async function fetchTmdbSeries(
  settings: AppSettings,
  pastPagesCount = 2
): Promise<{
  items: MediaItem[];
  isLive: boolean;
}> {
  const fallback = getCuratedFallbackData().tv;
  const apiKey = (settings.tmdbApiKey || DEFAULT_TMDB_API_KEY).trim();
  if (!apiKey) {
    return { items: fallback, isLive: false };
  }

  try {
    const { headers, queryParam } = buildTmdbHeadersAndParam(apiKey);
    const todayIso = getLocalIsoDate(0);
    const yesterdayIso = getLocalIsoDate(-1);
    const futureLimitIso = getLocalIsoDate(365);

    const fetchSeriesForPlatform = async (
      platform: BrStreamingConfig
    ): Promise<MediaItem[]> => {
      const urls: string[] = [
        // 1. Próximas estreias no streaming no Brasil (watch_region=BR, projeção de 1 ano)
        `https://api.themoviedb.org/3/discover/tv?language=pt-BR&watch_region=BR&with_watch_providers=${platform.providerIds}&first_air_date.gte=${todayIso}&first_air_date.lte=${futureLimitIso}&sort_by=first_air_date.asc&page=1${queryParam}`,
        `https://api.themoviedb.org/3/discover/tv?language=pt-BR&watch_region=BR&with_watch_providers=${platform.providerIds}&first_air_date.gte=${todayIso}&first_air_date.lte=${futureLimitIso}&sort_by=popularity.desc&page=1${queryParam}`,
        // 2. Séries já lançadas recentemente no streaming no Brasil (<= ontem)
        `https://api.themoviedb.org/3/discover/tv?language=pt-BR&watch_region=BR&with_watch_providers=${platform.providerIds}&first_air_date.lte=${yesterdayIso}&sort_by=first_air_date.desc&vote_count.gte=5&page=1${queryParam}`,
      ];

      if (pastPagesCount > 2) {
        urls.push(
          `https://api.themoviedb.org/3/discover/tv?language=pt-BR&watch_region=BR&with_watch_providers=${platform.providerIds}&first_air_date.lte=${yesterdayIso}&sort_by=first_air_date.desc&vote_count.gte=5&page=2${queryParam}`
        );
      }

      // 3. Inclui também séries originais da rede (Netflix, Prime, HBO Max, Globoplay, Disney+) que estreiam nos próximos 12 meses
      if (platform.networkIds) {
        urls.push(
          `https://api.themoviedb.org/3/discover/tv?language=pt-BR&with_networks=${platform.networkIds}&first_air_date.gte=${todayIso}&first_air_date.lte=${futureLimitIso}&sort_by=first_air_date.asc&page=1${queryParam}`,
          `https://api.themoviedb.org/3/discover/tv?language=pt-BR&with_networks=${platform.networkIds}&first_air_date.gte=${todayIso}&first_air_date.lte=${futureLimitIso}&sort_by=popularity.desc&page=1${queryParam}`,
          `https://api.themoviedb.org/3/discover/tv?language=pt-BR&with_networks=${platform.networkIds}&first_air_date.lte=${yesterdayIso}&sort_by=first_air_date.desc&vote_count.gte=5&page=1${queryParam}`
        );
      }

      const responses = await Promise.all(
        urls.map((u) => fetch(u, { headers }).catch(() => null))
      );

      const items: MediaItem[] = [];
      for (const r of responses) {
        if (r && r.ok) {
          const data = await r.json();
          for (const tv of (data?.results || []) as TmdbRawTv[]) {
            if (tv && tv.id && tv.poster_path && tv.first_air_date) {
              items.push(
                mapTmdbRawTvToItem(
                  tv,
                  tv.first_air_date,
                  1,
                  `Catálogo Brasil • ${platform.label}`,
                  null,
                  [platform.label]
                )
              );
            }
          }
        }
      }
      return items;
    };

    const perPlatformLists = await Promise.all(
      BR_STREAMING_PLATFORMS.map(fetchSeriesForPlatform)
    );

    const seriesItems = deduplicateByExternalId(perPlatformLists.flat());

    return {
      items: seriesItems.length > 0 ? seriesItems : fallback,
      isLive: seriesItems.length > 0,
    };
  } catch {
    return { items: fallback, isLive: false };
  }
}

/**
 * Busca Animes da AniList GraphQL separando episódios/animes futuros (>= hoje até +1 ano) e já lançados (< hoje)
 */
export async function fetchAniListAnimes(pastPagesCount = 2): Promise<{
  items: MediaItem[];
  isLive: boolean;
}> {
  const fallback = getCuratedFallbackData().anime;
  const now = new Date();
  const todayStartUnix = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime() / 1000
  );
  const oneYearUnix = todayStartUnix + 365 * 86400;

  // Formato FuzzyDateInt da AniList: YYYYMMDD (ex: 20261114 até 20271114)
  const todayFuzzy =
    now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const oneYearDate = new Date(
    now.getFullYear() + 1,
    now.getMonth(),
    now.getDate()
  );
  const oneYearFuzzy =
    oneYearDate.getFullYear() * 10000 +
    (oneYearDate.getMonth() + 1) * 100 +
    oneYearDate.getDate();

  const query = `
    query ($todayStart: Int, $oneYearEnd: Int, $todayFuzzy: FuzzyDateInt, $oneYearFuzzy: FuzzyDateInt, $pastPerPage: Int) {
      upcomingSchedules: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $todayStart, airingAt_lesser: $oneYearEnd, sort: [TIME]) {
          episode
          airingAt
          media {
            id
            type
            isAdult
            title { romaji english native }
            coverImage { extraLarge large }
            bannerImage
            description(asHtml: false)
            genres
            averageScore
            popularity
            trending
            status
            episodes
            duration
            studios(isMain: true) { nodes { name } }
          }
        }
      }
      futurePopular: Page(page: 1, perPage: 50) {
        media(type: ANIME, isAdult: false, startDate_greater: $todayFuzzy, startDate_lesser: $oneYearFuzzy, sort: [POPULARITY_DESC]) {
          id
          type
          isAdult
          title { romaji english native }
          coverImage { extraLarge large }
          bannerImage
          description(asHtml: false)
          genres
          averageScore
          popularity
          trending
          status
          episodes
          duration
          startDate { year month day }
          nextAiringEpisode { episode airingAt }
          studios(isMain: true) { nodes { name } }
        }
      }
      futureChrono1: Page(page: 1, perPage: 50) {
        media(type: ANIME, isAdult: false, startDate_greater: $todayFuzzy, startDate_lesser: $oneYearFuzzy, sort: [START_DATE, POPULARITY_DESC]) {
          id
          type
          isAdult
          title { romaji english native }
          coverImage { extraLarge large }
          bannerImage
          description(asHtml: false)
          genres
          averageScore
          popularity
          trending
          status
          episodes
          duration
          startDate { year month day }
          nextAiringEpisode { episode airingAt }
          studios(isMain: true) { nodes { name } }
        }
      }
      futureChrono2: Page(page: 2, perPage: 50) {
        media(type: ANIME, isAdult: false, startDate_greater: $todayFuzzy, startDate_lesser: $oneYearFuzzy, sort: [START_DATE, POPULARITY_DESC]) {
          id
          type
          isAdult
          title { romaji english native }
          coverImage { extraLarge large }
          bannerImage
          description(asHtml: false)
          genres
          averageScore
          popularity
          trending
          status
          episodes
          duration
          startDate { year month day }
          nextAiringEpisode { episode airingAt }
          studios(isMain: true) { nodes { name } }
        }
      }
      pastSchedules: Page(page: 1, perPage: $pastPerPage) {
        airingSchedules(airingAt_lesser: $todayStart, sort: [TIME_DESC]) {
          episode
          airingAt
          media {
            id
            type
            isAdult
            title { romaji english native }
            coverImage { extraLarge large }
            bannerImage
            description(asHtml: false)
            genres
            averageScore
            popularity
            trending
            status
            episodes
            duration
            studios(isMain: true) { nodes { name } }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          todayStart: todayStartUnix,
          oneYearEnd: oneYearUnix,
          todayFuzzy,
          oneYearFuzzy,
          pastPerPage: Math.min(50, pastPagesCount * 20),
        },
      }),
    });

    if (!response.ok) {
      return { items: fallback, isLive: false };
    }

    const result = await response.json();
    const upcomingScheds = result?.data?.upcomingSchedules?.airingSchedules || [];
    const futurePopularList = result?.data?.futurePopular?.media || [];
    const futureChrono1List = result?.data?.futureChrono1?.media || [];
    const futureChrono2List = result?.data?.futureChrono2?.media || [];
    const pastScheds = result?.data?.pastSchedules?.airingSchedules || [];

    const mapScheduleToItem = (sched: {
      episode: number;
      airingAt: number;
      media?: {
        id: number;
        type?: string;
        isAdult?: boolean;
        title?: { english?: string; romaji?: string; native?: string };
        coverImage?: { extraLarge?: string; large?: string };
        bannerImage?: string;
        description?: string;
        genres?: string[];
        averageScore?: number;
        popularity?: number;
        trending?: number;
        status?: string;
        episodes?: number;
        duration?: number;
        studios?: { nodes?: Array<{ name: string }> };
      };
    }): MediaItem | null => {
      const anime = sched?.media;
      if (!anime || anime.type !== 'ANIME' || anime.isAdult) return null;

      const cleanSynopsis = (anime.description || '')
        .replace(/<[^>]*>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      const airingIso = new Date(sched.airingAt * 1000).toISOString();
      const studioName =
        anime.studios?.nodes?.[0]?.name || 'Estúdio de Animação Japonês';

      return {
        id: `anilist-anime-${anime.id}-ep-${sched.episode}`,
        externalId: String(anime.id),
        category: 'anime' as MediaCategory,
        title: anime.title?.english || anime.title?.romaji || 'Anime',
        originalTitle: anime.title?.native || anime.title?.romaji,
        posterUrl: anime.coverImage?.extraLarge || anime.coverImage?.large || '',
        backdropUrl: anime.bannerImage || undefined,
        synopsis:
          cleanSynopsis ||
          'Acompanhe a exibição deste anime no cronograma da temporada.',
        genres: anime.genres?.slice(0, 4) || ['Anime'],
        rating: anime.averageScore
          ? Math.round((anime.averageScore / 10) * 10) / 10
          : undefined,
        reviewsCount:
          anime.popularity || (anime.trending ? anime.trending * 450 : 5200),
        studioOrNetwork: `Estúdio ${studioName}`,
        seasonStatus:
          sched.airingAt * 1000 >= Date.now()
            ? 'Temporada Atual • Simulcast'
            : 'Episódio Lançado',
        nextEpisodeNumber: sched.episode ?? 1,
        nextEpisodeDate: airingIso,
        totalEpisodes: anime.episodes || 12,
        episodeDurationMinutes: anime.duration || 24,
      };
    };

    const mapFutureMediaToItem = (anime: {
      id: number;
      type?: string;
      isAdult?: boolean;
      title?: { english?: string; romaji?: string; native?: string };
      coverImage?: { extraLarge?: string; large?: string };
      bannerImage?: string;
      description?: string;
      genres?: string[];
      averageScore?: number;
      popularity?: number;
      trending?: number;
      status?: string;
      episodes?: number;
      duration?: number;
      startDate?: { year?: number; month?: number; day?: number };
      nextAiringEpisode?: { episode?: number; airingAt?: number };
      studios?: { nodes?: Array<{ name: string }> };
    }): MediaItem | null => {
      if (!anime || anime.type !== 'ANIME' || anime.isAdult) return null;

      let airingIso: string | null = null;
      let epNum = 1;

      if (anime.nextAiringEpisode?.airingAt) {
        airingIso = new Date(anime.nextAiringEpisode.airingAt * 1000).toISOString();
        epNum = anime.nextAiringEpisode.episode || 1;
      } else if (anime.startDate?.year && anime.startDate?.month) {
        const y = anime.startDate.year;
        const m = String(anime.startDate.month).padStart(2, '0');
        const d = String(anime.startDate.day || 1).padStart(2, '0');
        airingIso = `${y}-${m}-${d}T18:00:00`;
      } else {
        return null;
      }

      const cleanSynopsis = (anime.description || '')
        .replace(/<[^>]*>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      const studioName =
        anime.studios?.nodes?.[0]?.name || 'Estúdio de Animação Japonês';

      return {
        id: `anilist-future-${anime.id}`,
        externalId: String(anime.id),
        category: 'anime' as MediaCategory,
        title: anime.title?.english || anime.title?.romaji || 'Anime',
        originalTitle: anime.title?.native || anime.title?.romaji,
        posterUrl: anime.coverImage?.extraLarge || anime.coverImage?.large || '',
        backdropUrl: anime.bannerImage || undefined,
        synopsis:
          cleanSynopsis ||
          'Nova temporada / estreia de anime confirmada no calendário oficial.',
        genres: anime.genres?.slice(0, 4) || ['Anime'],
        rating: anime.averageScore
          ? Math.round((anime.averageScore / 10) * 10) / 10
          : undefined,
        reviewsCount:
          anime.popularity || (anime.trending ? anime.trending * 450 : 3500),
        studioOrNetwork: `Estúdio ${studioName}`,
        seasonStatus: anime.startDate?.day
          ? 'Nova Estreia Confirmada'
          : `Estreia Prevista (${String(anime.startDate?.month).padStart(2, '0')}/${anime.startDate?.year})`,
        nextEpisodeNumber: epNum,
        nextEpisodeDate: airingIso,
        totalEpisodes: anime.episodes || 12,
        episodeDurationMinutes: anime.duration || 24,
      };
    };

    const mappedPast = deduplicateByExternalId(
      pastScheds
        .map(mapScheduleToItem)
        .filter((x: MediaItem | null): x is MediaItem => Boolean(x))
    );

    const mappedUpcoming = deduplicateByExternalId([
      ...upcomingScheds
        .map(mapScheduleToItem)
        .filter((x: MediaItem | null): x is MediaItem => Boolean(x)),
      ...[...futurePopularList, ...futureChrono1List, ...futureChrono2List]
        .map(mapFutureMediaToItem)
        .filter((x: MediaItem | null): x is MediaItem => Boolean(x)),
    ]);

    // Mantém tanto os episódios passados (para o botão "Ver mídias lançadas anteriormente")
    // quanto os próximos episódios e estreias futuras de 1 ano (priorizando os futuros na deduplicação)
    const upcomingIds = new Set(mappedUpcoming.map((it) => it.externalId));
    const uniquePast = mappedPast.filter((it) => !upcomingIds.has(it.externalId));

    const combined = [...uniquePast, ...mappedUpcoming];
    if (combined.length === 0) {
      return { items: fallback, isLive: false };
    }

    return {
      items: combined,
      isLive: true,
    };
  } catch {
    return { items: fallback, isLive: false };
  }
}

/**
 * Busca mídias lançadas em uma data específica (ou intervalo de datas) selecionada no Calendário!
 */
export async function fetchMediaByCalendarDate(
  settings: AppSettings,
  startDateIso: string,
  endDateIso: string
): Promise<MediaItem[]> {
  const apiKey = (settings.tmdbApiKey || DEFAULT_TMDB_API_KEY).trim();
  const { headers, queryParam } = buildTmdbHeadersAndParam(apiKey);
  const todayIso = getLocalIsoDate(0);

  const startUnix = Math.floor(new Date(`${startDateIso}T00:00:00`).getTime() / 1000);
  const endUnix = Math.floor(new Date(`${endDateIso}T23:59:59`).getTime() / 1000);

  const cinemaUrl = `https://api.themoviedb.org/3/discover/movie?language=pt-BR&region=BR&with_release_type=3|2&release_date.gte=${startDateIso}&release_date.lte=${endDateIso}&sort_by=popularity.desc&page=1${queryParam}`;
  const digitalUrl = `https://api.themoviedb.org/3/discover/movie?language=pt-BR&region=BR&watch_region=BR&with_watch_providers=${ALL_BR_PROVIDER_IDS}&release_date.gte=${startDateIso}&release_date.lte=${endDateIso}&sort_by=popularity.desc&page=1${queryParam}`;

  const aniQuery = `
    query ($start: Int, $end: Int) {
      Page(page: 1, perPage: 25) {
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: [TIME]) {
          episode
          airingAt
          media {
            id
            type
            isAdult
            title { romaji english native }
            coverImage { extraLarge large }
            bannerImage
            description(asHtml: false)
            genres
            averageScore
            popularity
            episodes
            duration
            studios(isMain: true) { nodes { name } }
          }
        }
      }
    }
  `;

  try {
    const [cinemaRes, digitalRes, aniRes, ...tvPlatformResults] = await Promise.all([
      fetch(cinemaUrl, { headers }).catch(() => null),
      fetch(digitalUrl, { headers }).catch(() => null),
      fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: aniQuery,
          variables: { start: startUnix - 1, end: endUnix + 1 },
        }),
      }).catch(() => null),
      ...BR_STREAMING_PLATFORMS.map(async (plat) => {
        const platTvUrl = `https://api.themoviedb.org/3/discover/tv?language=pt-BR&watch_region=BR&with_watch_providers=${plat.providerIds}&first_air_date.gte=${startDateIso}&first_air_date.lte=${endDateIso}&sort_by=popularity.desc&page=1${queryParam}`;
        const netTvUrl = plat.networkIds
          ? `https://api.themoviedb.org/3/discover/tv?language=pt-BR&with_networks=${plat.networkIds}&first_air_date.gte=${startDateIso}&first_air_date.lte=${endDateIso}&sort_by=popularity.desc&page=1${queryParam}`
          : null;
        const [r1, r2] = await Promise.all([
          fetch(platTvUrl, { headers }).catch(() => null),
          netTvUrl ? fetch(netTvUrl, { headers }).catch(() => null) : Promise.resolve(null),
        ]);
        const list: MediaItem[] = [];
        for (const r of [r1, r2]) {
          if (r && r.ok) {
            const d = await r.json();
            for (const tv of (d?.results || []) as TmdbRawTv[]) {
              if (tv?.id && tv.poster_path) {
                list.push(
                  mapTmdbRawTvToItem(
                    tv,
                    tv.first_air_date || startDateIso,
                    1,
                    `Catálogo Brasil • ${plat.label}`,
                    null,
                    [plat.label]
                  )
                );
              }
            }
          }
        }
        return list;
      }),
    ]);

    const results: MediaItem[] = [];

    if (cinemaRes && cinemaRes.ok) {
      const data = await cinemaRes.json();
      for (const m of data?.results || []) {
        if (m?.id && m.poster_path) {
          results.push(
            mapTmdbRawMovieToItem(
              m,
              'movie_cinema',
              todayIso,
              m.release_date || startDateIso,
              []
            )
          );
        }
      }
    }

    if (digitalRes && digitalRes.ok) {
      const data = await digitalRes.json();
      for (const m of data?.results || []) {
        if (m?.id && m.poster_path) {
          results.push(
            mapTmdbRawMovieToItem(
              m,
              'movie_digital',
              todayIso,
              m.release_date || startDateIso,
              []
            )
          );
        }
      }
    }

    for (const tvList of tvPlatformResults) {
      results.push(...tvList);
    }

    if (aniRes && aniRes.ok) {
      const aniData = await aniRes.json();
      const schedules = aniData?.data?.Page?.airingSchedules || [];
      for (const sched of schedules) {
        const anime = sched?.media;
        if (!anime || anime.type !== 'ANIME' || anime.isAdult) continue;
        const cleanSynopsis = (anime.description || '')
          .replace(/<[^>]*>/g, '')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();
        results.push({
          id: `anilist-cal-${anime.id}-${sched.episode}`,
          externalId: String(anime.id),
          category: 'anime',
          title: anime.title?.english || anime.title?.romaji || 'Anime',
          originalTitle: anime.title?.native || anime.title?.romaji,
          posterUrl: anime.coverImage?.extraLarge || anime.coverImage?.large || '',
          backdropUrl: anime.bannerImage || undefined,
          synopsis:
            cleanSynopsis || 'Episódio exibido na data selecionada no calendário.',
          genres: anime.genres?.slice(0, 4) || ['Anime'],
          rating: anime.averageScore
            ? Math.round((anime.averageScore / 10) * 10) / 10
            : undefined,
          reviewsCount: anime.popularity || 4200,
          studioOrNetwork: `Estúdio ${
            anime.studios?.nodes?.[0]?.name || 'Animação Japonesa'
          }`,
          seasonStatus: 'Exibição na Data Selecionada',
          nextEpisodeNumber: sched.episode ?? 1,
          nextEpisodeDate: new Date(sched.airingAt * 1000).toISOString(),
          totalEpisodes: anime.episodes || 12,
          episodeDurationMinutes: anime.duration || 24,
        });
      }
    }

    // Inclui também qualquer jogo da Twitch / IGDB na data selecionada no calendário
    try {
      const calGames = await fetchIgdbGamesByDateRange(settings, startUnix, endUnix);
      results.push(...calGames);
    } catch {
      // Ignore IGDB calendar error
    }

    // Deduplica por categoria + externalId e mescla tags de streaming
    const seenMap = new Map<string, MediaItem>();
    for (const it of results) {
      const k = `${it.category}::${it.externalId}`;
      const existing = seenMap.get(k);
      if (!existing) {
        seenMap.set(k, it);
      } else if (it.streamingPlatforms && it.streamingPlatforms.length > 0) {
        existing.streamingPlatforms = Array.from(
          new Set([...(existing.streamingPlatforms || []), ...it.streamingPlatforms])
        );
      }
    }
    const dedupedList = Array.from(seenMap.values());
    return await enrichMoviesWithDirectorAndCompany(dedupedList, headers, queryParam);
  } catch {
    return [];
  }
}

// ============================================================================
// INTEGRAÇÃO OFICIAL TWITCH / IGDB API v4 (GAMES + GAME TIME TO BEATS)
// ============================================================================

let cachedTwitchToken: string | null = null;
let cachedTwitchTokenExpiry = 0;
let cachedIgdbStaticList: MediaItem[] | null = null;

interface IgdbRawGame {
  id: number;
  name: string;
  summary?: string;
  storyline?: string;
  first_release_date?: number;
  total_rating?: number;
  rating?: number;
  total_rating_count?: number;
  hypes?: number;
  follows?: number;
  cover?: { id?: number; image_id?: string };
  screenshots?: Array<{ id?: number; image_id?: string }>;
  genres?: Array<{ id?: number; name: string }>;
  platforms?: Array<{ id?: number; name: string; abbreviation?: string }>;
  involved_companies?: Array<{
    developer?: boolean;
    publisher?: boolean;
    company?: { name: string };
  }>;
}

interface IgdbTimeToBeat {
  game_id: number;
  hastily?: number;
  normally?: number;
  completely?: number;
}

async function getTwitchAccessToken(settings: AppSettings): Promise<{
  clientId: string;
  accessToken: string;
} | null> {
  const clientId = (settings.twitchClientId || DEFAULT_TWITCH_CLIENT_ID).trim();
  const clientSecret = (
    settings.twitchClientSecret || DEFAULT_TWITCH_CLIENT_SECRET
  ).trim();

  if (!clientId || !clientSecret) return null;

  if (cachedTwitchToken && Date.now() < cachedTwitchTokenExpiry) {
    return { clientId, accessToken: cachedTwitchToken };
  }

  try {
    const tokenUrl = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(
      clientId
    )}&client_secret=${encodeURIComponent(
      clientSecret
    )}&grant_type=client_credentials`;

    const res = await fetch(tokenUrl, { method: 'POST' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.access_token) {
      cachedTwitchToken = data.access_token;
      cachedTwitchTokenExpiry =
        Date.now() + Math.max(60, (data.expires_in || 3600) - 120) * 1000;
      return { clientId, accessToken: data.access_token };
    }
  } catch {
    // Fallback
  }
  return null;
}

/**
 * Executa uma query Apicalypse no endpoint IGDB v4 (usando proxy CORS para navegadores em produção)
 */
async function postIgdbEndpoint<T>(
  endpoint: string,
  bodyQuery: string,
  clientId: string,
  accessToken: string
): Promise<T[] | null> {
  const targetUrl = `https://api.igdb.com/v4/${endpoint}`;
  const urlsToTry = [
    `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?${targetUrl}`,
    targetUrl,
  ];

  const headers: Record<string, string> = {
    'Client-ID': clientId,
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'text/plain',
  };

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: bodyQuery,
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          return json as T[];
        }
      }
    } catch {
      // Tenta o próximo relay
    }
  }

  return null;
}

function unixToIsoDate(unixSeconds?: number): string | null {
  if (!unixSeconds || typeof unixSeconds !== 'number') return null;
  const d = new Date(unixSeconds * 1000);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const IGDB_GENRE_PT: Record<string, string> = {
  'Role-playing (RPG)': 'RPG',
  Adventure: 'Aventura',
  Shooter: 'Tiro / Shooter',
  Fighting: 'Luta',
  Platform: 'Plataforma',
  Puzzle: 'Puzzle',
  Racing: 'Corrida',
  'Real Time Strategy (RTS)': 'Estratégia (RTS)',
  Simulator: 'Simulador',
  Sport: 'Esporte',
  Strategy: 'Estratégia',
  'Turn-based strategy (TBS)': 'Estratégia por Turnos',
  Tactical: 'Tático',
  'Hack and slash/Beat \'em up': 'Hack and Slash',
  Indie: 'Indie',
  Arcade: 'Arcade',
  'Card & Board Game': 'Cartas & Tabuleiro',
  MOBA: 'MOBA',
  'Point-and-click': 'Point-and-Click',
  Music: 'Música',
  'Visual Novel': 'Visual Novel',
};

function mapIgdbGameToMediaItem(
  g: IgdbRawGame,
  ttbMap?: Map<number, IgdbTimeToBeat>
): MediaItem {
  const coverImageId = g.cover?.image_id;
  const posterUrl = coverImageId
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${coverImageId}.jpg`
    : 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=85';

  const screenImageId = g.screenshots?.[0]?.image_id;
  const backdropUrl = screenImageId
    ? `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${screenImageId}.jpg`
    : coverImageId
    ? `https://images.igdb.com/igdb/image/upload/t_720p/${coverImageId}.jpg`
    : undefined;

  const devEntry =
    g.involved_companies?.find((ic) => ic.developer && ic.company?.name) ||
    g.involved_companies?.find((ic) => ic.company?.name);
  const developer = devEntry?.company?.name || 'Estúdio Oficial (IGDB)';

  const platforms = (g.platforms || [])
    .map((p) => p.abbreviation || p.name)
    .filter(Boolean)
    .slice(0, 5);

  const genres = (g.genres || [])
    .map((gen) => IGDB_GENRE_PT[gen.name] || gen.name)
    .slice(0, 4);

  const rawRating = g.total_rating ?? g.rating;
  const rating =
    typeof rawRating === 'number' && rawRating > 0
      ? Math.round((rawRating / 10) * 10) / 10
      : undefined;

  const reviewsCount =
    (g.total_rating_count || 0) * 25 +
    (g.hypes || 0) * 180 +
    (g.follows || 0) * 90 +
    1800;

  const ttb = ttbMap?.get(g.id);
  const mainHours =
    ttb?.normally && ttb.normally > 0
      ? Math.max(1, Math.round(ttb.normally / 3600))
      : null;
  const extraHours =
    ttb?.normally && ttb?.completely
      ? Math.max(1, Math.round((ttb.normally + ttb.completely) / 2 / 3600))
      : ttb?.hastily
      ? Math.max(1, Math.round(ttb.hastily / 3600))
      : null;
  const completionistHours =
    ttb?.completely && ttb.completely > 0
      ? Math.max(1, Math.round(ttb.completely / 3600))
      : null;

  const hltbLabel = mainHours
    ? `~${mainHours}h para zerar`
    : completionistHours
    ? `~${completionistHours}h (100%)`
    : 'Tempo: Aguardando dados';

  return {
    id: `igdb-game-${g.id}`,
    externalId: String(g.id),
    category: 'game' as MediaCategory,
    title: g.name,
    originalTitle: g.name,
    posterUrl,
    backdropUrl,
    synopsis:
      g.summary ||
      g.storyline ||
      'Acompanhe o lançamento deste jogo confirmado na base oficial da Twitch / IGDB.',
    genres: genres.length > 0 ? genres : ['Games'],
    rating,
    reviewsCount,
    developer,
    platforms: platforms.length > 0 ? platforms : ['PC', 'PS5', 'Xbox Series'],
    releaseDate: unixToIsoDate(g.first_release_date),
    hltbMainHours: mainHours,
    hltbExtraHours: extraHours,
    hltbCompletionistHours: completionistHours,
    hltbLabel,
  };
}

async function loadIgdbStaticCache(): Promise<MediaItem[]> {
  if (cachedIgdbStaticList && cachedIgdbStaticList.length > 0) {
    return cachedIgdbStaticList;
  }
  try {
    const res = await fetch('./igdb-cache.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        cachedIgdbStaticList = data as MediaItem[];
        return cachedIgdbStaticList;
      }
    }
  } catch {
    // Ignore
  }
  return [];
}

async function fetchIgdbGamesByDateRange(
  settings: AppSettings,
  startUnix: number,
  endUnix: number
): Promise<MediaItem[]> {
  const auth = await getTwitchAccessToken(settings);
  if (auth) {
    const query = `
      fields id, name, summary, storyline, first_release_date, total_rating, rating, total_rating_count, hypes, follows, cover.image_id, screenshots.image_id, genres.name, platforms.name, platforms.abbreviation, involved_companies.company.name, involved_companies.developer;
      where first_release_date >= ${startUnix} & first_release_date <= ${endUnix} & cover != null;
      sort hypes desc;
      limit 30;
    `;
    const rawGames = await postIgdbEndpoint<IgdbRawGame>(
      'games',
      query,
      auth.clientId,
      auth.accessToken
    );
    if (rawGames && rawGames.length > 0) {
      return rawGames.map((g) => mapIgdbGameToMediaItem(g));
    }
  }

  // Fallback para o cache IGDB pré-sincronizado
  const cached = await loadIgdbStaticCache();
  const startIso = unixToIsoDate(startUnix) || '';
  const endIso = unixToIsoDate(endUnix) || '';
  return cached.filter((item) => {
    const rel = extractIsoDatePart(item.releaseDate);
    return rel && rel >= startIso && rel <= endIso;
  });
}

export async function resolveHltbForGame(
  gameName: string,
  externalGameId: string,
  settings: AppSettings
): Promise<{
  mainHours: number | null;
  extraHours: number | null;
  completionistHours: number | null;
  label: string;
}> {
  // 1. Consulta diretamente o endpoint game_time_to_beats da Twitch / IGDB!
  const numericId = Number(externalGameId);
  if (!Number.isNaN(numericId) && numericId > 0) {
    const auth = await getTwitchAccessToken(settings);
    if (auth) {
      const ttbQuery = `fields game_id, hastily, normally, completely; where game_id = ${numericId}; limit 1;`;
      const ttbRes = await postIgdbEndpoint<IgdbTimeToBeat>(
        'game_time_to_beats',
        ttbQuery,
        auth.clientId,
        auth.accessToken
      );
      const ttb = ttbRes?.[0];
      if (ttb && (ttb.normally || ttb.completely || ttb.hastily)) {
        const mainHours = ttb.normally
          ? Math.max(1, Math.round(ttb.normally / 3600))
          : null;
        const completionistHours = ttb.completely
          ? Math.max(1, Math.round(ttb.completely / 3600))
          : null;
        const extraHours =
          ttb.normally && ttb.completely
            ? Math.max(1, Math.round((ttb.normally + ttb.completely) / 2 / 3600))
            : ttb.hastily
            ? Math.max(1, Math.round(ttb.hastily / 3600))
            : null;
        return {
          mainHours,
          extraHours,
          completionistHours,
          label: mainHours
            ? `~${mainHours}h para zerar`
            : completionistHours
            ? `~${completionistHours}h (100%)`
            : 'Tempo: Aguardando dados',
        };
      }
    }
  }

  // 2. Fallback para Edge Function do Supabase (se configurada)
  const supabase = getSupabaseClient(settings);
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('hltb-lookup', {
        body: { gameName, rawgId: externalGameId },
      });

      if (!error && data) {
        return {
          mainHours: data.main_story_hours ?? null,
          extraHours: data.main_extra_hours ?? null,
          completionistHours: data.completionist_hours ?? null,
          label: data.status_label || 'Tempo: Aguardando dados',
        };
      }
    } catch {
      // Ignore
    }
  }

  return {
    mainHours: null,
    extraHours: null,
    completionistHours: null,
    label: 'Tempo: Aguardando dados na IGDB',
  };
}

/**
 * Busca jogos reais usando a API oficial da Twitch / IGDB (separando futuros >= hoje e passados <= ontem)
 */
export async function fetchRawgGames(
  settings: AppSettings,
  pastPagesCount = 2
): Promise<{
  items: MediaItem[];
  isLive: boolean;
}> {
  const fallback = getCuratedFallbackData().game;

  try {
    const auth = await getTwitchAccessToken(settings);
    if (auth) {
      const now = new Date();
      const todayStartUnix = Math.floor(
        Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0) / 1000
      );
      const yesterdayEndUnix = todayStartUnix - 1;
      const futureLimitUnix = todayStartUnix + 365 * 86400;
      const pastLimitUnix = todayStartUnix - 365 * 86400;

      const upcomingQuery = `
        fields id, name, summary, storyline, first_release_date, total_rating, rating, total_rating_count, hypes, follows, cover.image_id, screenshots.image_id, genres.name, platforms.name, platforms.abbreviation, involved_companies.company.name, involved_companies.developer;
        where first_release_date >= ${todayStartUnix} & first_release_date <= ${futureLimitUnix} & cover != null & version_parent = null;
        sort first_release_date asc;
        limit 60;
      `;

      const upcomingHypedOneYearQuery = `
        fields id, name, summary, storyline, first_release_date, total_rating, rating, total_rating_count, hypes, follows, cover.image_id, screenshots.image_id, genres.name, platforms.name, platforms.abbreviation, involved_companies.company.name, involved_companies.developer;
        where first_release_date >= ${todayStartUnix} & first_release_date <= ${futureLimitUnix} & cover != null & version_parent = null & (hypes > 0 | follows > 0);
        sort hypes desc;
        limit 90;
      `;

      const pastLimitCount = Math.min(100, pastPagesCount * 20);
      const pastQuery = `
        fields id, name, summary, storyline, first_release_date, total_rating, rating, total_rating_count, hypes, follows, cover.image_id, screenshots.image_id, genres.name, platforms.name, platforms.abbreviation, involved_companies.company.name, involved_companies.developer;
        where first_release_date <= ${yesterdayEndUnix} & first_release_date >= ${pastLimitUnix} & cover != null & version_parent = null;
        sort first_release_date desc;
        limit ${pastLimitCount};
      `;

      const [upcomingRaw, upcomingHypedRaw, pastRaw] = await Promise.all([
        postIgdbEndpoint<IgdbRawGame>(
          'games',
          upcomingQuery,
          auth.clientId,
          auth.accessToken
        ),
        postIgdbEndpoint<IgdbRawGame>(
          'games',
          upcomingHypedOneYearQuery,
          auth.clientId,
          auth.accessToken
        ),
        postIgdbEndpoint<IgdbRawGame>(
          'games',
          pastQuery,
          auth.clientId,
          auth.accessToken
        ),
      ]);

      const combinedRaw = [
        ...(pastRaw || []),
        ...(upcomingRaw || []),
        ...(upcomingHypedRaw || []),
      ].filter(
        (g) => g && g.id && g.first_release_date
      );

      if (combinedRaw.length > 0) {
        // Busca também tempos de campanha em lote no endpoint game_time_to_beats da IGDB
        const gameIds = combinedRaw.map((g) => g.id).slice(0, 80);
        const ttbMap = new Map<number, IgdbTimeToBeat>();
        if (gameIds.length > 0) {
          const ttbQuery = `fields game_id, hastily, normally, completely; where game_id = (${gameIds.join(
            ','
          )}); limit 80;`;
          const ttbList = await postIgdbEndpoint<IgdbTimeToBeat>(
            'game_time_to_beats',
            ttbQuery,
            auth.clientId,
            auth.accessToken
          );
          for (const ttb of ttbList || []) {
            if (ttb?.game_id) ttbMap.set(ttb.game_id, ttb);
          }
        }

        const mappedGames = deduplicateByExternalId(
          combinedRaw.map((g) => mapIgdbGameToMediaItem(g, ttbMap))
        );
        return {
          items: mappedGames,
          isLive: true,
        };
      }
    }

    // Se o navegador bloqueou via CORS direto, carrega o cache real da IGDB gerado com as credenciais da Twitch
    const cachedIgdb = await loadIgdbStaticCache();
    if (cachedIgdb.length > 0) {
      return {
        items: cachedIgdb,
        isLive: true,
      };
    }

    return { items: fallback, isLive: false };
  } catch {
    const cachedIgdb = await loadIgdbStaticCache();
    if (cachedIgdb.length > 0) {
      return { items: cachedIgdb, isLive: true };
    }
    return { items: fallback, isLive: false };
  }
}

// ============================================================================
// PESQUISA GLOBAL SOB DEMANDA EM TODAS AS APIS (TMDB, ANILIST E TWITCH/IGDB)
// ============================================================================

const PROVIDER_ID_TO_BR_LABEL: Record<number, string> = {
  8: 'Netflix',
  119: 'Amazon Prime',
  9: 'Amazon Prime',
  10: 'Amazon Prime',
  1899: 'HBO Max',
  384: 'HBO Max',
  307: 'Globoplay',
  337: 'Disney+',
  227: 'Telecine',
};

const NETWORK_ID_TO_BR_LABEL: Record<number, string> = {
  213: 'Netflix',
  1024: 'Amazon Prime',
  49: 'HBO Max',
  3186: 'HBO Max',
  3290: 'Globoplay',
  60: 'Globoplay',
  2739: 'Disney+',
};

function extractBrStreamingLabels(
  watchProvidersBr?: {
    flatrate?: Array<{ provider_id: number; provider_name: string }>;
    rent?: Array<{ provider_id: number; provider_name: string }>;
    buy?: Array<{ provider_id: number; provider_name: string }>;
    ads?: Array<{ provider_id: number; provider_name: string }>;
  },
  networks?: Array<{ id: number; name: string }>
): string[] {
  const labels = new Set<string>();

  if (watchProvidersBr) {
    const allProviders = [
      ...(watchProvidersBr.flatrate || []),
      ...(watchProvidersBr.ads || []),
    ];
    for (const p of allProviders) {
      const mapped = PROVIDER_ID_TO_BR_LABEL[p.provider_id];
      if (mapped) {
        labels.add(mapped);
      } else if (p.provider_name) {
        const lower = p.provider_name.toLowerCase();
        if (lower.includes('netflix')) labels.add('Netflix');
        else if (lower.includes('prime') || lower.includes('amazon'))
          labels.add('Amazon Prime');
        else if (lower.includes('max') || lower.includes('hbo'))
          labels.add('HBO Max');
        else if (lower.includes('globoplay')) labels.add('Globoplay');
        else if (lower.includes('disney')) labels.add('Disney+');
        else if (lower.includes('telecine')) labels.add('Telecine');
      }
    }
  }

  if (networks) {
    for (const net of networks) {
      const mapped = NETWORK_ID_TO_BR_LABEL[net.id];
      if (mapped) {
        labels.add(mapped);
      } else if (net.name) {
        const lower = net.name.toLowerCase();
        if (lower.includes('netflix')) labels.add('Netflix');
        else if (lower.includes('prime') || lower.includes('amazon'))
          labels.add('Amazon Prime');
        else if (lower.includes('hbo') || lower.includes('max'))
          labels.add('HBO Max');
        else if (lower.includes('globo')) labels.add('Globoplay');
        else if (lower.includes('disney')) labels.add('Disney+');
        else if (lower.includes('telecine')) labels.add('Telecine');
      }
    }
  }

  return Array.from(labels);
}

/**
 * Pesquisa sob demanda em TODA a base da TMDB (Filmes + Séries), AniList (Animes) e Twitch/IGDB (Games).
 * Permite encontrar tanto lançamentos distantes no futuro (ex: "Duna 3") quanto títulos já lançados no passado.
 */
export async function searchMediaAcrossApis(
  rawQuery: string,
  settings: AppSettings
): Promise<MediaItem[]> {
  const cleanQuery = rawQuery.trim();
  if (cleanQuery.length < 2) return [];

  const apiKey = (settings.tmdbApiKey || DEFAULT_TMDB_API_KEY).trim();
  const { headers, queryParam } = buildTmdbHeadersAndParam(apiKey);
  const todayIso = getLocalIsoDate(0);

  // Se o usuário digitar um número no final (ex: "Duna 3", "Avatar 3", "Shrek 5"),
  // buscamos também pelo nome-base ("Duna", "Avatar", "Shrek") porque na TMDB o título oficial
  // costuma usar algarismo romano ou extenso ("Duna: Parte Três", "Dune: Part Three", "Duna: Messias").
  const baseQueryWithoutTrailingNum = cleanQuery.replace(/\s+\d+$/, '').trim();
  const movieQueries =
    baseQueryWithoutTrailingNum.length >= 3 &&
    baseQueryWithoutTrailingNum !== cleanQuery
      ? [cleanQuery, baseQueryWithoutTrailingNum]
      : [cleanQuery];

  const searchTmdbMoviesLive = async (): Promise<MediaItem[]> => {
    try {
      const urls = movieQueries.map(
        (q) =>
          `https://api.themoviedb.org/3/search/movie?language=pt-BR&region=BR&include_adult=false&query=${encodeURIComponent(
            q
          )}&page=1${queryParam}`
      );
      const responses = await Promise.all(
        urls.map((u) => fetch(u, { headers }).catch(() => null))
      );

      const rawMap = new Map<number, TmdbRawMovie>();
      for (const r of responses) {
        if (r && r.ok) {
          const d = await r.json();
          for (const m of (d?.results || []) as TmdbRawMovie[]) {
            if (m && m.id && (m.poster_path || m.backdrop_path || m.release_date)) {
              rawMap.set(m.id, m);
            }
          }
        }
      }

      const candidates = Array.from(rawMap.values()).slice(0, 12);
      if (candidates.length === 0) return [];

      // Enriquece os principais resultados com Diretor/Empresa, datas de Cinema/Digital no Brasil e provedores de Streaming BR
      const enriched = await Promise.all(
        candidates.map(async (m) => {
          try {
            const detailUrl = `https://api.themoviedb.org/3/movie/${m.id}?language=pt-BR&append_to_response=credits,release_dates,watch/providers${queryParam}`;
            const dRes = await fetch(detailUrl, { headers });
            if (dRes.ok) {
              const detail = await dRes.json();
              const brWatch = detail?.['watch/providers']?.results?.BR;
              const streamLabels = extractBrStreamingLabels(brWatch);
              const dirAndComp = extractDirectorAndCompanyFromTmdbDetail(detail);

              if (dirAndComp) {
                const cache = getMovieCreditsCache();
                cache[String(m.id)] = {
                  directorAndCompany: dirAndComp,
                  runtime:
                    typeof detail?.runtime === 'number' && detail.runtime > 0
                      ? detail.runtime
                      : undefined,
                };
                saveMovieCreditsCache();
              }

              let brCinemaDate: string | null = null;
              let brDigitalDate: string | null = null;

              const relEntries = detail?.release_dates?.results || [];
              const brEntry = relEntries.find(
                (x: { iso_3166_1: string }) => x.iso_3166_1 === 'BR'
              );
              if (brEntry && Array.isArray(brEntry.release_dates)) {
                for (const rd of brEntry.release_dates) {
                  const datePart = extractIsoDatePart(rd.release_date);
                  if (!datePart) continue;
                  if ((rd.type === 3 || rd.type === 2) && !brCinemaDate) {
                    brCinemaDate = datePart;
                  }
                  if ((rd.type === 4 || rd.type === 6) && !brDigitalDate) {
                    brDigitalDate = datePart;
                  }
                }
              }

              const effectiveCinema = brCinemaDate || m.release_date || null;
              const isDigitallyOut =
                streamLabels.length > 0 ||
                Boolean(brDigitalDate && brDigitalDate <= todayIso);

              const category: 'movie_cinema' | 'movie_digital' =
                streamLabels.length > 0 &&
                (!effectiveCinema || effectiveCinema < todayIso)
                  ? 'movie_digital'
                  : 'movie_cinema';

              const item = mapTmdbRawMovieToItem(
                { ...m, runtime: detail?.runtime || m.runtime },
                category,
                todayIso,
                effectiveCinema,
                streamLabels,
                dirAndComp
              );
              item.cinemaReleaseDate = effectiveCinema;
              item.digitalReleaseDate =
                brDigitalDate && brDigitalDate !== effectiveCinema
                  ? brDigitalDate
                  : null;
              item.isDigitalAvailable = isDigitallyOut;
              return item;
            }
          } catch {
            // Fallback para dados básicos da busca
          }
          return mapTmdbRawMovieToItem(
            m,
            'movie_cinema',
            todayIso,
            m.release_date,
            []
          );
        })
      );

      return enriched;
    } catch {
      return [];
    }
  };

  const searchTmdbSeriesLive = async (): Promise<MediaItem[]> => {
    try {
      const urls = movieQueries.map(
        (q) =>
          `https://api.themoviedb.org/3/search/tv?language=pt-BR&include_adult=false&query=${encodeURIComponent(
            q
          )}&page=1${queryParam}`
      );
      const responses = await Promise.all(
        urls.map((u) => fetch(u, { headers }).catch(() => null))
      );

      const rawMap = new Map<number, TmdbRawTv>();
      for (const r of responses) {
        if (r && r.ok) {
          const d = await r.json();
          for (const tv of (d?.results || []) as TmdbRawTv[]) {
            if (tv && tv.id && tv.poster_path) {
              rawMap.set(tv.id, tv);
            }
          }
        }
      }

      const candidates = Array.from(rawMap.values()).slice(0, 10);
      if (candidates.length === 0) return [];

      const enriched = await Promise.all(
        candidates.map(async (tv) => {
          try {
            const detailUrl = `https://api.themoviedb.org/3/tv/${tv.id}?language=pt-BR&append_to_response=watch/providers${queryParam}`;
            const dRes = await fetch(detailUrl, { headers });
            if (dRes.ok) {
              const detail = await dRes.json();
              const brWatch = detail?.['watch/providers']?.results?.BR;
              const networks = detail?.networks || [];
              const streamLabels = extractBrStreamingLabels(brWatch, networks);

              const nextEp = detail?.next_episode_to_air;
              const lastEp = detail?.last_episode_to_air;
              const effectiveDate =
                nextEp?.air_date || lastEp?.air_date || tv.first_air_date || null;
              const epNumber = nextEp?.episode_number || lastEp?.episode_number || 1;

              const finalTags =
                streamLabels.length > 0 ? streamLabels : ['Streaming BR'];

              return mapTmdbRawTvToItem(
                tv,
                effectiveDate,
                epNumber,
                `Catálogo Brasil • ${finalTags.join(' / ')}`,
                detail?.number_of_episodes || null,
                finalTags
              );
            }
          } catch {
            // Ignore
          }
          return mapTmdbRawTvToItem(
            tv,
            tv.first_air_date,
            1,
            'Catálogo Brasil',
            null,
            ['Streaming BR']
          );
        })
      );

      return enriched;
    } catch {
      return [];
    }
  };

  const searchAniListLive = async (): Promise<MediaItem[]> => {
    const query = `
      query ($search: String) {
        Page(page: 1, perPage: 10) {
          media(search: $search, type: ANIME, isAdult: false, sort: [POPULARITY_DESC]) {
            id
            title { romaji english native }
            coverImage { extraLarge large }
            bannerImage
            description(asHtml: false)
            genres
            averageScore
            popularity
            status
            episodes
            duration
            startDate { year month day }
            nextAiringEpisode { episode airingAt }
            studios(isMain: true) { nodes { name } }
          }
        }
      }
    `;

    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { search: cleanQuery },
        }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const mediaList = data?.data?.Page?.media || [];

      return mediaList.map(
        (anime: {
          id: number;
          title?: { english?: string; romaji?: string; native?: string };
          coverImage?: { extraLarge?: string; large?: string };
          bannerImage?: string;
          description?: string;
          genres?: string[];
          averageScore?: number;
          popularity?: number;
          status?: string;
          episodes?: number;
          duration?: number;
          startDate?: { year?: number; month?: number; day?: number };
          nextAiringEpisode?: { episode?: number; airingAt?: number };
          studios?: { nodes?: Array<{ name: string }> };
        }): MediaItem => {
          const cleanSynopsis = (anime.description || '')
            .replace(/<[^>]*>/g, '')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();

          let airDateIso: string | null = null;
          if (anime.nextAiringEpisode?.airingAt) {
            airDateIso = new Date(
              anime.nextAiringEpisode.airingAt * 1000
            ).toISOString();
          } else if (anime.startDate?.year) {
            const y = anime.startDate.year;
            const m = String(anime.startDate.month || 1).padStart(2, '0');
            const d = String(anime.startDate.day || 1).padStart(2, '0');
            airDateIso = `${y}-${m}-${d}`;
          }

          return {
            id: `anilist-search-${anime.id}`,
            externalId: String(anime.id),
            category: 'anime',
            title: anime.title?.english || anime.title?.romaji || 'Anime',
            originalTitle: anime.title?.native || anime.title?.romaji,
            posterUrl:
              anime.coverImage?.extraLarge || anime.coverImage?.large || '',
            backdropUrl: anime.bannerImage || undefined,
            synopsis:
              cleanSynopsis || 'Anime encontrado na base oficial da AniList.',
            genres: anime.genres?.slice(0, 4) || ['Anime'],
            rating: anime.averageScore
              ? Math.round((anime.averageScore / 10) * 10) / 10
              : undefined,
            reviewsCount: anime.popularity || 5000,
            studioOrNetwork: `Estúdio ${
              anime.studios?.nodes?.[0]?.name || 'Animação Japonesa'
            }`,
            seasonStatus: anime.nextAiringEpisode
              ? 'Em Exibição • Simulcast'
              : anime.status === 'NOT_YET_RELEASED'
              ? 'Próxima Estreia Confirmada'
              : 'Catálogo Completo',
            nextEpisodeNumber: anime.nextAiringEpisode?.episode || 1,
            nextEpisodeDate: airDateIso,
            totalEpisodes: anime.episodes || null,
            episodeDurationMinutes: anime.duration || 24,
          };
        }
      );
    } catch {
      return [];
    }
  };

  const searchIgdbGamesLive = async (): Promise<MediaItem[]> => {
    try {
      const auth = await getTwitchAccessToken(settings);
      if (auth) {
        const safeQ = cleanQuery.replace(/"/g, '');
        const igdbQuery = `
          search "${safeQ}";
          fields id, name, summary, storyline, first_release_date, total_rating, rating, total_rating_count, hypes, follows, cover.image_id, screenshots.image_id, genres.name, platforms.name, platforms.abbreviation, involved_companies.company.name, involved_companies.developer;
          where cover != null;
          limit 15;
        `;
        const rawGames = await postIgdbEndpoint<IgdbRawGame>(
          'games',
          igdbQuery,
          auth.clientId,
          auth.accessToken
        );
        if (rawGames && rawGames.length > 0) {
          return rawGames.map((g) => mapIgdbGameToMediaItem(g));
        }
      }
    } catch {
      // Fallback
    }

    const cached = await loadIgdbStaticCache();
    const qLower = cleanQuery.toLowerCase();
    return cached.filter(
      (g) =>
        g.title.toLowerCase().includes(qLower) ||
        (g.originalTitle && g.originalTitle.toLowerCase().includes(qLower))
    );
  };

  const [movies, series, animes, games] = await Promise.all([
    searchTmdbMoviesLive(),
    searchTmdbSeriesLive(),
    searchAniListLive(),
    searchIgdbGamesLive(),
  ]);

  return [...movies, ...series, ...animes, ...games];
}

/**
 * Busca no endpoint oficial /movie/{id}/release_dates da TMDB as datas separadas de
 * Estreia nos Cinemas (Type 2/3) e Lançamento Digital/VOD (Type 4/6) no Brasil.
 */
export async function resolveMovieReleaseDatesInBrazil(
  externalId: string,
  settings: AppSettings
): Promise<{
  cinemaDate: string | null;
  digitalDate: string | null;
  runtimeMinutes: number | null;
  directorAndCompany: string | null;
}> {
  const apiKey = (settings.tmdbApiKey || DEFAULT_TMDB_API_KEY).trim();
  if (!apiKey || !externalId) {
    return {
      cinemaDate: null,
      digitalDate: null,
      runtimeMinutes: null,
      directorAndCompany: null,
    };
  }

  try {
    const { headers, queryParam } = buildTmdbHeadersAndParam(apiKey);
    const url = `https://api.themoviedb.org/3/movie/${encodeURIComponent(
      externalId
    )}?language=pt-BR&append_to_response=release_dates,credits${queryParam}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      return {
        cinemaDate: null,
        digitalDate: null,
        runtimeMinutes: null,
        directorAndCompany: null,
      };
    }

    const detail = await res.json();
    const directorAndCompany = extractDirectorAndCompanyFromTmdbDetail(detail);
    if (directorAndCompany) {
      const cache = getMovieCreditsCache();
      cache[externalId] = {
        directorAndCompany,
        runtime:
          typeof detail?.runtime === 'number' && detail.runtime > 0
            ? detail.runtime
            : undefined,
      };
      saveMovieCreditsCache();
    }

    const results = detail?.release_dates?.results || [];
    const brEntry =
      results.find((x: { iso_3166_1: string }) => x.iso_3166_1 === 'BR') ||
      results.find((x: { iso_3166_1: string }) => x.iso_3166_1 === 'US');

    let cinemaDate: string | null = null;
    let digitalDate: string | null = null;

    if (brEntry && Array.isArray(brEntry.release_dates)) {
      for (const rd of brEntry.release_dates) {
        const dPart = extractIsoDatePart(rd.release_date);
        if (!dPart) continue;
        if ((rd.type === 3 || rd.type === 2) && !cinemaDate) {
          cinemaDate = dPart;
        }
        if ((rd.type === 4 || rd.type === 6) && !digitalDate) {
          digitalDate = dPart;
        }
      }
    }

    return {
      cinemaDate,
      digitalDate,
      runtimeMinutes:
        typeof detail?.runtime === 'number' && detail.runtime > 0
          ? detail.runtime
          : null,
      directorAndCompany,
    };
  } catch {
    return {
      cinemaDate: null,
      digitalDate: null,
      runtimeMinutes: null,
      directorAndCompany: null,
    };
  }
}

export async function enrichFavoriteMoviesWithDirectorAndCompany(
  items: MediaItem[],
  settings: AppSettings
): Promise<MediaItem[]> {
  const apiKey = (settings.tmdbApiKey || DEFAULT_TMDB_API_KEY).trim();
  if (!apiKey) return items;
  const { headers, queryParam } = buildTmdbHeadersAndParam(apiKey);
  return enrichMoviesWithDirectorAndCompany(items, headers, queryParam);
}
