import { AppSettings, MediaCategory, MediaItem } from '../types/media';
import { getCuratedFallbackData } from '../data/curatedFallbackData';
import { getSupabaseClient } from '../lib/settings';
import { isFromTodayOnwards } from '../lib/dateUtils';

function mergeWithPastArchive(liveItems: MediaItem[], fallbackItems: MediaItem[]): MediaItem[] {
  const seenIds = new Set(liveItems.map((i) => i.externalId));
  const pastFallback = fallbackItems.filter(
    (item) => !isFromTodayOnwards(item) && !seenIds.has(item.externalId)
  );
  return [...pastFallback, ...liveItems];
}

function buildTmdbHeadersAndParam(apiKey: string): {
  headers: Record<string, string>;
  queryParam: string;
} {
  const clean = apiKey.trim();
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

interface TmdbReleaseDateEntry {
  type: number;
  release_date: string;
}

interface TmdbCountryRelease {
  iso_3166_1: string;
  release_dates: TmdbReleaseDateEntry[];
}

function extractCinemaAndDigitalDates(
  releaseDatesResults: TmdbCountryRelease[] | undefined,
  fallbackReleaseDate?: string
): {
  cinemaDate: string | null;
  digitalDate: string | null;
  isDigitalAvailable: boolean;
} {
  let cinemaDate: string | null = null;
  let digitalDate: string | null = null;

  if (Array.isArray(releaseDatesResults) && releaseDatesResults.length > 0) {
    const br = releaseDatesResults.find((r) => r.iso_3166_1 === 'BR');
    const us = releaseDatesResults.find((r) => r.iso_3166_1 === 'US');
    const orderedPools = [br, us, ...releaseDatesResults].filter(
      (x): x is TmdbCountryRelease => Boolean(x)
    );

    for (const country of orderedPools) {
      for (const rel of country.release_dates || []) {
        const isoDate = rel.release_date ? rel.release_date.slice(0, 10) : null;
        if (!isoDate) continue;
        if (rel.type === 3 && !cinemaDate) {
          cinemaDate = isoDate;
        }
        if (rel.type === 4 && !digitalDate) {
          digitalDate = isoDate;
        }
      }
    }
  }

  if (!cinemaDate && fallbackReleaseDate) {
    cinemaDate = fallbackReleaseDate.slice(0, 10);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const isDigitalAvailable = Boolean(digitalDate && digitalDate <= todayIso);

  return { cinemaDate, digitalDate, isDigitalAvailable };
}

export async function fetchTmdbMovies(settings: AppSettings): Promise<{
  cinema: MediaItem[];
  digital: MediaItem[];
  isLive: boolean;
}> {
  const fallback = getCuratedFallbackData();
  if (!settings.tmdbApiKey.trim()) {
    return {
      cinema: fallback.movie_cinema,
      digital: fallback.movie_digital,
      isLive: false,
    };
  }

  try {
    const { headers, queryParam } = buildTmdbHeadersAndParam(settings.tmdbApiKey);
    const [upcomingRes, nowPlayingRes, popularRes] = await Promise.all([
      fetch(
        `https://api.themoviedb.org/3/movie/upcoming?language=pt-BR&region=BR&page=1${queryParam}`,
        { headers }
      ),
      fetch(
        `https://api.themoviedb.org/3/movie/now_playing?language=pt-BR&region=BR&page=1${queryParam}`,
        { headers }
      ),
      fetch(
        `https://api.themoviedb.org/3/movie/popular?language=pt-BR&region=BR&page=1${queryParam}`,
        { headers }
      ),
    ]);

    if (!upcomingRes.ok && !nowPlayingRes.ok) {
      return {
        cinema: fallback.movie_cinema,
        digital: fallback.movie_digital,
        isLive: false,
      };
    }

    const upcomingJson = upcomingRes.ok ? await upcomingRes.json() : { results: [] };
    const nowPlayingJson = nowPlayingRes.ok ? await nowPlayingRes.json() : { results: [] };
    const popularJson = popularRes.ok ? await popularRes.json() : { results: [] };

    const mergedRaw = [
      ...(upcomingJson.results || []),
      ...(nowPlayingJson.results || []),
      ...(popularJson.results || []),
    ];

    const uniqueIds = new Set<number>();
    const candidates = mergedRaw
      .filter((m: { id: number; poster_path?: string }) => {
        if (!m?.id || !m.poster_path || uniqueIds.has(m.id)) return false;
        uniqueIds.add(m.id);
        return true;
      })
      .slice(0, 16);

    const detailedMovies = await Promise.all(
      candidates.map(async (movie: { id: number }) => {
        try {
          const detailRes = await fetch(
            `https://api.themoviedb.org/3/movie/${movie.id}?language=pt-BR&append_to_response=release_dates,credits${queryParam}`,
            { headers }
          );
          if (!detailRes.ok) return null;
          return await detailRes.json();
        } catch {
          return null;
        }
      })
    );

    const cinemaList: MediaItem[] = [];
    const digitalList: MediaItem[] = [];

    for (const detail of detailedMovies) {
      if (!detail) continue;

      const { cinemaDate, digitalDate, isDigitalAvailable } = extractCinemaAndDigitalDates(
        detail.release_dates?.results,
        detail.release_date
      );

      const directorObj = (detail.credits?.crew || []).find(
        (c: { job: string; name: string }) => c.job === 'Director'
      );
      const studioName = detail.production_companies?.[0]?.name;
      const director = directorObj?.name
        ? studioName
          ? `${directorObj.name} (${studioName})`
          : directorObj.name
        : studioName || 'Direção não informada';

      const genres = (detail.genres || []).map((g: { name: string }) => g.name);

      const baseMovie: Omit<MediaItem, 'id' | 'category'> = {
        externalId: String(detail.id),
        title: detail.title || detail.original_title,
        originalTitle: detail.original_title,
        posterUrl: `https://image.tmdb.org/t/p/w500${detail.poster_path}`,
        backdropUrl: detail.backdrop_path
          ? `https://image.tmdb.org/t/p/original${detail.backdrop_path}`
          : undefined,
        synopsis:
          detail.overview ||
          'Sinopse em português ainda não disponibilizada pelos distribuidores oficiais.',
        genres: genres.length ? genres : ['Cinema'],
        rating: detail.vote_average ? Math.round(detail.vote_average * 10) / 10 : undefined,
        reviewsCount:
          typeof detail.vote_count === 'number' && detail.vote_count > 0
            ? detail.vote_count
            : detail.popularity
            ? Math.round(detail.popularity * 120)
            : 1850,
        runtimeMinutes: detail.runtime || null,
        director,
        cinemaReleaseDate: cinemaDate,
        digitalReleaseDate: digitalDate,
        isDigitalAvailable,
      };

      if (cinemaDate) {
        cinemaList.push({
          ...baseMovie,
          id: `tmdb-movie-cinema-${detail.id}`,
          category: 'movie_cinema',
        });
      }

      if (digitalDate || isDigitalAvailable) {
        digitalList.push({
          ...baseMovie,
          id: `tmdb-movie-digital-${detail.id}`,
          category: 'movie_digital',
        });
      }
    }

    return {
      cinema:
        cinemaList.length > 0
          ? mergeWithPastArchive(cinemaList, fallback.movie_cinema)
          : fallback.movie_cinema,
      digital:
        digitalList.length > 0
          ? mergeWithPastArchive(digitalList, fallback.movie_digital)
          : fallback.movie_digital,
      isLive: cinemaList.length > 0 || digitalList.length > 0,
    };
  } catch {
    return {
      cinema: fallback.movie_cinema,
      digital: fallback.movie_digital,
      isLive: false,
    };
  }
}

export async function fetchTmdbSeries(settings: AppSettings): Promise<{
  items: MediaItem[];
  isLive: boolean;
}> {
  const fallback = getCuratedFallbackData().tv;
  if (!settings.tmdbApiKey.trim()) {
    return { items: fallback, isLive: false };
  }

  try {
    const { headers, queryParam } = buildTmdbHeadersAndParam(settings.tmdbApiKey);
    const listRes = await fetch(
      `https://api.themoviedb.org/3/tv/on_the_air?language=pt-BR&page=1${queryParam}`,
      { headers }
    );
    if (!listRes.ok) return { items: fallback, isLive: false };

    const listData = await listRes.json();
    const candidates = (listData.results || [])
      .filter((tv: { id: number; poster_path?: string }) => tv?.id && tv.poster_path)
      .slice(0, 10);

    const detailedList = await Promise.all(
      candidates.map(async (tv: { id: number }) => {
        try {
          const res = await fetch(
            `https://api.themoviedb.org/3/tv/${tv.id}?language=pt-BR${queryParam}`,
            { headers }
          );
          if (!res.ok) return null;
          return await res.json();
        } catch {
          return null;
        }
      })
    );

    const seriesItems: MediaItem[] = [];
    for (const detail of detailedList) {
      if (!detail) continue;
      const nextEp = detail.next_episode_to_air;
      const networks = (detail.networks || []).map((n: { name: string }) => n.name).join(' / ');
      const creators = (detail.created_by || [])
        .slice(0, 2)
        .map((c: { name: string }) => c.name)
        .join(' & ');

      const epRunTime =
        Array.isArray(detail.episode_run_time) && detail.episode_run_time.length > 0
          ? detail.episode_run_time[0]
          : nextEp?.runtime || 45;

      seriesItems.push({
        id: `tmdb-tv-${detail.id}`,
        externalId: String(detail.id),
        category: 'tv',
        title: detail.name || detail.original_name,
        originalTitle: detail.original_name,
        posterUrl: `https://image.tmdb.org/t/p/w500${detail.poster_path}`,
        backdropUrl: detail.backdrop_path
          ? `https://image.tmdb.org/t/p/original${detail.backdrop_path}`
          : undefined,
        synopsis:
          detail.overview ||
          'Sinopse em português ainda não divulgada para esta temporada.',
        genres: (detail.genres || []).map((g: { name: string }) => g.name),
        rating: detail.vote_average ? Math.round(detail.vote_average * 10) / 10 : undefined,
        reviewsCount:
          typeof detail.vote_count === 'number' && detail.vote_count > 0
            ? detail.vote_count
            : detail.popularity
            ? Math.round(detail.popularity * 140)
            : 2400,
        studioOrNetwork: creators
          ? `${creators} • ${networks || 'Estúdio Oficial'}`
          : networks || 'Emissora Internacional',
        seasonStatus:
          detail.status === 'Returning Series'
            ? 'Temporada em Exibição Semanal'
            : detail.status || 'Em Exibição',
        nextEpisodeNumber: nextEp?.episode_number ?? 1,
        nextEpisodeDate: nextEp?.air_date || detail.first_air_date || null,
        totalEpisodes: detail.number_of_episodes || null,
        episodeDurationMinutes: epRunTime,
      });
    }

    return {
      items:
        seriesItems.length > 0
          ? mergeWithPastArchive(seriesItems, fallback)
          : fallback,
      isLive: seriesItems.length > 0,
    };
  } catch {
    return { items: fallback, isLive: false };
  }
}

export async function fetchAniListAnimes(): Promise<{
  items: MediaItem[];
  isLive: boolean;
}> {
  const fallback = getCuratedFallbackData().anime;

  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, status_in: [RELEASING, NOT_YET_RELEASED], sort: [POPULARITY_DESC]) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            extraLarge
            large
          }
          bannerImage
          description(asHtml: false)
          genres
          averageScore
          popularity
          trending
          status
          episodes
          duration
          studios(isMain: true) {
            nodes {
              name
            }
          }
          nextAiringEpisode {
            episode
            airingAt
            timeUntilAiring
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
        variables: { page: 1, perPage: 12 },
      }),
    });

    if (!response.ok) {
      return { items: fallback, isLive: false };
    }

    const result = await response.json();
    const mediaList = result?.data?.Page?.media || [];
    if (!mediaList.length) {
      return { items: fallback, isLive: false };
    }

    const items: MediaItem[] = mediaList.map((anime: {
      id: number;
      title: { english?: string; romaji?: string; native?: string };
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
      nextAiringEpisode?: { episode: number; airingAt: number } | null;
    }) => {
      const cleanSynopsis = (anime.description || '')
        .replace(/<[^>]*>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      const airingIso = anime.nextAiringEpisode?.airingAt
        ? new Date(anime.nextAiringEpisode.airingAt * 1000).toISOString()
        : null;

      const studioName =
        anime.studios?.nodes?.[0]?.name || 'Estúdio de Animação Japonês';

      return {
        id: `anilist-anime-${anime.id}`,
        externalId: String(anime.id),
        category: 'anime' as MediaCategory,
        title: anime.title.english || anime.title.romaji || 'Anime',
        originalTitle: anime.title.native || anime.title.romaji,
        posterUrl: anime.coverImage?.extraLarge || anime.coverImage?.large || '',
        backdropUrl: anime.bannerImage || undefined,
        synopsis:
          cleanSynopsis ||
          'Acompanhe os próximos episódios desta produção na temporada atual de animes.',
        genres: anime.genres?.slice(0, 5) || ['Anime'],
        rating: anime.averageScore ? Math.round((anime.averageScore / 10) * 10) / 10 : undefined,
        reviewsCount:
          anime.popularity || (anime.trending ? anime.trending * 450 : 6800),
        studioOrNetwork: `Estúdio ${studioName}`,
        seasonStatus:
          anime.status === 'RELEASING'
            ? 'Temporada Atual • Simulcast em Exibição'
            : 'Próxima Estreia Confirmada',
        nextEpisodeNumber: anime.nextAiringEpisode?.episode ?? 1,
        nextEpisodeDate: airingIso,
        totalEpisodes: anime.episodes || 12,
        episodeDurationMinutes: anime.duration || 24,
      };
    });

    return {
      items: mergeWithPastArchive(items, fallback),
      isLive: true,
    };
  } catch {
    return { items: fallback, isLive: false };
  }
}

export async function resolveHltbForGame(
  gameName: string,
  rawgId: string,
  settings: AppSettings
): Promise<{
  mainHours: number | null;
  extraHours: number | null;
  completionistHours: number | null;
  label: string;
}> {
  const supabase = getSupabaseClient(settings);
  if (!supabase) {
    return {
      mainHours: null,
      extraHours: null,
      completionistHours: null,
      label: 'Tempo: Aguardando dados',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('hltb-lookup', {
      body: { gameName, rawgId },
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
    // Fallback
  }

  try {
    const normalized = gameName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const { data: cached } = await supabase
      .from('hltb_cache')
      .select('*')
      .eq('normalized_name', normalized)
      .maybeSingle();

    if (cached) {
      return {
        mainHours: cached.main_story_hours ?? null,
        extraHours: cached.main_extra_hours ?? null,
        completionistHours: cached.completionist_hours ?? null,
        label: cached.status_label || 'Tempo: Aguardando dados',
      };
    }
  } catch {
    // Ignore
  }

  return {
    mainHours: null,
    extraHours: null,
    completionistHours: null,
    label: 'Tempo: Aguardando dados',
  };
}

export async function fetchRawgGames(settings: AppSettings): Promise<{
  items: MediaItem[];
  isLive: boolean;
}> {
  const fallback = getCuratedFallbackData().game;
  if (!settings.rawgApiKey.trim()) {
    return { items: fallback, isLive: false };
  }

  try {
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const future = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    const futureIso = future.toISOString().slice(0, 10);

    const url = `https://api.rawg.io/api/games?key=${encodeURIComponent(
      settings.rawgApiKey.trim()
    )}&dates=${todayIso},${futureIso}&ordering=-added&page_size=10`;

    const res = await fetch(url);
    if (!res.ok) return { items: fallback, isLive: false };

    const data = await res.json();
    const rawGames = data?.results || [];
    if (!rawGames.length) return { items: fallback, isLive: false };

    const games: MediaItem[] = await Promise.all(
      rawGames.map(async (g: {
        id: number;
        name: string;
        background_image?: string;
        released?: string;
        rating?: number;
        ratings_count?: number;
        added?: number;
        genres?: Array<{ name: string }>;
        platforms?: Array<{ platform: { name: string } }>;
      }) => {
        const hltb = await resolveHltbForGame(g.name, String(g.id), settings);

        let developer = 'Estúdio Confirmado';
        let synopsis =
          'Acompanhe o lançamento deste título nas principais plataformas de nova geração.';
        try {
          const detailRes = await fetch(
            `https://api.rawg.io/api/games/${g.id}?key=${encodeURIComponent(
              settings.rawgApiKey.trim()
            )}`
          );
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            if (detailData.developers?.length) {
              developer = detailData.developers.map((d: { name: string }) => d.name).join(', ');
            }
            if (detailData.description_raw) {
              synopsis = detailData.description_raw.slice(0, 480);
            }
          }
        } catch {
          // Ignore
        }

        const platforms = (g.platforms || [])
          .map((p) => p.platform.name)
          .slice(0, 5);

        return {
          id: `rawg-game-${g.id}`,
          externalId: String(g.id),
          category: 'game' as MediaCategory,
          title: g.name,
          posterUrl:
            g.background_image ||
            'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=85',
          backdropUrl: g.background_image || undefined,
          synopsis,
          genres: (g.genres || []).map((gen) => gen.name),
          rating: g.rating ? Math.round(g.rating * 20) / 10 : undefined,
          reviewsCount:
            typeof g.ratings_count === 'number' && g.ratings_count > 0
              ? g.ratings_count
              : g.added || 3900,
          developer,
          platforms: platforms.length ? platforms : ['PC', 'PS5', 'Xbox Series'],
          releaseDate: g.released || null,
          hltbMainHours: hltb.mainHours,
          hltbExtraHours: hltb.extraHours,
          hltbCompletionistHours: hltb.completionistHours,
          hltbLabel: hltb.label,
        };
      })
    );

    return {
      items: mergeWithPastArchive(games, fallback),
      isLive: true,
    };
  } catch {
    return { items: fallback, isLive: false };
  }
}
