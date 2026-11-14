import { AppSettings, MediaCategory, MediaItem } from '../types/media';
import { DEFAULT_TMDB_API_KEY } from '../lib/settings';
import { formatFullDate, getLocalIsoDate } from '../lib/dateUtils';
import { searchMediaAcrossApis } from './apiService';

export type NewsKind = 'trailer' | 'release_date' | 'portal_news';
export type NewsMediaFilter = 'all' | 'trailer' | 'release_date' | 'movie' | 'tv_anime' | 'game';

export interface NewsArticleItem {
  id: string;
  title: string;
  summary: string;
  kind: NewsKind;
  mediaGroup: 'movie' | 'tv_anime' | 'game';
  categoryLabel: string;
  imageUrl: string;
  publishedAt: string;
  releaseDateLabel?: string;
  youtubeKey?: string;
  externalUrl?: string;
  sourceName: string;
  linkedMediaItem?: MediaItem;
}

export interface AiRecommendationEntry {
  item: MediaItem;
  matchScore: number;
  aiReason: string;
}

export interface AiRecommendationResult {
  aiGreeting: string;
  detectedIntentSummary: string;
  recommendations: AiRecommendationEntry[];
}

function buildTmdbAuth(apiKey: string): {
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

/**
 * Busca Trailers Oficiais (YouTube) e Anúncios de Novas Datas de Filmes, Séries, Animes e Games,
 * além de notícias reais de portais em português sobre datas de estreia e trailers.
 */
export async function fetchEntertainmentNewsAndTrailers(
  settings: AppSettings,
  catalog: Record<MediaCategory, MediaItem[]>
): Promise<NewsArticleItem[]> {
  const apiKey = (settings.tmdbApiKey || DEFAULT_TMDB_API_KEY).trim();
  const { headers, queryParam } = buildTmdbAuth(apiKey);
  const todayIso = getLocalIsoDate(0);

  // 1. Busca trailers e datas de filmes em alta e próximos lançamentos na TMDB
  const fetchMovieTrailersAndDates = async (): Promise<NewsArticleItem[]> => {
    try {
      const [upRes, trendRes] = await Promise.all([
        fetch(
          `https://api.themoviedb.org/3/movie/upcoming?language=pt-BR&region=BR&page=1${queryParam}`,
          { headers }
        ).catch(() => null),
        fetch(
          `https://api.themoviedb.org/3/trending/movie/week?language=pt-BR${queryParam}`,
          { headers }
        ).catch(() => null),
      ]);

      const rawList: Array<{
        id: number;
        title?: string;
        original_title?: string;
        overview?: string;
        poster_path?: string;
        backdrop_path?: string;
        release_date?: string;
        vote_average?: number;
        popularity?: number;
      }> = [];

      for (const r of [upRes, trendRes]) {
        if (r && r.ok) {
          const d = await r.json();
          if (Array.isArray(d?.results)) {
            rawList.push(...d.results);
          }
        }
      }

      const uniqueMovies = Array.from(
        new Map(rawList.filter((m) => m?.id && (m.backdrop_path || m.poster_path)).map((m) => [m.id, m])).values()
      ).slice(0, 14);

      const items = await Promise.all(
        uniqueMovies.map(async (m): Promise<NewsArticleItem | null> => {
          try {
            const vidUrl = `https://api.themoviedb.org/3/movie/${m.id}?language=pt-BR&append_to_response=videos,credits${queryParam}`;
            const vRes = await fetch(vidUrl, { headers });
            let youtubeKey: string | undefined;
            let videoTitle = '';
            let directorStr = 'Direção & Estúdio Oficial';

            if (vRes.ok) {
              const detail = await vRes.json();
              const vids: Array<{
                key?: string;
                site?: string;
                type?: string;
                name?: string;
              }> = detail?.videos?.results || [];

              let chosenVid =
                vids.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ||
                vids.find((v) => v.site === 'YouTube' && v.type === 'Teaser') ||
                vids.find((v) => v.site === 'YouTube');

              // Se não tiver vídeo cadastrado em pt-BR, busca vídeos globais (en-US)
              if (!chosenVid) {
                const enRes = await fetch(
                  `https://api.themoviedb.org/3/movie/${m.id}/videos?language=en-US${queryParam}`,
                  { headers }
                ).catch(() => null);
                if (enRes && enRes.ok) {
                  const enData = await enRes.json();
                  const enVids: Array<{
                    key?: string;
                    site?: string;
                    type?: string;
                    name?: string;
                  }> = enData?.results || [];
                  chosenVid =
                    enVids.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ||
                    enVids.find((v) => v.site === 'YouTube' && v.type === 'Teaser') ||
                    enVids.find((v) => v.site === 'YouTube');
                }
              }

              if (chosenVid?.key) {
                youtubeKey = chosenVid.key;
                videoTitle = chosenVid.name || '';
              }

              const dirs = (detail?.credits?.crew || [])
                .filter((c: { job?: string; name?: string }) => c.job === 'Director' && c.name)
                .slice(0, 2)
                .map((c: { name: string }) => c.name);
              const comp = detail?.production_companies?.[0]?.name;
              if (dirs.length > 0 && comp) directorStr = `${dirs.join(' & ')} (${comp})`;
              else if (dirs.length > 0) directorStr = dirs.join(' & ');
              else if (comp) directorStr = comp;
            }

            const title = m.title || m.original_title || 'Filme';
            const relDate = m.release_date || null;
            const isFuture = Boolean(relDate && relDate >= todayIso);
            const formattedDate = relDate ? formatFullDate(relDate) : 'Data a confirmar';

            const catalogMatch =
              catalog.movie_cinema.find((c) => c.externalId === String(m.id)) ||
              catalog.movie_digital.find((c) => c.externalId === String(m.id));

            const linkedItem: MediaItem = catalogMatch || {
              id: `tmdb-movie_cinema-${m.id}`,
              externalId: String(m.id),
              category: 'movie_cinema',
              title,
              originalTitle: m.original_title,
              posterUrl: m.poster_path
                ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
                : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80',
              backdropUrl: m.backdrop_path
                ? `https://image.tmdb.org/t/p/original${m.backdrop_path}`
                : undefined,
              synopsis: m.overview || 'Lançamento confirmado no circuito brasileiro.',
              genres: ['Cinema'],
              rating: m.vote_average ? Math.round(m.vote_average * 10) / 10 : undefined,
              director: directorStr,
              cinemaReleaseDate: relDate,
            };

            const hasTrailer = Boolean(youtubeKey);
            const headline = hasTrailer
              ? isFuture
                ? `🎬 Novo Trailer Oficial: "${title}" confirma estreia para ${formattedDate}`
                : `🎬 Trailer Oficial divulgado: "${title}" (${videoTitle || 'Vídeo Oficial'})`
              : `📅 Data de Estreia: "${title}" chega ao circuito em ${formattedDate}`;

            const summaryText =
              m.overview && m.overview.trim().length > 0
                ? `${m.overview} • Produção: ${directorStr}.`
                : `A produção "${title}" (${directorStr}) teve seu cronograma atualizado com lançamento previsto para ${formattedDate}.`;

            return {
              id: `news-tmdb-movie-${m.id}`,
              title: headline,
              summary: summaryText,
              kind: hasTrailer ? 'trailer' : 'release_date',
              mediaGroup: 'movie',
              categoryLabel: hasTrailer ? 'Trailer • Filme' : 'Nova Data • Filme',
              imageUrl: m.backdrop_path
                ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}`
                : youtubeKey
                ? `https://img.youtube.com/vi/${youtubeKey}/hqdefault.jpg`
                : `https://image.tmdb.org/t/p/w500${m.poster_path}`,
              publishedAt: relDate || todayIso,
              releaseDateLabel: relDate ? `Estreia: ${formattedDate}` : undefined,
              youtubeKey,
              sourceName: 'TMDB Brasil • Radar Oficial',
              linkedMediaItem: linkedItem,
            };
          } catch {
            return null;
          }
        })
      );

      return items.filter((x): x is NewsArticleItem => Boolean(x));
    } catch {
      return [];
    }
  };

  // 2. Busca trailers e datas de Séries em alta na TMDB
  const fetchTvTrailersAndDates = async (): Promise<NewsArticleItem[]> => {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/trending/tv/week?language=pt-BR${queryParam}`,
        { headers }
      ).catch(() => null);
      if (!res || !res.ok) return [];
      const data = await res.json();
      const rawTv: Array<{
        id: number;
        name?: string;
        original_name?: string;
        overview?: string;
        poster_path?: string;
        backdrop_path?: string;
        first_air_date?: string;
        vote_average?: number;
      }> = (data?.results || []).slice(0, 8);

      const items = await Promise.all(
        rawTv.map(async (tv): Promise<NewsArticleItem | null> => {
          try {
            const vRes = await fetch(
              `https://api.themoviedb.org/3/tv/${tv.id}/videos?language=en-US${queryParam}`,
              { headers }
            ).catch(() => null);
            let youtubeKey: string | undefined;
            if (vRes && vRes.ok) {
              const vData = await vRes.json();
              const vids: Array<{ key?: string; site?: string; type?: string }> =
                vData?.results || [];
              const chosen =
                vids.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ||
                vids.find((v) => v.site === 'YouTube' && v.type === 'Teaser') ||
                vids.find((v) => v.site === 'YouTube');
              if (chosen?.key) youtubeKey = chosen.key;
            }

            const title = tv.name || tv.original_name || 'Série';
            const airDate = tv.first_air_date || null;
            const formattedDate = airDate ? formatFullDate(airDate) : 'Em breve';

            const catalogMatch = catalog.tv.find((c) => c.externalId === String(tv.id));
            const linkedItem: MediaItem = catalogMatch || {
              id: `tmdb-tv-${tv.id}`,
              externalId: String(tv.id),
              category: 'tv',
              title,
              originalTitle: tv.original_name,
              posterUrl: tv.poster_path
                ? `https://image.tmdb.org/t/p/w500${tv.poster_path}`
                : '',
              backdropUrl: tv.backdrop_path
                ? `https://image.tmdb.org/t/p/original${tv.backdrop_path}`
                : undefined,
              synopsis: tv.overview || 'Série em destaque nos streamings do Brasil.',
              genres: ['Série'],
              rating: tv.vote_average ? Math.round(tv.vote_average * 10) / 10 : undefined,
              nextEpisodeDate: airDate,
              nextEpisodeNumber: 1,
            };

            return {
              id: `news-tmdb-tv-${tv.id}`,
              title: youtubeKey
                ? `📺 Trailer Oficial liberado para a série "${title}"`
                : `📅 Cronograma de Série: "${title}" em destaque (${formattedDate})`,
              summary:
                tv.overview ||
                `Confira o anúncio e os detalhes atualizados dos episódios de "${title}".`,
              kind: youtubeKey ? 'trailer' : 'release_date',
              mediaGroup: 'tv_anime',
              categoryLabel: youtubeKey ? 'Trailer • Série' : 'Data • Série',
              imageUrl: tv.backdrop_path
                ? `https://image.tmdb.org/t/p/w780${tv.backdrop_path}`
                : youtubeKey
                ? `https://img.youtube.com/vi/${youtubeKey}/hqdefault.jpg`
                : `https://image.tmdb.org/t/p/w500${tv.poster_path}`,
              publishedAt: airDate || todayIso,
              releaseDateLabel: airDate ? `Lançamento: ${formattedDate}` : undefined,
              youtubeKey,
              sourceName: 'TMDB Series • Streaming BR',
              linkedMediaItem: linkedItem,
            };
          } catch {
            return null;
          }
        })
      );

      return items.filter((x): x is NewsArticleItem => Boolean(x));
    } catch {
      return [];
    }
  };

  // 3. Busca trailers e novas datas de Animes na AniList GraphQL
  const fetchAnimeTrailersAndDates = async (): Promise<NewsArticleItem[]> => {
    const query = `
      query {
        Page(page: 1, perPage: 10) {
          media(type: ANIME, isAdult: false, status_in: [NOT_YET_RELEASED, RELEASING], sort: [TRENDING_DESC, POPULARITY_DESC]) {
            id
            title { romaji english native }
            coverImage { extraLarge large }
            bannerImage
            description(asHtml: false)
            genres
            averageScore
            startDate { year month day }
            trailer { id site thumbnail }
            studios(isMain: true) { nodes { name } }
          }
        }
      }
    `;
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const mediaList = data?.data?.Page?.media || [];

      return mediaList
        .map(
          (anime: {
            id: number;
            title?: { english?: string; romaji?: string; native?: string };
            coverImage?: { extraLarge?: string; large?: string };
            bannerImage?: string;
            description?: string;
            genres?: string[];
            averageScore?: number;
            startDate?: { year?: number; month?: number; day?: number };
            trailer?: { id?: string; site?: string; thumbnail?: string };
            studios?: { nodes?: Array<{ name: string }> };
          }): NewsArticleItem | null => {
            const title = anime.title?.english || anime.title?.romaji || 'Anime';
            const ytKey =
              anime.trailer?.site?.toLowerCase() === 'youtube'
                ? anime.trailer.id
                : undefined;

            let dateIso: string | null = null;
            if (anime.startDate?.year && anime.startDate?.month) {
              const y = anime.startDate.year;
              const m = String(anime.startDate.month).padStart(2, '0');
              const d = String(anime.startDate.day || 1).padStart(2, '0');
              dateIso = `${y}-${m}-${d}`;
            }

            if (!ytKey && !dateIso) return null;

            const cleanDesc = (anime.description || '')
              .replace(/<[^>]*>/g, '')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .trim();

            const studio = anime.studios?.nodes?.[0]?.name || 'Animação Japonesa';
            const formattedDate = dateIso ? formatFullDate(dateIso) : 'Temporada Confirmada';

            const catalogMatch = catalog.anime.find(
              (c) => c.externalId === String(anime.id)
            );

            const linkedItem: MediaItem = catalogMatch || {
              id: `anilist-news-${anime.id}`,
              externalId: String(anime.id),
              category: 'anime',
              title,
              originalTitle: anime.title?.native || anime.title?.romaji,
              posterUrl: anime.coverImage?.extraLarge || anime.coverImage?.large || '',
              backdropUrl: anime.bannerImage || undefined,
              synopsis: cleanDesc || 'Novo anime confirmado no calendário oficial.',
              genres: anime.genres?.slice(0, 3) || ['Anime'],
              rating: anime.averageScore
                ? Math.round((anime.averageScore / 10) * 10) / 10
                : undefined,
              studioOrNetwork: `Estúdio ${studio}`,
              nextEpisodeDate: dateIso,
              nextEpisodeNumber: 1,
            };

            return {
              id: `news-anime-${anime.id}`,
              title: ytKey
                ? `🔥 Trailer Oficial de Anime: "${title}" (Estúdio ${studio})`
                : `📅 Nova Data de Anime: "${title}" confirmado para ${formattedDate}`,
              summary:
                cleanDesc ||
                `O estúdio ${studio} divulgou novidades oficiais sobre a estreia de "${title}".`,
              kind: ytKey ? 'trailer' : 'release_date',
              mediaGroup: 'tv_anime',
              categoryLabel: ytKey ? 'Trailer • Anime' : 'Data • Anime',
              imageUrl:
                anime.bannerImage ||
                anime.trailer?.thumbnail ||
                anime.coverImage?.extraLarge ||
                '',
              publishedAt: dateIso || todayIso,
              releaseDateLabel: dateIso ? `Estreia: ${formattedDate}` : undefined,
              youtubeKey: ytKey,
              sourceName: 'AniList • Radar Oficial',
              linkedMediaItem: linkedItem,
            };
          }
        )
        .filter((x: NewsArticleItem | null): x is NewsArticleItem => Boolean(x));
    } catch {
      return [];
    }
  };

  // 4. Anúncios de Datas Confirmadas de Games (Twitch / IGDB)
  const buildGameReleaseNews = (): NewsArticleItem[] => {
    const upcomingGames = catalog.game
      .filter((g) => g.releaseDate && g.releaseDate >= todayIso)
      .slice(0, 10);

    return upcomingGames.map((g) => {
      const formattedDate = g.releaseDate
        ? formatFullDate(g.releaseDate)
        : 'Em breve';
      const platList = (g.platforms || ['PC', 'PS5', 'Xbox Series']).join(', ');

      return {
        id: `news-game-${g.externalId}`,
        title: `🎮 Lançamento Confirmado: "${g.title}" chega em ${formattedDate} para ${platList}`,
        summary: `${g.synopsis} • Desenvolvedora: ${
          g.developer || 'Estúdio Oficial'
        }. ${g.hltbLabel ? `Campanha estimada: ${g.hltbLabel}.` : ''}`,
        kind: 'release_date',
        mediaGroup: 'game',
        categoryLabel: 'Nova Data • Game',
        imageUrl: g.backdropUrl || g.posterUrl,
        publishedAt: g.releaseDate || todayIso,
        releaseDateLabel: `Lançamento: ${formattedDate}`,
        sourceName: 'Twitch / IGDB • Calendário Oficial',
        linkedMediaItem: g,
      };
    });
  };

  // 5. Notícias em tempo real de portais brasileiros sobre novos trailers e datas (via RSS2JSON)
  const fetchLivePortalNewsPtBr = async (): Promise<NewsArticleItem[]> => {
    try {
      const rssUrl =
        'https://news.google.com/rss/search?q=(trailer+OR+%22data+de+estreia%22+OR+%22data+de+lan%C3%A7amento%22)+(filme+OR+s%C3%A9rie+OR+jogo+OR+anime)&hl=pt-BR&gl=BR&ceid=BR:pt-419';
      const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(
        rssUrl
      )}`;
      const res = await fetch(apiUrl).catch(() => null);
      if (!res || !res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data?.items)) return [];

      return data.items.slice(0, 8).map(
        (
          it: {
            title?: string;
            description?: string;
            link?: string;
            pubDate?: string;
            thumbnail?: string;
          },
          idx: number
        ): NewsArticleItem => {
          const rawTitle = (it.title || 'Notícia de Entretenimento').trim();
          const lower = rawTitle.toLowerCase();
          const isTrailer = lower.includes('trailer') || lower.includes('teaser');
          const isGame =
            lower.includes('jogo') ||
            lower.includes('game') ||
            lower.includes('ps5') ||
            lower.includes('xbox') ||
            lower.includes('nintendo') ||
            lower.includes('steam');
          const isTvOrAnime =
            lower.includes('série') ||
            lower.includes('temporada') ||
            lower.includes('anime') ||
            lower.includes('netflix') ||
            lower.includes('hbo') ||
            lower.includes('prime video');

          const mediaGroup: 'movie' | 'tv_anime' | 'game' = isGame
            ? 'game'
            : isTvOrAnime
            ? 'tv_anime'
            : 'movie';

          const cleanDesc = (it.description || '')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .trim();

          return {
            id: `news-portal-${idx}-${rawTitle.slice(0, 20)}`,
            title: rawTitle,
            summary:
              cleanDesc && cleanDesc.length > 20
                ? cleanDesc
                : 'Confira os detalhes sobre a nova data de estreia e o anúncio oficial divulgado pela imprensa.',
            kind: isTrailer ? 'trailer' : 'portal_news',
            mediaGroup,
            categoryLabel: isTrailer ? 'Notícia • Trailer' : 'Notícia • Data & Anúncio',
            imageUrl:
              it.thumbnail ||
              (isGame
                ? 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80'
                : isTvOrAnime
                ? 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=800&q=80'
                : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80'),
            publishedAt: it.pubDate ? it.pubDate.slice(0, 10) : todayIso,
            externalUrl: it.link,
            sourceName: 'Imprensa Brasil • Tempo Real',
          };
        }
      );
    } catch {
      return [];
    }
  };

  const [movieNews, tvNews, animeNews, portalNews] = await Promise.all([
    fetchMovieTrailersAndDates(),
    fetchTvTrailersAndDates(),
    fetchAnimeTrailersAndDates(),
    fetchLivePortalNewsPtBr(),
  ]);

  const gameNews = buildGameReleaseNews();

  // Intercala as fontes para um feed rico (priorizando itens com Trailer Oficial do YouTube no topo)
  const all = [...movieNews, ...tvNews, ...animeNews, ...gameNews, ...portalNews];
  all.sort((a, b) => {
    const aHasYt = a.youtubeKey ? 1 : 0;
    const bHasYt = b.youtubeKey ? 1 : 0;
    if (aHasYt !== bHasYt) return bHasYt - aHasYt;
    return (b.publishedAt || '').localeCompare(a.publishedAt || '');
  });

  return all;
}

// ============================================================================
// MOTOR DE IA DE RECOMENDAÇÃO ("DESCUBRA" • ALINE ÍGENA IA)
// ============================================================================

interface KeywordRule {
  keywords: string[];
  genres: string[];
  tmdbMovieGenreIds: number[];
  tmdbTvGenreIds: number[];
  anilistGenres: string[];
  label: string;
}

const THEME_RULES: KeywordRule[] = [
  {
    keywords: [
      'sci-fi',
      'ficção',
      'ficcao',
      'espacial',
      'espaço',
      'futuro',
      'cyberpunk',
      'alien',
      'viagem no tempo',
      'distopia',
      'robô',
      'duna',
      'interestelar',
    ],
    genres: ['Sci-Fi', 'Sci-Fi & Fantasia'],
    tmdbMovieGenreIds: [878],
    tmdbTvGenreIds: [10765],
    anilistGenres: ['Sci-Fi', 'Mecha'],
    label: 'Ficção Científica & Cosmos',
  },
  {
    keywords: [
      'terror',
      'horror',
      'medo',
      'assustador',
      'sobrenatural',
      'zumbi',
      'monstro',
      'macabro',
      'sombrio',
      'dark',
    ],
    genres: ['Terror', 'Mistério', 'Suspense'],
    tmdbMovieGenreIds: [27, 53],
    tmdbTvGenreIds: [9648],
    anilistGenres: ['Horror', 'Supernatural', 'Psychological'],
    label: 'Terror & Sobrenatural',
  },
  {
    keywords: [
      'suspense',
      'mistério',
      'misterio',
      'investigação',
      'investigacao',
      'detetive',
      'crime',
      'policial',
      'thriller',
      'plot twist',
      'mente',
      'psicológico',
    ],
    genres: ['Suspense', 'Mistério', 'Crime'],
    tmdbMovieGenreIds: [53, 9648, 80],
    tmdbTvGenreIds: [9648, 80],
    anilistGenres: ['Mystery', 'Psychological', 'Thriller'],
    label: 'Suspense, Crime & Mistério',
  },
  {
    keywords: [
      'ação',
      'acao',
      'adrenalina',
      'luta',
      'combate',
      'tiro',
      'shooter',
      'explosão',
      'frenético',
      'porradaria',
      'guerra',
      'batalha',
    ],
    genres: ['Ação', 'Ação & Aventura', 'Tiro / Shooter', 'Luta', 'Hack and Slash'],
    tmdbMovieGenreIds: [28, 10752],
    tmdbTvGenreIds: [10759],
    anilistGenres: ['Action'],
    label: 'Ação & Adrenalina',
  },
  {
    keywords: [
      'aventura',
      'exploração',
      'mundo aberto',
      'jornada',
      'épico',
      'epico',
      'sobrevivência',
    ],
    genres: ['Aventura', 'Ação & Aventura'],
    tmdbMovieGenreIds: [12],
    tmdbTvGenreIds: [10759],
    anilistGenres: ['Adventure'],
    label: 'Aventura & Exploração',
  },
  {
    keywords: [
      'fantasia',
      'magia',
      'medieval',
      'dragão',
      'dragao',
      'isekai',
      'mitologia',
      'poderes',
    ],
    genres: ['Fantasia', 'Sci-Fi & Fantasia', 'RPG'],
    tmdbMovieGenreIds: [14],
    tmdbTvGenreIds: [10765],
    anilistGenres: ['Fantasy', 'Supernatural'],
    label: 'Fantasia & Mundos Mágicos',
  },
  {
    keywords: ['rpg', 'soulslike', 'campanha longa', 'história rica', 'zerar', 'level'],
    genres: ['RPG', 'Aventura', 'Estratégia'],
    tmdbMovieGenreIds: [14, 12],
    tmdbTvGenreIds: [10765],
    anilistGenres: ['Fantasy', 'Adventure'],
    label: 'RPG & Narrativa Profunda',
  },
  {
    keywords: [
      'comédia',
      'comedia',
      'engraçado',
      'rir',
      'leve',
      'divertido',
      'humor',
      'família',
    ],
    genres: ['Comédia', 'Família', 'Animação'],
    tmdbMovieGenreIds: [35, 10751],
    tmdbTvGenreIds: [35],
    anilistGenres: ['Comedy', 'Slice of Life'],
    label: 'Comédia & Diversão Leve',
  },
  {
    keywords: [
      'drama',
      'emocionante',
      'chorar',
      'realista',
      'profundo',
      'história real',
      'biografia',
    ],
    genres: ['Drama', 'História'],
    tmdbMovieGenreIds: [18, 36],
    tmdbTvGenreIds: [18],
    anilistGenres: ['Drama'],
    label: 'Drama & Emoção',
  },
  {
    keywords: ['romance', 'amor', 'casal', 'romântico', 'romantico', 'apaixonante'],
    genres: ['Romance', 'Drama'],
    tmdbMovieGenreIds: [10749],
    tmdbTvGenreIds: [18],
    anilistGenres: ['Romance', 'Drama'],
    label: 'Romance & Relacionamentos',
  },
];

export async function generateAiRecommendations(
  userPrompt: string,
  targetFilter: 'all' | 'movie' | 'tv' | 'anime' | 'game',
  settings: AppSettings,
  catalog: Record<MediaCategory, MediaItem[]>,
  favorites: MediaItem[]
): Promise<AiRecommendationResult> {
  const cleanPrompt = userPrompt.trim();
  const lower = cleanPrompt.toLowerCase();

  // 1. Detecta tipo(s) de mídia desejados pelo texto ou pelo botão de filtro
  let wantMovie = targetFilter === 'all' || targetFilter === 'movie';
  let wantTv = targetFilter === 'all' || targetFilter === 'tv';
  let wantAnime = targetFilter === 'all' || targetFilter === 'anime';
  let wantGame = targetFilter === 'all' || targetFilter === 'game';

  if (targetFilter === 'all') {
    const mentionsMovie = /\b(filme|filmes|cinema|longa)\b/i.test(lower);
    const mentionsTv = /\b(série|serie|séries|series|maratonar|temporada)\b/i.test(lower);
    const mentionsAnime = /\b(anime|animes|otaku|mangá|shonen|isekai)\b/i.test(lower);
    const mentionsGame = /\b(jogo|jogos|game|games|jogar|gameplay|ps5|xbox|pc|steam|rpg)\b/i.test(
      lower
    );

    if (mentionsMovie || mentionsTv || mentionsAnime || mentionsGame) {
      wantMovie = mentionsMovie;
      wantTv = mentionsTv;
      wantAnime = mentionsAnime;
      wantGame = mentionsGame;
    }
  }

  // 2. Detecta plataformas de streaming citadas
  const wantedPlatforms: string[] = [];
  if (lower.includes('netflix')) wantedPlatforms.push('Netflix');
  if (lower.includes('prime') || lower.includes('amazon'))
    wantedPlatforms.push('Amazon Prime');
  if (lower.includes('hbo') || lower.includes('max')) wantedPlatforms.push('HBO Max');
  if (lower.includes('globoplay')) wantedPlatforms.push('Globoplay');
  if (lower.includes('disney')) wantedPlatforms.push('Disney+');
  if (lower.includes('telecine')) wantedPlatforms.push('Telecine');

  // 3. Detecta temas/gêneros pedidos (ou usa o perfil dos Abduzidos se pedir "baseado nos meus abduzidos")
  const matchedThemes = THEME_RULES.filter((rule) =>
    rule.keywords.some((kw) => lower.includes(kw))
  );

  const isBasedOnFavorites =
    lower.includes('abduzido') ||
    lower.includes('meu gosto') ||
    lower.includes('meus favoritos') ||
    lower.includes('minha lista');

  if (isBasedOnFavorites && favorites.length > 0 && matchedThemes.length === 0) {
    const favGenres = new Set(favorites.flatMap((f) => f.genres));
    for (const rule of THEME_RULES) {
      if (rule.genres.some((g) => favGenres.has(g))) {
        matchedThemes.push(rule);
      }
    }
  }

  // 4. Verifica se o usuário citou alguma obra de referência (ex: "tipo Duna", "parecido com Interestelar", "estilo The Last of Us")
  let referenceQuery = '';
  const refMatch = cleanPrompt.match(
    /(?:tipo|parecido com|estilo|como|igual a|igual|semelhante a|fã de)\s+["']?([^,.?!;]+)["']?/i
  );
  if (refMatch && refMatch[1]) {
    referenceQuery = refMatch[1].trim();
  }

  // 5. Busca obras ao vivo nas APIs caso haja referência ou palavras específicas
  let liveSearchedItems: MediaItem[] = [];
  const searchTerm =
    referenceQuery ||
    cleanPrompt
      .replace(
        /\b(quero|me|recomenda|recomende|indica|indique|assistir|jogar|um|uma|de|com|na|no|para|que|seja|muito|bom|boa|filme|filmes|série|serie|séries|jogo|jogos|game|anime|animes)\b/gi,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim();

  if (searchTerm.length >= 3) {
    try {
      liveSearchedItems = await searchMediaAcrossApis(searchTerm.slice(0, 40), settings);
    } catch {
      // Ignore
    }
  }

  // 6. Também busca recomendações diretas da TMDB (por obra de referência E por gêneros pedidos)
  const tmdbSimilarItems: MediaItem[] = [];
  if (wantMovie || wantTv) {
    try {
      const apiKey = (settings.tmdbApiKey || DEFAULT_TMDB_API_KEY).trim();
      const { headers, queryParam } = buildTmdbAuth(apiKey);

      const movieGenreIds = Array.from(
        new Set(matchedThemes.flatMap((t) => t.tmdbMovieGenreIds))
      ).join(',');
      const tvGenreIds = Array.from(
        new Set(matchedThemes.flatMap((t) => t.tmdbTvGenreIds))
      ).join(',');

      const genreDiscoverPromises: Promise<Response | null>[] = [];
      if (wantMovie && movieGenreIds) {
        genreDiscoverPromises.push(
          fetch(
            `https://api.themoviedb.org/3/discover/movie?language=pt-BR&region=BR&with_genres=${movieGenreIds}&sort_by=popularity.desc&vote_count.gte=50&page=1${queryParam}`,
            { headers }
          ).catch(() => null)
        );
      }
      if (wantTv && tvGenreIds) {
        genreDiscoverPromises.push(
          fetch(
            `https://api.themoviedb.org/3/discover/tv?language=pt-BR&watch_region=BR&with_watch_providers=8|119|1899|384|307|337|227&with_genres=${tvGenreIds}&sort_by=popularity.desc&vote_count.gte=30&page=1${queryParam}`,
            { headers }
          ).catch(() => null)
        );
      }

      const genreResList = await Promise.all(genreDiscoverPromises);
      for (const gRes of genreResList) {
        if (gRes && gRes.ok) {
          const gData = await gRes.json();
          for (const r of (gData?.results || []).slice(0, 8)) {
            if (!r?.id || !r.poster_path) continue;
            const isTvItem = Boolean(r.name || r.first_air_date);
            const matchedLabels = matchedThemes.flatMap((t) => t.genres).slice(0, 2);
            if (isTvItem) {
              tmdbSimilarItems.push({
                id: `tmdb-disc-tv-${r.id}`,
                externalId: String(r.id),
                category: 'tv',
                title: r.name || r.original_name || 'Série',
                originalTitle: r.original_name,
                posterUrl: `https://image.tmdb.org/t/p/w500${r.poster_path}`,
                backdropUrl: r.backdrop_path
                  ? `https://image.tmdb.org/t/p/original${r.backdrop_path}`
                  : undefined,
                synopsis: r.overview || 'Série selecionada pela IA no catálogo brasileiro.',
                genres: matchedLabels.length > 0 ? matchedLabels : ['Série'],
                rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : undefined,
                nextEpisodeDate: r.first_air_date || null,
                nextEpisodeNumber: 1,
              });
            } else {
              tmdbSimilarItems.push({
                id: `tmdb-disc-movie-${r.id}`,
                externalId: String(r.id),
                category: 'movie_cinema',
                title: r.title || r.original_title || 'Filme',
                originalTitle: r.original_title,
                posterUrl: `https://image.tmdb.org/t/p/w500${r.poster_path}`,
                backdropUrl: r.backdrop_path
                  ? `https://image.tmdb.org/t/p/original${r.backdrop_path}`
                  : undefined,
                synopsis: r.overview || 'Filme selecionado pela IA no circuito brasileiro.',
                genres: matchedLabels.length > 0 ? matchedLabels : ['Cinema'],
                rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : undefined,
                cinemaReleaseDate: r.release_date || null,
              });
            }
          }
        }
      }

      if (referenceQuery) {
        const refItem = liveSearchedItems.find(
          (it) =>
            it.category === 'movie_cinema' ||
            it.category === 'movie_digital' ||
            it.category === 'tv'
        );
        if (refItem) {
          const endpoint = refItem.category === 'tv' ? 'tv' : 'movie';
          const recUrl = `https://api.themoviedb.org/3/${endpoint}/${refItem.externalId}/recommendations?language=pt-BR&page=1${queryParam}`;
          const recRes = await fetch(recUrl, { headers }).catch(() => null);
          if (recRes && recRes.ok) {
            const recData = await recRes.json();
            for (const r of (recData?.results || []).slice(0, 6)) {
              if (!r?.id || !r.poster_path) continue;
              if (endpoint === 'tv') {
                tmdbSimilarItems.push({
                  id: `tmdb-rec-tv-${r.id}`,
                  externalId: String(r.id),
                  category: 'tv',
                  title: r.name || r.original_name || 'Série',
                  originalTitle: r.original_name,
                  posterUrl: `https://image.tmdb.org/t/p/w500${r.poster_path}`,
                  backdropUrl: r.backdrop_path
                    ? `https://image.tmdb.org/t/p/original${r.backdrop_path}`
                    : undefined,
                  synopsis: r.overview || 'Série recomendada pelo motor de similaridade.',
                  genres: ['Série Recomendada'],
                  rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : undefined,
                  nextEpisodeDate: r.first_air_date || null,
                  nextEpisodeNumber: 1,
                });
              } else {
                tmdbSimilarItems.push({
                  id: `tmdb-rec-movie-${r.id}`,
                  externalId: String(r.id),
                  category: 'movie_cinema',
                  title: r.title || r.original_title || 'Filme',
                  originalTitle: r.original_title,
                  posterUrl: `https://image.tmdb.org/t/p/w500${r.poster_path}`,
                  backdropUrl: r.backdrop_path
                    ? `https://image.tmdb.org/t/p/original${r.backdrop_path}`
                    : undefined,
                  synopsis: r.overview || 'Filme recomendado pelo motor de similaridade.',
                  genres: ['Filme Recomendado'],
                  rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : undefined,
                  cinemaReleaseDate: r.release_date || null,
                });
              }
            }
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  // 7. Reúne todos os candidatos do catálogo + buscas ao vivo + recomendações similares
  const candidatePool: MediaItem[] = [
    ...tmdbSimilarItems,
    ...liveSearchedItems,
    ...(wantMovie ? [...catalog.movie_cinema, ...catalog.movie_digital] : []),
    ...(wantTv ? catalog.tv : []),
    ...(wantAnime ? catalog.anime : []),
    ...(wantGame ? catalog.game : []),
  ];

  // Filtra pelo tipo de mídia selecionado
  const validCandidates = candidatePool.filter((it) => {
    if (targetFilter === 'movie')
      return it.category === 'movie_cinema' || it.category === 'movie_digital';
    if (targetFilter === 'tv') return it.category === 'tv';
    if (targetFilter === 'anime') return it.category === 'anime';
    if (targetFilter === 'game') return it.category === 'game';
    return (
      (wantMovie && (it.category === 'movie_cinema' || it.category === 'movie_digital')) ||
      (wantTv && it.category === 'tv') ||
      (wantAnime && it.category === 'anime') ||
      (wantGame && it.category === 'game')
    );
  });

  // Deduplica candidatos
  const uniqueMap = new Map<string, MediaItem>();
  for (const it of validCandidates) {
    const key = `${it.category}::${it.externalId}`;
    if (!uniqueMap.has(key) && it.posterUrl) {
      uniqueMap.set(key, it);
    }
  }

  const wantedGenreSet = new Set(matchedThemes.flatMap((t) => t.genres));
  const promptTokens = lower
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !['quero', 'para', 'como', 'uma', 'uns', 'umas', 'tipo', 'algo'].includes(w));

  // 8. Calcula pontuação de relevância semântica para cada candidato
  const scored: Array<{ item: MediaItem; score: number; matchedReasons: string[] }> = [];

  for (const item of uniqueMap.values()) {
    let score = 60;
    const reasons: string[] = [];

    // Bônus se veio de similaridade direta da TMDB
    if (item.id.startsWith('tmdb-rec-')) {
      score += 28;
      reasons.push(
        referenceQuery
          ? `Possui forte conexão temática e narrativa com "${referenceQuery}"`
          : 'Altíssima afinidade direta no radar de recomendações'
      );
    }

    // Bônus por gêneros compatíveis
    const matchingGenres = item.genres.filter((g) => wantedGenreSet.has(g));
    if (matchingGenres.length > 0) {
      score += matchingGenres.length * 14;
      reasons.push(`Combina perfeitamente com os gêneros ${matchingGenres.join(' e ')}`);
    }

    // Bônus por plataforma de streaming pedida
    if (wantedPlatforms.length > 0) {
      const matchingPlat = (item.streamingPlatforms || []).filter((p) =>
        wantedPlatforms.includes(p)
      );
      if (matchingPlat.length > 0) {
        score += 22;
        reasons.push(`Disponível exatamente no catálogo da ${matchingPlat.join(' / ')}`);
      } else {
        score -= 15;
      }
    }

    // Bônus por palavras-chave na sinopse, título, diretor ou estúdio
    const textBlob = [
      item.title,
      item.originalTitle || '',
      item.synopsis || '',
      item.director || '',
      item.developer || '',
      item.studioOrNetwork || '',
      ...(item.genres || []),
    ]
      .join(' ')
      .toLowerCase();

    let tokenHits = 0;
    for (const tok of promptTokens) {
      if (textBlob.includes(tok)) {
        tokenHits++;
      }
    }
    if (tokenHits > 0) {
      score += Math.min(28, tokenHits * 9);
      reasons.push('A sinopse e ambientação batem diretamente com o que você descreveu');
    }

    // Bônus por nota/avaliação alta
    if (item.rating && item.rating >= 7.5) {
      score += 8;
      reasons.push(`Aclamação do público com nota ${item.rating.toFixed(1)}/10`);
    }

    scored.push({
      item,
      score,
      matchedReasons: reasons,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const topPicks = scored.slice(0, 8);

  const themeSummary =
    matchedThemes.length > 0
      ? matchedThemes.map((t) => t.label).join(' + ')
      : isBasedOnFavorites
      ? 'Perfil Cósmico dos seus Abduzidos'
      : 'Curadoria Personalizada Multi-Mídia';

  const recommendations: AiRecommendationEntry[] = topPicks.map((entry, idx) => {
    const clampedScore = Math.min(99, Math.max(82, Math.round(entry.score) - idx * 2));
    const categoryPt =
      entry.item.category === 'movie_cinema' || entry.item.category === 'movie_digital'
        ? 'Filme'
        : entry.item.category === 'tv'
        ? 'Série'
        : entry.item.category === 'anime'
        ? 'Anime'
        : 'Game';

    const defaultReason =
      entry.matchedReasons.length > 0
        ? `${entry.matchedReasons.join(' • ')}. Uma escolha certeira de ${categoryPt.toLowerCase()} dentro de ${themeSummary}.`
        : `${categoryPt} em destaque com excelente recepção e atmosfera alinhada ao seu pedido.`;

    return {
      item: entry.item,
      matchScore: clampedScore,
      aiReason: defaultReason,
    };
  });

  const defaultGreeting = `🛸 **Transmissão da Aline Ígena recebida!** Vasculhei os radares da TMDB, AniList e Twitch/IGDB para o seu pedido (*"${cleanPrompt}"*) e selecionei as **${recommendations.length} melhores recomendações** alinhadas com **${themeSummary}**:`;

  return {
    aiGreeting: defaultGreeting,
    detectedIntentSummary: themeSummary,
    recommendations,
  };
}
