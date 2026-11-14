import { AppSettings, MediaCategory, MediaItem } from '../types/media';
import { getCuratedFallbackData } from '../data/curatedFallbackData';
import { getSupabaseClient, DEFAULT_TMDB_API_KEY } from '../lib/settings';
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

function mapTmdbRawMovieToItem(
  m: TmdbRawMovie,
  category: 'movie_cinema' | 'movie_digital',
  todayIso: string,
  overrideReleaseDate?: string | null
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
        : 'Sinopse em português em atualização pelos distribuidores oficiais.',
    genres: genreNames.length > 0 ? genreNames : ['Cinema'],
    rating: m.vote_average ? Math.round(m.vote_average * 10) / 10 : undefined,
    reviewsCount:
      typeof m.vote_count === 'number' && m.vote_count > 0
        ? m.vote_count
        : m.popularity
        ? Math.round(m.popularity * 85)
        : 450,
    runtimeMinutes: m.runtime || 124,
    director:
      category === 'movie_cinema'
        ? 'Lançamento Oficial nos Cinemas'
        : 'Lançamento Digital / VOD',
    cinemaReleaseDate: category === 'movie_cinema' ? relDate : relDate,
    digitalReleaseDate: category === 'movie_digital' ? relDate : null,
    isDigitalAvailable: isDigitalAvail,
  };
}

function mapTmdbRawTvToItem(
  tv: TmdbRawTv,
  airDateOverride?: string | null,
  nextEpNumber?: number | null,
  studioText?: string,
  totalEps?: number | null
): MediaItem {
  const effectiveDate = airDateOverride || tv.first_air_date || null;
  const genreNames = tv.genres?.length
    ? tv.genres.map((g) => g.name)
    : (tv.genre_ids || [])
        .map((id) => TMDB_TV_GENRES[id])
        .filter(Boolean)
        .slice(0, 3);

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
        : 'Acompanhe os episódios e estreias desta série no calendário oficial.',
    genres: genreNames.length > 0 ? genreNames : ['Série'],
    rating: tv.vote_average ? Math.round(tv.vote_average * 10) / 10 : undefined,
    reviewsCount:
      typeof tv.vote_count === 'number' && tv.vote_count > 0
        ? tv.vote_count
        : tv.popularity
        ? Math.round(tv.popularity * 95)
        : 520,
    studioOrNetwork: studioText || 'Série Oficial • Transmissão Internacional',
    seasonStatus: 'Episódios no Cronograma',
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
    if (!map.has(item.externalId)) {
      map.set(item.externalId, item);
    }
  }
  return Array.from(map.values());
}

/**
 * Busca Filmes (Cinema e Digital) da TMDB separando rigorosamente:
 * - Lançamentos de HOJE em diante (ordenados cronologicamente para frente)
 * - Lançamentos ANTERIORES a hoje (ordenados dos mais recentes antes de hoje para trás, sem datas falsas!)
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

    // 1. Próximos lançamentos nos Cinemas (>= hoje, em ordem cronológica ascendente)
    const cinemaUpcomingUrls = [1, 2].map(
      (page) =>
        `https://api.themoviedb.org/3/discover/movie?language=pt-BR&region=BR&with_release_type=3|2&primary_release_date.gte=${todayIso}&primary_release_date.lte=${futureLimitIso}&sort_by=primary_release_date.asc&page=${page}${queryParam}`
    );

    // 2. Filmes já lançados nos Cinemas ANTES de hoje (<= ontem, em ordem decrescente a partir de ontem!)
    const cinemaPastPageNums = Array.from({ length: pastPagesCount }, (_, i) => i + 1);
    const cinemaPastUrls = cinemaPastPageNums.map(
      (page) =>
        `https://api.themoviedb.org/3/discover/movie?language=pt-BR&region=BR&with_release_type=3|2&primary_release_date.lte=${yesterdayIso}&sort_by=primary_release_date.desc&vote_count.gte=10&page=${page}${queryParam}`
    );

    // 3. Próximos lançamentos no Digital / VOD (>= hoje)
    const digitalUpcomingUrls = [1, 2].map(
      (page) =>
        `https://api.themoviedb.org/3/discover/movie?language=pt-BR&region=BR&with_release_type=4|6&primary_release_date.gte=${todayIso}&primary_release_date.lte=${futureLimitIso}&sort_by=primary_release_date.asc&page=${page}${queryParam}`
    );

    // 4. Filmes já lançados no Digital / VOD ANTES de hoje (<= ontem, em ordem decrescente a partir de ontem!)
    const digitalPastUrls = cinemaPastPageNums.map(
      (page) =>
        `https://api.themoviedb.org/3/discover/movie?language=pt-BR&region=BR&with_release_type=4|6&primary_release_date.lte=${yesterdayIso}&sort_by=primary_release_date.desc&vote_count.gte=15&page=${page}${queryParam}`
    );

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
      return all.filter((m) => m && m.id && m.poster_path && m.release_date);
    };

    const [
      cinemaUpcomingRaw,
      cinemaPastRaw,
      digitalUpcomingRaw,
      digitalPastRaw,
    ] = await Promise.all([
      fetchPageList(cinemaUpcomingUrls),
      fetchPageList(cinemaPastUrls),
      fetchPageList(digitalUpcomingUrls),
      fetchPageList(digitalPastUrls),
    ]);

    const cinemaItems = deduplicateByExternalId([
      ...cinemaPastRaw.map((m) => mapTmdbRawMovieToItem(m, 'movie_cinema', todayIso)),
      ...cinemaUpcomingRaw.map((m) => mapTmdbRawMovieToItem(m, 'movie_cinema', todayIso)),
    ]);

    const digitalItems = deduplicateByExternalId([
      ...digitalPastRaw.map((m) => mapTmdbRawMovieToItem(m, 'movie_digital', todayIso)),
      ...digitalUpcomingRaw.map((m) => mapTmdbRawMovieToItem(m, 'movie_digital', todayIso)),
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
 * Busca Séries da TMDB separando lançamentos futuros (>= hoje) e lançamentos passados (<= ontem)
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

    const upcomingUrls = [1, 2].map(
      (page) =>
        `https://api.themoviedb.org/3/discover/tv?language=pt-BR&first_air_date.gte=${todayIso}&first_air_date.lte=${futureLimitIso}&sort_by=first_air_date.asc&page=${page}${queryParam}`
    );

    const pastPageNums = Array.from({ length: pastPagesCount }, (_, i) => i + 1);
    const pastUrls = pastPageNums.map(
      (page) =>
        `https://api.themoviedb.org/3/discover/tv?language=pt-BR&first_air_date.lte=${yesterdayIso}&sort_by=first_air_date.desc&vote_count.gte=10&page=${page}${queryParam}`
    );

    const fetchTvPages = async (urls: string[]): Promise<TmdbRawTv[]> => {
      const responses = await Promise.all(
        urls.map((u) => fetch(u, { headers }).catch(() => null))
      );
      const all: TmdbRawTv[] = [];
      for (const r of responses) {
        if (r && r.ok) {
          const data = await r.json();
          if (Array.isArray(data?.results)) {
            all.push(...data.results);
          }
        }
      }
      return all.filter((tv) => tv && tv.id && tv.poster_path && tv.first_air_date);
    };

    const [upcomingRaw, pastRaw] = await Promise.all([
      fetchTvPages(upcomingUrls),
      fetchTvPages(pastUrls),
    ]);

    const seriesItems = deduplicateByExternalId([
      ...pastRaw.map((tv) => mapTmdbRawTvToItem(tv)),
      ...upcomingRaw.map((tv) => mapTmdbRawTvToItem(tv)),
    ]);

    return {
      items: seriesItems.length > 0 ? seriesItems : fallback,
      isLive: seriesItems.length > 0,
    };
  } catch {
    return { items: fallback, isLive: false };
  }
}

/**
 * Busca Animes da AniList GraphQL separando episódios/animes futuros (>= hoje) e já lançados (< hoje)
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

  const query = `
    query ($todayStart: Int, $pastPerPage: Int) {
      upcomingSchedules: Page(page: 1, perPage: 30) {
        airingSchedules(airingAt_greater: $todayStart, sort: [TIME]) {
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
          pastPerPage: Math.min(50, pastPagesCount * 20),
        },
      }),
    });

    if (!response.ok) {
      return { items: fallback, isLive: false };
    }

    const result = await response.json();
    const upcomingScheds = result?.data?.upcomingSchedules?.airingSchedules || [];
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

    const mappedPast = pastScheds
      .map(mapScheduleToItem)
      .filter((x: MediaItem | null): x is MediaItem => Boolean(x));
    const mappedUpcoming = upcomingScheds
      .map(mapScheduleToItem)
      .filter((x: MediaItem | null): x is MediaItem => Boolean(x));

    const combined = deduplicateByExternalId([...mappedPast, ...mappedUpcoming]);
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

  const cinemaUrl = `https://api.themoviedb.org/3/discover/movie?language=pt-BR&region=BR&with_release_type=3|2&primary_release_date.gte=${startDateIso}&primary_release_date.lte=${endDateIso}&sort_by=popularity.desc&page=1${queryParam}`;
  const digitalUrl = `https://api.themoviedb.org/3/discover/movie?language=pt-BR&region=BR&with_release_type=4|6&primary_release_date.gte=${startDateIso}&primary_release_date.lte=${endDateIso}&sort_by=popularity.desc&page=1${queryParam}`;
  const generalMovieUrl = `https://api.themoviedb.org/3/discover/movie?language=pt-BR&primary_release_date.gte=${startDateIso}&primary_release_date.lte=${endDateIso}&sort_by=popularity.desc&page=1${queryParam}`;
  const tvUrl = `https://api.themoviedb.org/3/discover/tv?language=pt-BR&first_air_date.gte=${startDateIso}&first_air_date.lte=${endDateIso}&sort_by=popularity.desc&page=1${queryParam}`;

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
    const [cinemaRes, digitalRes, genMovieRes, tvRes, aniRes] = await Promise.all([
      fetch(cinemaUrl, { headers }).catch(() => null),
      fetch(digitalUrl, { headers }).catch(() => null),
      fetch(generalMovieUrl, { headers }).catch(() => null),
      fetch(tvUrl, { headers }).catch(() => null),
      fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: aniQuery,
          variables: { start: startUnix - 1, end: endUnix + 1 },
        }),
      }).catch(() => null),
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
              m.release_date || startDateIso
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
              m.release_date || startDateIso
            )
          );
        }
      }
    }

    if (genMovieRes && genMovieRes.ok) {
      const data = await genMovieRes.json();
      for (const m of data?.results || []) {
        if (m?.id && m.poster_path) {
          results.push(
            mapTmdbRawMovieToItem(
              m,
              'movie_cinema',
              todayIso,
              m.release_date || startDateIso
            )
          );
        }
      }
    }

    if (tvRes && tvRes.ok) {
      const data = await tvRes.json();
      for (const tv of data?.results || []) {
        if (tv?.id && tv.poster_path) {
          results.push(
            mapTmdbRawTvToItem(tv, tv.first_air_date || startDateIso)
          );
        }
      }
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

    // Inclui também qualquer jogo da RAWG (se a chave estiver configurada) na data selecionada
    if (settings.rawgApiKey?.trim()) {
      try {
        const rawgUrl = `https://api.rawg.io/api/games?key=${encodeURIComponent(
          settings.rawgApiKey.trim()
        )}&dates=${startDateIso},${endDateIso}&ordering=-added&page_size=12`;
        const rawgRes = await fetch(rawgUrl);
        if (rawgRes.ok) {
          const rawgData = await rawgRes.json();
          for (const g of rawgData?.results || []) {
            if (!g?.id) continue;
            results.push({
              id: `rawg-cal-${g.id}`,
              externalId: String(g.id),
              category: 'game',
              title: g.name,
              posterUrl:
                g.background_image ||
                'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=85',
              synopsis: 'Jogo lançado na data selecionada no calendário.',
              genres: (g.genres || []).map((x: { name: string }) => x.name),
              rating: g.rating ? Math.round(g.rating * 20) / 10 : undefined,
              reviewsCount: g.ratings_count || g.added || 1500,
              developer: 'Lançamento Oficial Game',
              platforms: (g.platforms || [])
                .map((p: { platform: { name: string } }) => p.platform?.name)
                .filter(Boolean)
                .slice(0, 4),
              releaseDate: extractIsoDatePart(g.released) || startDateIso,
              hltbLabel: 'Tempo: Aguardando dados',
            });
          }
        }
      } catch {
        // Ignore RAWG error
      }
    }

    // Deduplica por categoria + externalId
    const seen = new Set<string>();
    return results.filter((it) => {
      const k = `${it.category}::${it.externalId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  } catch {
    return [];
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

  return {
    mainHours: null,
    extraHours: null,
    completionistHours: null,
    label: 'Tempo: Aguardando dados',
  };
}

export async function fetchRawgGames(
  settings: AppSettings,
  pastPagesCount = 2
): Promise<{
  items: MediaItem[];
  isLive: boolean;
}> {
  const fallback = getCuratedFallbackData().game;
  if (!settings.rawgApiKey.trim()) {
    return { items: fallback, isLive: false };
  }

  try {
    const todayIso = getLocalIsoDate(0);
    const yesterdayIso = getLocalIsoDate(-1);
    const futureIso = getLocalIsoDate(365);
    const pastStartIso = getLocalIsoDate(-365);

    const upcomingUrl = `https://api.rawg.io/api/games?key=${encodeURIComponent(
      settings.rawgApiKey.trim()
    )}&dates=${todayIso},${futureIso}&ordering=released&page_size=20`;

    const pastUrl = `https://api.rawg.io/api/games?key=${encodeURIComponent(
      settings.rawgApiKey.trim()
    )}&dates=${pastStartIso},${yesterdayIso}&ordering=-released&page_size=${Math.min(
      40,
      pastPagesCount * 15
    )}`;

    const [upRes, pastRes] = await Promise.all([
      fetch(upcomingUrl).catch(() => null),
      fetch(pastUrl).catch(() => null),
    ]);

    const upJson = upRes && upRes.ok ? await upRes.json() : { results: [] };
    const pastJson = pastRes && pastRes.ok ? await pastRes.json() : { results: [] };

    const rawGames = [...(pastJson.results || []), ...(upJson.results || [])].filter(
      (g) => g && g.id && g.released
    );

    if (!rawGames.length) return { items: fallback, isLive: false };

    const games: MediaItem[] = rawGames.map(
      (g: {
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
        const platforms = (g.platforms || [])
          .map((p) => p.platform?.name)
          .filter(Boolean)
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
          synopsis:
            'Acompanhe o lançamento deste título nas principais plataformas de jogos.',
          genres: (g.genres || []).map((gen) => gen.name),
          rating: g.rating ? Math.round(g.rating * 20) / 10 : undefined,
          reviewsCount:
            typeof g.ratings_count === 'number' && g.ratings_count > 0
              ? g.ratings_count
              : g.added || 3900,
          developer: 'Estúdio Oficial',
          platforms: platforms.length ? platforms : ['PC', 'PS5', 'Xbox Series'],
          releaseDate: g.released || null,
          hltbMainHours: null,
          hltbExtraHours: null,
          hltbCompletionistHours: null,
          hltbLabel: 'Tempo: Aguardando dados',
        };
      }
    );

    return {
      items: deduplicateByExternalId(games),
      isLive: true,
    };
  } catch {
    return { items: fallback, isLive: false };
  }
}
