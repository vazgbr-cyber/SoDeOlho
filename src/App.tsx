import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  History,
  LayoutGrid,
  List,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { AppSettings, MediaCategory, MediaItem, TabId, ViewMode } from './types/media';
import { getCuratedFallbackData } from './data/curatedFallbackData';
import { loadSettings, saveSettings } from './lib/settings';
import {
  extractIsoDatePart,
  getItemPrimaryDateString,
  getItemReleaseTimestamp,
  getOneYearFromTodayTimestamp,
  getTodayStartTimestamp,
  isFromTodayOnwards,
} from './lib/dateUtils';
import {
  fetchAniListAnimes,
  fetchMediaByCalendarDate,
  fetchRawgGames,
  fetchTmdbMovies,
  fetchTmdbSeries,
  searchMediaAcrossApis,
} from './services/apiService';
import {
  fetchSupabaseFavorites,
  loadLocalFavorites,
  saveLocalFavorites,
  syncFavoriteWithSupabase,
} from './services/favoritesService';
import { AeroBackground } from './components/AeroBackground';
import { AeroSidebar } from './components/AeroSidebar';
import { MediaListRow } from './components/MediaListRow';
import { MediaCard } from './components/MediaCard';
import { MediaDetailsModal } from './components/MediaDetailsModal';
import { SettingsModal } from './components/SettingsModal';
import {
  CalendarDateFilter,
  TimelineCalendarPopover,
} from './components/TimelineCalendarPopover';
import { AbductedTimelineView } from './components/AbductedTimelineView';
import { HomeAlineShowcase } from './components/HomeAlineShowcase';

const SECTION_TITLES: Record<TabId, { title: string; subtitle: string }> = {
  home: {
    title: 'Descobrir',
    subtitle: 'Transmissão intergaláctica recebida. Exibindo lançamentos da data atual para frente.',
  },
  favorites: {
    title: 'Abduzidos',
    subtitle: 'Cronograma unificado das mídias abduzidas, ordenado pelo lançamento ou episódio mais próximo.',
  },
  movie_cinema: {
    title: 'Filmes • Cinema (Brasil)',
    subtitle: 'Próximos lançamentos e filmes em cartaz nos cinemas do Brasil em ordem de estreia.',
  },
  movie_digital: {
    title: 'Filmes • Digital & Streaming (Brasil)',
    subtitle: 'Filmes disponíveis ou chegando na Netflix, Prime Video, HBO Max, Globoplay, Disney+, Telecine e VOD no Brasil.',
  },
  tv: {
    title: 'Séries • Streaming Brasil',
    subtitle: 'Estreias na Netflix, Amazon Prime, HBO Max, Globoplay, Disney+ e Telecine no Brasil.',
  },
  anime: {
    title: 'Animes',
    subtitle: 'Animes da temporada atual e próximos episódios em simulcast.',
  },
  game: {
    title: 'Games',
    subtitle: 'Calendário de lançamentos de jogos + tempo estimado de campanha.',
  },
};

const PAST_BATCH_SIZE = 10;

export function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [abductedTimelineMode, setAbductedTimelineMode] = useState<boolean>(false);

  const [catalog, setCatalog] = useState<Record<MediaCategory, MediaItem[]>>(() =>
    getCuratedFallbackData()
  );

  const [favorites, setFavorites] = useState<MediaItem[]>(() => {
    const saved = loadLocalFavorites();
    if (saved.length > 0) return saved;
    const initial = getCuratedFallbackData();
    return [
      initial.tv[2],
      initial.movie_cinema[3],
      initial.tv[3],
      initial.game[3],
      initial.movie_cinema[5],
    ];
  });

  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('TODOS');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Paginação cronológica de mídias lançadas anteriormente (10 em 10)
  const [visiblePastCount, setVisiblePastCount] = useState<number>(0);
  const [pastApiPages, setPastApiPages] = useState<number>(2);
  const [isLoadingMorePast, setIsLoadingMorePast] = useState<boolean>(false);

  // Filtro de data pelo Calendário
  const [activeDateFilter, setActiveDateFilter] = useState<CalendarDateFilter | null>(null);
  const [calendarFetchedItems, setCalendarFetchedItems] = useState<MediaItem[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState<boolean>(false);

  // Resultados de pesquisa ao vivo em toda a API (TMDB, AniList, Twitch/IGDB)
  const [apiSearchResults, setApiSearchResults] = useState<MediaItem[]>([]);
  const [isSearchingApis, setIsSearchingApis] = useState<boolean>(false);

  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const todayMarkerRef = useRef<HTMLDivElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const loadAllCategories = useCallback(
    async (activeSettings: AppSettings, pastPagesToFetch = 2) => {
      setIsLoading(true);
      try {
        const [moviesRes, seriesRes, animeRes, gamesRes, supaFavs] = await Promise.all([
          fetchTmdbMovies(activeSettings, pastPagesToFetch),
          fetchTmdbSeries(activeSettings, pastPagesToFetch),
          fetchAniListAnimes(pastPagesToFetch),
          fetchRawgGames(activeSettings, pastPagesToFetch),
          fetchSupabaseFavorites(activeSettings),
        ]);

        setCatalog({
          movie_cinema: moviesRes.cinema,
          movie_digital: moviesRes.digital,
          tv: seriesRes.items,
          anime: animeRes.items,
          game: gamesRes.items,
        });

        if (supaFavs && supaFavs.length > 0) {
          setFavorites(supaFavs);
          saveLocalFavorites(supaFavs);
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadAllCategories(settings, 2);
  }, [settings, loadAllCategories]);

  // Pesquisa global sob demanda nas APIs quando o usuário digita na busca
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setApiSearchResults([]);
      setIsSearchingApis(false);
      return;
    }

    let cancelled = false;
    setIsSearchingApis(true);

    const timer = setTimeout(async () => {
      try {
        const results = await searchMediaAcrossApis(q, settings);
        if (!cancelled) {
          setApiSearchResults(results);
        }
      } finally {
        if (!cancelled) {
          setIsSearchingApis(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, settings]);

  const isItemFavorite = useCallback(
    (item: MediaItem) => {
      return favorites.some(
        (f) => f.externalId === item.externalId && f.category === item.category
      );
    },
    [favorites]
  );

  const handleToggleFavorite = useCallback(
    async (item: MediaItem, e: React.MouseEvent) => {
      e.stopPropagation();
      const exists = favorites.some(
        (f) => f.externalId === item.externalId && f.category === item.category
      );

      const updated = exists
        ? favorites.filter(
            (f) => !(f.externalId === item.externalId && f.category === item.category)
          )
        : [...favorites, item];

      setFavorites(updated);
      saveLocalFavorites(updated);

      if (exists) {
        showToast(`🛸 Partícula devolvida (removido dos Abduzidos): "${item.title}"`);
      } else {
        showToast(`🛸 Abduzido com sucesso: "${item.title}"!`);
      }

      await syncFavoriteWithSupabase(item, !exists, settings);
    },
    [favorites, settings, showToast]
  );

  const handleUpdateItemInCatalog = useCallback((updatedItem: MediaItem) => {
    setSelectedItem(updatedItem);
    setCatalog((prev) => ({
      ...prev,
      [updatedItem.category]: prev[updatedItem.category].map((it) =>
        it.id === updatedItem.id ? updatedItem : it
      ),
    }));
  }, []);

  const handleSaveSettings = (newSettings: AppSettings) => {
    saveSettings(newSettings);
    setSettings(newSettings);
    showToast('Preferências do usuário salvas!');
  };

  const handleImportAbducted = useCallback(
    (importedItems: MediaItem[], mode: 'merge' | 'replace') => {
      setFavorites((prev) => {
        let next: MediaItem[];
        if (mode === 'replace') {
          next = importedItems;
        } else {
          const map = new Map<string, MediaItem>();
          for (const it of prev) {
            map.set(`${it.category}::${it.externalId}`, it);
          }
          for (const it of importedItems) {
            map.set(`${it.category}::${it.externalId}`, it);
          }
          next = Array.from(map.values());
        }
        saveLocalFavorites(next);
        return next;
      });
      showToast(`🛸 ${importedItems.length} mídia(s) abduzida(s) importada(s)!`);
    },
    [showToast]
  );

  const allHomeItems = useMemo(() => {
    const combined = [
      ...catalog.anime,
      ...catalog.movie_cinema,
      ...catalog.tv,
      ...catalog.movie_digital,
      ...catalog.game,
    ];
    return combined.sort(
      (a, b) => getItemReleaseTimestamp(a) - getItemReleaseTimestamp(b)
    );
  }, [catalog]);

  const apiSearchIdsSet = useMemo(() => {
    return new Set(apiSearchResults.map((it) => `${it.category}::${it.externalId}`));
  }, [apiSearchResults]);

  const currentTabRawList = useMemo(() => {
    const base =
      activeTab === 'home'
        ? allHomeItems
        : activeTab === 'favorites'
        ? favorites
        : catalog[activeTab] || [];

    // Quando há uma pesquisa ativa, mescla os resultados vindos direto de toda a API!
    if (searchQuery.trim().length >= 2 && apiSearchResults.length > 0 && activeTab !== 'favorites') {
      const relevantApiItems = apiSearchResults.filter((it) => {
        if (activeTab === 'home') return true;
        if (
          (activeTab === 'movie_cinema' || activeTab === 'movie_digital') &&
          (it.category === 'movie_cinema' || it.category === 'movie_digital')
        ) {
          return true;
        }
        return it.category === activeTab;
      });

      const mergedMap = new Map<string, MediaItem>();
      for (const it of base) {
        mergedMap.set(`${it.category}::${it.externalId}`, it);
      }
      for (const it of relevantApiItems) {
        const key = `${it.category}::${it.externalId}`;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, it);
        }
      }
      return Array.from(mergedMap.values()).sort(
        (a, b) => getItemReleaseTimestamp(a) - getItemReleaseTimestamp(b)
      );
    }

    return [...base].sort(
      (a, b) => getItemReleaseTimestamp(a) - getItemReleaseTimestamp(b)
    );
  }, [activeTab, allHomeItems, favorites, catalog, searchQuery, apiSearchResults]);

  const availableGenres = useMemo(() => {
    const streamSet = new Set<string>();
    const genreSet = new Set<string>();
    for (const item of currentTabRawList) {
      for (const sp of item.streamingPlatforms || []) {
        streamSet.add(sp);
      }
      for (const g of item.genres || []) {
        genreSet.add(g);
      }
    }
    return [...Array.from(streamSet), ...Array.from(genreSet)].slice(0, 12);
  }, [currentTabRawList]);

  const handleSelectTab = (tab: TabId) => {
    setActiveTab(tab);
    setSelectedGenre('TODOS');
    setVisiblePastCount(0);
    setHighlightedItemId(null);
  };

  const allFilteredChronological = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    // Expande números para equivalentes comuns em sequências (ex: "duna 3" -> aceita "três", "iii", "messias", "part three")
    const tokens = q.split(/\s+/).filter(Boolean);
    const matchesQueryText = (item: MediaItem): boolean => {
      if (!q) return true;
      if (apiSearchIdsSet.has(`${item.category}::${item.externalId}`)) {
        return true;
      }
      const haystack = [
        item.title,
        item.originalTitle || '',
        item.director || '',
        item.developer || '',
        item.studioOrNetwork || '',
        ...(item.genres || []),
        ...(item.streamingPlatforms || []),
      ]
        .join(' ')
        .toLowerCase();

      if (haystack.includes(q)) return true;

      return tokens.every((tok) => {
        if (haystack.includes(tok)) return true;
        if (tok === '2')
          return (
            haystack.includes('dois') ||
            haystack.includes('two') ||
            haystack.includes(' ii')
          );
        if (tok === '3')
          return (
            haystack.includes('três') ||
            haystack.includes('tres') ||
            haystack.includes('three') ||
            haystack.includes(' iii') ||
            haystack.includes('messias') ||
            haystack.includes('messiah')
          );
        if (tok === '4')
          return (
            haystack.includes('quatro') ||
            haystack.includes('four') ||
            haystack.includes(' iv')
          );
        return false;
      });
    };

    return currentTabRawList.filter((item) => {
      const matchesGenre =
        selectedGenre === 'TODOS' ||
        item.genres.includes(selectedGenre) ||
        Boolean(item.streamingPlatforms?.includes(selectedGenre));
      if (!matchesGenre) return false;
      return matchesQueryText(item);
    });
  }, [currentTabRawList, searchQuery, selectedGenre, apiSearchIdsSet]);

  const isSearchActive = searchQuery.trim().length > 0;

  const { pastItems, upcomingItems } = useMemo(() => {
    const past: MediaItem[] = [];
    const upcoming: MediaItem[] = [];
    const todayStart = getTodayStartTimestamp();
    const oneYearLimit = getOneYearFromTodayTimestamp();
    const enforceOneYear = !isSearchActive && activeTab !== 'favorites';

    for (const item of allFilteredChronological) {
      const ts = getItemReleaseTimestamp(item);
      if (ts < todayStart) {
        past.push(item);
      } else if (!enforceOneYear || ts <= oneYearLimit) {
        upcoming.push(item);
      }
    }

    // Ordena pastItems cronologicamente (do mais antigo para o mais recente antes de hoje)
    past.sort((a, b) => getItemReleaseTimestamp(a) - getItemReleaseTimestamp(b));
    upcoming.sort((a, b) => getItemReleaseTimestamp(a) - getItemReleaseTimestamp(b));

    return { pastItems: past, upcomingItems: upcoming };
  }, [allFilteredChronological, isSearchActive, activeTab]);

  const visiblePastItems = useMemo(() => {
    const reversedPast = [...pastItems].sort(
      (a, b) => getItemReleaseTimestamp(b) - getItemReleaseTimestamp(a)
    );
    // Quando o usuário realiza uma pesquisa, mostra automaticamente todas as mídias anteriores que batem com a busca!
    if (isSearchActive) {
      return reversedPast;
    }
    if (visiblePastCount <= 0) return [];
    return reversedPast.slice(0, visiblePastCount);
  }, [pastItems, visiblePastCount, isSearchActive]);

  const remainingOlderCount = Math.max(0, pastItems.length - visiblePastItems.length);

  // Carrega +10 mídias lançadas anteriormente, e se estiver acabando o buffer local, busca mais páginas nas APIs!
  const handleLoadMorePast = useCallback(async () => {
    const nextVisibleCount = visiblePastCount + PAST_BATCH_SIZE;
    setVisiblePastCount(nextVisibleCount);

    // Se já consumiu quase todos os itens passados carregados e não estamos na aba de favoritos, busca mais páginas na API
    if (nextVisibleCount >= pastItems.length - 5 && activeTab !== 'favorites' && !isLoadingMorePast) {
      const nextPages = pastApiPages + 2;
      setPastApiPages(nextPages);
      setIsLoadingMorePast(true);
      try {
        const [moviesRes, seriesRes, animeRes, gamesRes] = await Promise.all([
          fetchTmdbMovies(settings, nextPages),
          fetchTmdbSeries(settings, nextPages),
          fetchAniListAnimes(nextPages),
          fetchRawgGames(settings, nextPages),
        ]);

        setCatalog({
          movie_cinema: moviesRes.cinema,
          movie_digital: moviesRes.digital,
          tv: seriesRes.items,
          anime: animeRes.items,
          game: gamesRes.items,
        });
      } finally {
        setIsLoadingMorePast(false);
      }
    }
  }, [visiblePastCount, pastItems.length, activeTab, isLoadingMorePast, pastApiPages, settings]);

  // Busca lançamentos de uma data específica quando o usuário seleciona no calendário
  const handleSelectDateFilter = useCallback(
    async (filter: CalendarDateFilter) => {
      setActiveDateFilter(filter);
      setIsLoadingCalendar(true);
      showToast(`📅 Buscando lançamentos de ${filter.label}...`);
      try {
        const liveItems = await fetchMediaByCalendarDate(
          settings,
          filter.startDateIso,
          filter.endDateIso
        );
        setCalendarFetchedItems(liveItems);
      } finally {
        setIsLoadingCalendar(false);
      }
    },
    [settings, showToast]
  );

  const handleClearDateFilter = useCallback(() => {
    setActiveDateFilter(null);
    setCalendarFetchedItems([]);
    showToast('Exibindo cronograma completo a partir de hoje!');
  }, [showToast]);

  const handleShiftCalendarDay = useCallback(
    (deltaDays: number) => {
      if (!activeDateFilter) return;
      const nextDate = new Date(activeDateFilter.rawDate);
      nextDate.setDate(nextDate.getDate() + deltaDays);
      const y = nextDate.getFullYear();
      const m = String(nextDate.getMonth() + 1).padStart(2, '0');
      const d = String(nextDate.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${d}`;
      const label = nextDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      handleSelectDateFilter({
        mode: 'day',
        startDateIso: iso,
        endDateIso: iso,
        label,
        rawDate: nextDate,
      });
    },
    [activeDateFilter, handleSelectDateFilter]
  );

  // Lista combinada e filtrada para a data selecionada no calendário
  const calendarFilteredItems = useMemo(() => {
    if (!activeDateFilter) return [];
    const { startDateIso, endDateIso } = activeDateFilter;

    // Junta itens do catálogo local que batem com a data + itens buscados ao vivo na API para aquela data
    const combinedMap = new Map<string, MediaItem>();

    const checkAndAdd = (item: MediaItem) => {
      // Verifica se pertence à aba ativa (ou todas se estiver em 'home')
      if (activeTab !== 'home' && activeTab !== 'favorites' && item.category !== activeTab) {
        return;
      }
      if (activeTab === 'favorites' && !isItemFavorite(item)) {
        return;
      }

      const primaryIso = extractIsoDatePart(getItemPrimaryDateString(item));
      const cinemaIso = extractIsoDatePart(item.cinemaReleaseDate);
      const digitalIso = extractIsoDatePart(item.digitalReleaseDate);

      const matchesDate =
        (primaryIso && primaryIso >= startDateIso && primaryIso <= endDateIso) ||
        (cinemaIso && cinemaIso >= startDateIso && cinemaIso <= endDateIso) ||
        (digitalIso && digitalIso >= startDateIso && digitalIso <= endDateIso);

      if (matchesDate) {
        combinedMap.set(`${item.category}::${item.externalId}`, item);
      }
    };

    for (const item of allHomeItems) checkAndAdd(item);
    for (const item of favorites) checkAndAdd(item);
    for (const item of calendarFetchedItems) checkAndAdd(item);

    const q = searchQuery.trim().toLowerCase();
    return Array.from(combinedMap.values())
      .filter((item) => {
        const matchesGenre =
          selectedGenre === 'TODOS' ||
          item.genres.includes(selectedGenre) ||
          Boolean(item.streamingPlatforms?.includes(selectedGenre));
        if (!matchesGenre) return false;
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          (item.originalTitle && item.originalTitle.toLowerCase().includes(q)) ||
          Boolean(item.streamingPlatforms?.some((sp) => sp.toLowerCase().includes(q)))
        );
      })
      .sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0));
  }, [
    activeDateFilter,
    activeTab,
    allHomeItems,
    favorites,
    calendarFetchedItems,
    isItemFavorite,
    searchQuery,
    selectedGenre,
  ]);

  const handleJumpToToday = useCallback(() => {
    setVisiblePastCount(0);
    setActiveDateFilter(null);
    setHighlightedItemId(upcomingItems[0]?.id || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Exibindo lançamentos a partir de hoje!');
  }, [upcomingItems, showToast]);

  const isShowingAbductedTimeline =
    activeTab === 'favorites' && abductedTimelineMode;

  const tabCounts: Record<TabId, number> = useMemo(
    () => ({
      home: allHomeItems.filter((it) => isFromTodayOnwards(it, true)).length,
      favorites: favorites.length,
      movie_cinema: catalog.movie_cinema.filter((it) => isFromTodayOnwards(it, true)).length,
      movie_digital: catalog.movie_digital.filter((it) => isFromTodayOnwards(it, true)).length,
      tv: catalog.tv.filter((it) => isFromTodayOnwards(it, true)).length,
      anime: catalog.anime.filter((it) => isFromTodayOnwards(it, true)).length,
      game: catalog.game.filter((it) => isFromTodayOnwards(it, true)).length,
    }),
    [allHomeItems, favorites.length, catalog]
  );

  const sectionInfo = SECTION_TITLES[activeTab];
  const todayFormatted = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const oneYearLimitFormatted = new Date(
    getOneYearFromTodayTimestamp()
  ).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen relative flex flex-col md:flex-row text-[#f3f0ff] bg-[#09070e]">
      <AeroBackground />

      {/* SIDEBAR ESQUERDA */}
      <AeroSidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        counts={tabCounts}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRefresh={() => loadAllCategories(settings, pastApiPages)}
        isLoading={isLoading}
        userName={settings.userName}
        notificationsEnabled={settings.notificationsEnabled}
      />

      {/* ÁREA DE CONTEÚDO DIREITA (APROVEITA 100% DA LARGURA DA TELA NO PC) */}
      <div className="relative z-10 flex-1 w-full min-w-0 px-5 sm:px-8 lg:px-10 xl:px-12 py-7">
        {/* DESTAQUE EXCLUSIVO DA HOME: ALINE ÍGENA + MÍDIAS MAIS HYPADAS DA SEMANA */}
        {activeTab === 'home' && !activeDateFilter && (
          <HomeAlineShowcase
            allItems={allHomeItems}
            isItemFavorite={isItemFavorite}
            onToggleFavorite={handleToggleFavorite}
            onOpenModal={setSelectedItem}
          />
        )}

        {/* CABEÇALHO DA SEÇÃO / FILTROS */}
        <header className="mb-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {activeDateFilter
                    ? `Lançamentos em ${activeDateFilter.label}`
                    : activeTab === 'home'
                    ? 'Próximos Lançamentos'
                    : sectionInfo.title}
                </h1>
                {!activeDateFilter && activeTab !== 'favorites' && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-extrabold uppercase tracking-wider bg-[#0d3320] text-[#4ade80] border border-[#22ff55]/45">
                    Projeção 1 Ano • Até {oneYearLimitFormatted}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[#7c738f] mt-1">
                {activeDateFilter
                  ? 'Exibindo todas as mídias e episódios lançados exatamente na data selecionada no calendário.'
                  : sectionInfo.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-[#7c738f] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar transmissão..."
                  className="pl-9 pr-3.5 py-2 text-xs rounded-xl bg-[#130f1d] text-white placeholder-[#655d78] border border-white/[0.07] focus:outline-none focus:border-[#a855f7] w-40 sm:w-52 transition"
                />
              </div>

              <TimelineCalendarPopover
                items={allFilteredChronological}
                activeDateFilter={activeDateFilter}
                onSelectDateFilter={handleSelectDateFilter}
                onClearDateFilter={handleClearDateFilter}
              />

              {/* Botão Exclusivo na Página de Abduzidos: Linha do Tempo Simplificada */}
              {activeTab === 'favorites' && (
                <button
                  type="button"
                  onClick={() => setAbductedTimelineMode((prev) => !prev)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 border transition-all ${
                    abductedTimelineMode
                      ? 'bg-[#0d3320] text-[#4ade80] border-[#22ff55] shadow-[0_0_18px_rgba(34,255,85,0.3)]'
                      : 'bg-[#130f1d] text-[#c084fc] border-[#a855f7]/45 hover:border-[#22ff55]/60 hover:text-white'
                  }`}
                  title="Alternar para a Linha do Tempo Simplificada (Passados e Futuros juntos)"
                >
                  <CalendarRange className="w-4 h-4 text-[#22ff55]" />
                  <span>
                    {abductedTimelineMode
                      ? 'Linha do Tempo Ativa'
                      : 'Ver Linha do Tempo'}
                  </span>
                </button>
              )}

              {/* Alternador Lista vs Galeria */}
              <div className="inline-flex items-center p-1 rounded-xl bg-[#130f1d] border border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => {
                    setAbductedTimelineMode(false);
                    setViewMode('list');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    !isShowingAbductedTimeline && viewMode === 'list'
                      ? 'bg-[#2a174a] text-[#c084fc] border border-[#a855f7]/40'
                      : 'text-[#7c738f] hover:text-white'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAbductedTimelineMode(false);
                    setViewMode('gallery');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    !isShowingAbductedTimeline && viewMode === 'gallery'
                      ? 'bg-[#0d3320] text-[#4ade80] border border-[#22ff55]/40'
                      : 'text-[#7c738f] hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Galeria</span>
                </button>
              </div>
            </div>
          </div>

          {availableGenres.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedGenre('TODOS')}
                className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full transition shrink-0 ${
                  selectedGenre === 'TODOS'
                    ? 'xeno-tag-purple'
                    : 'bg-white/[0.03] text-[#7c738f] hover:text-white border border-white/[0.06]'
                }`}
              >
                Todos
              </button>
              {availableGenres.map((genre) => (
                <button
                  type="button"
                  key={genre}
                  onClick={() =>
                    setSelectedGenre(selectedGenre === genre ? 'TODOS' : genre)
                  }
                  className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full transition shrink-0 ${
                    selectedGenre === genre
                      ? 'xeno-tag-green'
                      : 'bg-white/[0.03] text-[#7c738f] hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          )}
        </header>

        {/* ====================================================================
            MODO 1: FILTRO DE DATA DO CALENDÁRIO ATIVO
            (Mostra tudo que lançou na data clicada pelo usuário)
           ==================================================================== */}
        {activeDateFilter ? (
          <section className="space-y-6">
            {/* Barra de controle da data selecionada */}
            <div className="p-4 rounded-2xl bg-[#130f1d] border border-[#22ff55]/40 shadow-[0_0_25px_rgba(34,255,85,0.12)] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#0d3320] border border-[#22ff55]/40 text-[#4ade80]">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#4ade80]">
                      Filtro de Data Ativo
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2a174a] text-[#c084fc] border border-[#a855f7]/40">
                      {calendarFilteredItems.length} mídia(s) encontrada(s)
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-extrabold text-white capitalize">
                    {activeDateFilter.label}
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeDateFilter.mode === 'day' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleShiftCalendarDay(-1)}
                      className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-bold text-[#d8d0ec] flex items-center gap-1.5 transition"
                    >
                      <ChevronLeft className="w-4 h-4 text-[#a855f7]" />
                      <span>Dia Anterior</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShiftCalendarDay(1)}
                      className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-bold text-[#d8d0ec] flex items-center gap-1.5 transition"
                    >
                      <span>Próximo Dia</span>
                      <ChevronRight className="w-4 h-4 text-[#22ff55]" />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleClearDateFilter}
                  className="px-3.5 py-2 rounded-xl bg-[#2a174a] hover:bg-[#3b2166] text-[#c084fc] hover:text-white border border-[#a855f7]/50 text-xs font-extrabold flex items-center gap-1.5 transition"
                >
                  <X className="w-4 h-4" />
                  <span>Voltar ao Cronograma Normal</span>
                </button>
              </div>
            </div>

            {isLoadingCalendar ? (
              <div className="xeno-card p-14 text-center max-w-md mx-auto my-8 space-y-3">
                <Loader2 className="w-8 h-8 text-[#22ff55] mx-auto animate-spin" />
                <h3 className="text-base font-bold text-white">
                  Consultando arquivos intergalácticos...
                </h3>
                <p className="text-xs text-[#8e86a3]">
                  Buscando todos os filmes, séries, animes e games lançados em {activeDateFilter.label}.
                </p>
              </div>
            ) : calendarFilteredItems.length > 0 ? (
              viewMode === 'list' ? (
                <div className="space-y-5">
                  {calendarFilteredItems.map((item) => (
                    <div key={item.id} id={`media-item-${item.id}`}>
                      <MediaListRow
                        item={item}
                        isFavorite={isItemFavorite(item)}
                        isHighlighted={true}
                        onToggleFavorite={handleToggleFavorite}
                        onOpenModal={setSelectedItem}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                  {calendarFilteredItems.map((item) => (
                    <div key={item.id} id={`media-item-${item.id}`}>
                      <MediaCard
                        item={item}
                        isFavorite={isItemFavorite(item)}
                        onToggleFavorite={handleToggleFavorite}
                        onOpenModal={setSelectedItem}
                      />
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="xeno-card p-12 text-center max-w-md mx-auto my-8 space-y-3">
                <Calendar className="w-8 h-8 text-[#a855f7] mx-auto" />
                <h3 className="text-lg font-bold text-white">
                  Nenhum lançamento registrado em {activeDateFilter.label}
                </h3>
                <p className="text-xs text-[#8e86a3]">
                  Use os botões de "Dia Anterior" ou "Próximo Dia" acima para explorar as datas vizinhas ou volte ao cronograma normal.
                </p>
              </div>
            )}
          </section>
        ) : isShowingAbductedTimeline ? (
          /* ====================================================================
             MODO 2: LINHA DO TEMPO SIMPLIFICADA DOS ABDUZIDOS
             ==================================================================== */
          allFilteredChronological.length > 0 ? (
            <AbductedTimelineView
              items={allFilteredChronological}
              onOpenModal={setSelectedItem}
              onToggleFavorite={handleToggleFavorite}
            />
          ) : (
            <div className="xeno-card p-12 text-center max-w-md mx-auto my-12 space-y-3">
              <Sparkles className="w-8 h-8 text-[#a855f7] mx-auto" />
              <h3 className="text-lg font-bold text-white">
                Nenhuma mídia abduzida na Linha do Tempo
              </h3>
              <p className="text-xs text-[#8e86a3]">
                Clique no ovnizinho em qualquer título para adicioná-lo à sua linha do tempo.
              </p>
            </div>
          )
        ) : (
          /* ====================================================================
             MODO 3: CRONOGRAMA PADRÃO (ANTERIORES 10 EM 10 + HOJE EM DIANTE)
             ==================================================================== */
          <>
            {/* BANNER DE PESQUISA GLOBAL NA API */}
            {searchQuery.trim().length >= 2 && (
              <div className="mb-6 p-3.5 px-4 rounded-2xl bg-[#130f1d] border border-[#a855f7]/45 flex flex-wrap items-center justify-between gap-3 shadow-[0_0_20px_rgba(168,85,247,0.12)]">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-white">
                  {isSearchingApis ? (
                    <>
                      <Loader2 className="w-4 h-4 text-[#22ff55] animate-spin shrink-0" />
                      <span>
                        Vasculhando todas as APIs por{' '}
                        <span className="text-[#4ade80]">"{searchQuery}"</span>...
                      </span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 text-[#22ff55] shrink-0" />
                      <span>
                        Pesquisa global na API por{' '}
                        <span className="text-[#4ade80]">"{searchQuery}"</span>:{' '}
                        <span className="text-[#c084fc]">
                          {allFilteredChronological.length} resultado(s) encontrado(s)
                        </span>{' '}
                        (futuros e já lançados)
                      </span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-bold text-[#d8d0ec] hover:text-white flex items-center gap-1.5 transition"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Limpar pesquisa</span>
                </button>
              </div>
            )}

            {/* BOTÃO INICIAL: Quando ainda não abriu as mídias anteriores */}
            {pastItems.length > 0 && visiblePastItems.length === 0 && (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleLoadMorePast}
                  disabled={isLoadingMorePast}
                  className="w-full py-3.5 px-5 rounded-2xl bg-[#130f1d]/90 hover:bg-[#1b142b] border border-dashed border-[#a855f7]/45 hover:border-[#22ff55]/60 transition-all flex flex-col sm:flex-row items-center justify-center gap-2.5 group shadow-[0_0_24px_rgba(168,85,247,0.1)]"
                >
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-[#c084fc] group-hover:text-[#4ade80] transition-colors">
                    <div className="p-1.5 rounded-full bg-[#2a174a] group-hover:bg-[#0d3320] transition-colors">
                      <Clock className="w-4 h-4 text-[#a855f7] group-hover:text-[#22ff55] animate-pulse" />
                    </div>
                    <span>Ver mídias lançadas anteriormente</span>
                    <ChevronUp className="w-4 h-4 opacity-75 group-hover:-translate-y-0.5 transition-transform" />
                  </div>

                  <span className="text-[11px] text-[#7c738f]">
                    (Clique para carregar as {PAST_BATCH_SIZE} mídias lançadas imediatamente antes de hoje)
                  </span>
                </button>
              </div>
            )}

            {/* SEÇÃO DE MÍDIAS JÁ LANÇADAS ANTERIORMENTE (Ordem cronológica reversa a partir de ontem, de 10 em 10) */}
            {visiblePastItems.length > 0 && (
              <section aria-label="Mídias lançadas anteriormente" className="mb-8 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#a855f7]">
                    <History className="w-4 h-4" />
                    <span>
                      Mídias Lançadas Anteriormente ({visiblePastItems.length} exibidas em ordem cronológica antes de hoje)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleJumpToToday}
                    className="text-xs font-semibold text-[#c084fc] hover:text-[#4ade80] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a174a]/50 border border-[#a855f7]/30 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Ocultar anteriores</span>
                  </button>
                </div>

                {viewMode === 'list' ? (
                  <div className="space-y-5 opacity-95">
                    {visiblePastItems.map((item) => (
                      <div key={item.id} id={`media-item-${item.id}`}>
                        <MediaListRow
                          item={item}
                          isFavorite={isItemFavorite(item)}
                          isHighlighted={highlightedItemId === item.id}
                          onToggleFavorite={handleToggleFavorite}
                          onOpenModal={setSelectedItem}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 opacity-95">
                    {visiblePastItems.map((item) => (
                      <div key={item.id} id={`media-item-${item.id}`}>
                        <MediaCard
                          item={item}
                          isFavorite={isItemFavorite(item)}
                          onToggleFavorite={handleToggleFavorite}
                          onOpenModal={setSelectedItem}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* BOTÃO PARA CARREGAR +10 MÍDIAS ANTERIORES */}
                {(remainingOlderCount > 0 || activeTab !== 'favorites') && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleLoadMorePast}
                      disabled={isLoadingMorePast}
                      className="w-full py-3.5 px-5 rounded-2xl bg-[#130f1d] hover:bg-[#1b142b] border border-dashed border-[#22ff55]/45 hover:border-[#22ff55] transition-all flex flex-col sm:flex-row items-center justify-center gap-2.5 group shadow-[0_0_20px_rgba(34,255,85,0.1)]"
                    >
                      <div className="flex items-center gap-2.5 text-xs sm:text-sm font-extrabold text-[#4ade80] group-hover:text-white transition-colors">
                        {isLoadingMorePast ? (
                          <Loader2 className="w-4 h-4 text-[#22ff55] animate-spin" />
                        ) : (
                          <History className="w-4 h-4 text-[#22ff55]" />
                        )}
                        <span>
                          {isLoadingMorePast
                            ? 'Buscando mais lançamentos anteriores...'
                            : `Carregar +${PAST_BATCH_SIZE} mídias lançadas anteriormente`}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#8e86a3]">
                        (Continuar voltando no tempo cronologicamente)
                      </span>
                    </button>
                  </div>
                )}

                <div
                  ref={todayMarkerRef}
                  className="py-3 flex items-center gap-4 select-none"
                >
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#22ff55]/60 to-[#22ff55]" />
                  <span className="px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-[#0d3320] text-[#4ade80] border border-[#22ff55]/50 shadow-[0_0_15px_rgba(34,255,85,0.3)]">
                    A partir de Hoje • {todayFormatted}
                  </span>
                  <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#22ff55]/60 to-[#22ff55]" />
                </div>
              </section>
            )}

            {/* LISTA PRINCIPAL (DA DATA ATUAL DE ACESSO PRA FRENTE) */}
            <main>
              {upcomingItems.length > 0 ? (
                viewMode === 'list' ? (
                  <section aria-label="Próximos lançamentos em ordem cronológica" className="space-y-5">
                    {upcomingItems.map((item, idx) => (
                      <div key={item.id} id={`media-item-${item.id}`}>
                        <MediaListRow
                          item={item}
                          isFavorite={isItemFavorite(item)}
                          isHighlighted={
                            highlightedItemId
                              ? highlightedItemId === item.id
                              : idx === 0 && visiblePastItems.length === 0
                          }
                          onToggleFavorite={handleToggleFavorite}
                          onOpenModal={setSelectedItem}
                        />
                      </div>
                    ))}
                  </section>
                ) : (
                  <section
                    aria-label="Galeria de próximos lançamentos"
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5"
                  >
                    {upcomingItems.map((item) => (
                      <div key={item.id} id={`media-item-${item.id}`}>
                        <MediaCard
                          item={item}
                          isFavorite={isItemFavorite(item)}
                          onToggleFavorite={handleToggleFavorite}
                          onOpenModal={setSelectedItem}
                        />
                      </div>
                    ))}
                  </section>
                )
              ) : visiblePastItems.length === 0 ? (
                <div className="xeno-card p-12 text-center max-w-md mx-auto my-12 space-y-3">
                  <Sparkles className="w-8 h-8 text-[#a855f7] mx-auto" />
                  <h3 className="text-lg font-bold text-white">
                    {activeTab === 'favorites'
                      ? 'Nenhuma mídia abduzida ainda'
                      : 'Nenhum lançamento futuro encontrado'}
                  </h3>
                  <p className="text-xs text-[#8e86a3]">
                    {activeTab === 'favorites'
                      ? 'Clique no ovnizinho em qualquer card para abduzir seus lançamentos para cá.'
                      : pastItems.length > 0
                      ? 'Clique em "Ver mídias lançadas anteriormente" acima para visualizar os títulos já lançados.'
                      : 'Tente limpar o filtro de busca ou selecionar outra tag.'}
                  </p>
                </div>
              ) : null}
            </main>
          </>
        )}
      </div>

      {/* Modal de Detalhes Ricos */}
      <MediaDetailsModal
        item={selectedItem}
        isFavorite={selectedItem ? isItemFavorite(selectedItem) : false}
        onClose={() => setSelectedItem(null)}
        onToggleFavorite={handleToggleFavorite}
        settings={settings}
        onUpdateItem={handleUpdateItemInCatalog}
      />

      {/* Modal de Configurações */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        abductedItems={favorites}
        onImportAbducted={handleImportAbducted}
      />

      {/* Toast Flutuante */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl bg-[#161124] border border-[#22ff55]/50 shadow-[0_0_24px_rgba(34,255,85,0.2)] flex items-center gap-2.5 text-xs font-bold text-white">
          <span className="w-2 h-2 rounded-full bg-[#22ff55] shadow-[0_0_8px_#22ff55]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default App;
