import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarRange,
  ChevronUp,
  Clock,
  History,
  LayoutGrid,
  List,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import { AppSettings, MediaCategory, MediaItem, TabId, ViewMode } from './types/media';
import { getCuratedFallbackData } from './data/curatedFallbackData';
import { loadSettings, saveSettings } from './lib/settings';
import {
  getItemReleaseTimestamp,
  isFromTodayOnwards,
} from './lib/dateUtils';
import {
  fetchAniListAnimes,
  fetchRawgGames,
  fetchTmdbMovies,
  fetchTmdbSeries,
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
import { TimelineCalendarPopover } from './components/TimelineCalendarPopover';
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
    title: 'Filmes • Cinema',
    subtitle: 'Próximos lançamentos e filmes em cartaz nos cinemas em ordem de estreia.',
  },
  movie_digital: {
    title: 'Filmes • Digital',
    subtitle: 'Lançamentos em VOD / Digital ordenados por data de disponibilização.',
  },
  tv: {
    title: 'Séries',
    subtitle: 'Próximas estreias e episódios semanais em ordem cronológica.',
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

const PAST_BATCH_SIZE = 3;

export function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  // Na aba Abduzidos, permite alternar para a visualização de Linha do Tempo Simplificada (Passados + Futuros)
  const [abductedTimelineMode, setAbductedTimelineMode] = useState<boolean>(false);

  const [catalog, setCatalog] = useState<Record<MediaCategory, MediaItem[]>>(() =>
    getCuratedFallbackData()
  );

  const [favorites, setFavorites] = useState<MediaItem[]>(() => {
    const saved = loadLocalFavorites();
    if (saved.length > 0) return saved;
    const initial = getCuratedFallbackData();
    return [
      initial.tv[2], // Passado recente (Arcane)
      initial.movie_cinema[3], // Passado recente (Gladiador II)
      initial.tv[3], // Hoje (The Last of Us)
      initial.game[3], // Futuro próximo (Monster Hunter Wilds)
      initial.movie_cinema[5], // Futuro (Duna: Messias)
    ];
  });

  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('TODOS');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [visiblePastCount, setVisiblePastCount] = useState<number>(0);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const lastWheelLoadRef = useRef<number>(0);
  const todayMarkerRef = useRef<HTMLDivElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const loadAllCategories = useCallback(async (activeSettings: AppSettings) => {
    setIsLoading(true);
    try {
      const [moviesRes, seriesRes, animeRes, gamesRes, supaFavs] = await Promise.all([
        fetchTmdbMovies(activeSettings),
        fetchTmdbSeries(activeSettings),
        fetchAniListAnimes(),
        fetchRawgGames(activeSettings),
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
  }, []);

  useEffect(() => {
    loadAllCategories(settings);
  }, [settings, loadAllCategories]);

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

  const currentTabRawList = useMemo(() => {
    const base =
      activeTab === 'home'
        ? allHomeItems
        : activeTab === 'favorites'
        ? favorites
        : catalog[activeTab] || [];

    return [...base].sort(
      (a, b) => getItemReleaseTimestamp(a) - getItemReleaseTimestamp(b)
    );
  }, [activeTab, allHomeItems, favorites, catalog]);

  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    for (const item of currentTabRawList) {
      for (const g of item.genres || []) {
        set.add(g);
      }
    }
    return Array.from(set).slice(0, 8);
  }, [currentTabRawList]);

  const handleSelectTab = (tab: TabId) => {
    setActiveTab(tab);
    setSelectedGenre('TODOS');
    setVisiblePastCount(0);
    setHighlightedItemId(null);
  };

  const allFilteredChronological = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return currentTabRawList.filter((item) => {
      const matchesGenre =
        selectedGenre === 'TODOS' || item.genres.includes(selectedGenre);
      if (!matchesGenre) return false;
      if (!q) return true;

      return (
        item.title.toLowerCase().includes(q) ||
        (item.originalTitle && item.originalTitle.toLowerCase().includes(q)) ||
        (item.director && item.director.toLowerCase().includes(q)) ||
        (item.developer && item.developer.toLowerCase().includes(q)) ||
        (item.studioOrNetwork && item.studioOrNetwork.toLowerCase().includes(q)) ||
        item.genres.some((g) => g.toLowerCase().includes(q))
      );
    });
  }, [currentTabRawList, searchQuery, selectedGenre]);

  const { pastItems, upcomingItems } = useMemo(() => {
    const past: MediaItem[] = [];
    const upcoming: MediaItem[] = [];

    for (const item of allFilteredChronological) {
      if (isFromTodayOnwards(item)) {
        upcoming.push(item);
      } else {
        past.push(item);
      }
    }

    return { pastItems: past, upcomingItems: upcoming };
  }, [allFilteredChronological]);

  const visiblePastItems = useMemo(() => {
    if (visiblePastCount <= 0) return [];
    const startIdx = Math.max(0, pastItems.length - visiblePastCount);
    return pastItems.slice(startIdx);
  }, [pastItems, visiblePastCount]);

  const remainingOlderCount = Math.max(0, pastItems.length - visiblePastItems.length);

  const handleLoadMorePast = useCallback(() => {
    if (pastItems.length === 0) return;
    setVisiblePastCount((prev) => {
      const next = Math.min(pastItems.length, prev + PAST_BATCH_SIZE);
      return next;
    });
  }, [pastItems.length]);

  const isShowingAbductedTimeline =
    activeTab === 'favorites' && abductedTimelineMode;

  useEffect(() => {
    if (isShowingAbductedTimeline) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < -22 && window.scrollY <= 18 && remainingOlderCount > 0) {
        const nowMs = Date.now();
        if (nowMs - lastWheelLoadRef.current > 420) {
          lastWheelLoadRef.current = nowMs;
          handleLoadMorePast();
        }
      }
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [remainingOlderCount, handleLoadMorePast, isShowingAbductedTimeline]);

  const handleJumpToDate = useCallback(
    (targetDate: Date, mode: 'day' | 'month' | 'year') => {
      const targetMs = targetDate.getTime();

      const neededPastIndex = pastItems.findIndex(
        (it) => getItemReleaseTimestamp(it) >= targetMs
      );

      if (targetMs < Date.now()) {
        if (neededPastIndex === -1) {
          setVisiblePastCount(pastItems.length);
        } else {
          const countFromEnd = pastItems.length - neededPastIndex;
          setVisiblePastCount((prev) => Math.max(prev, countFromEnd));
        }
      }

      let bestItem: MediaItem | null = null;
      let minDiff = Number.MAX_SAFE_INTEGER;

      for (const item of allFilteredChronological) {
        const itemMs = getItemReleaseTimestamp(item);
        const diff = Math.abs(itemMs - targetMs);
        if (diff < minDiff) {
          minDiff = diff;
          bestItem = item;
        }
      }

      if (bestItem) {
        const targetId = bestItem.id;
        setHighlightedItemId(targetId);
        const label =
          mode === 'year'
            ? `${targetDate.getFullYear()}`
            : mode === 'month'
            ? targetDate.toLocaleDateString('pt-BR', {
                month: 'long',
                year: 'numeric',
              })
            : targetDate.toLocaleDateString('pt-BR');

        showToast(`Pulando para ${label}: "${bestItem.title}"`);

        setTimeout(() => {
          const el = document.getElementById(`media-item-${targetId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 120);
      }
    },
    [allFilteredChronological, pastItems, showToast]
  );

  const handleJumpToToday = useCallback(() => {
    setVisiblePastCount(0);
    setHighlightedItemId(upcomingItems[0]?.id || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Exibindo lançamentos a partir de hoje!');
  }, [upcomingItems, showToast]);

  const tabCounts: Record<TabId, number> = useMemo(
    () => ({
      home: allHomeItems.filter(isFromTodayOnwards).length,
      favorites: favorites.length,
      movie_cinema: catalog.movie_cinema.filter(isFromTodayOnwards).length,
      movie_digital: catalog.movie_digital.filter(isFromTodayOnwards).length,
      tv: catalog.tv.filter(isFromTodayOnwards).length,
      anime: catalog.anime.filter(isFromTodayOnwards).length,
      game: catalog.game.filter(isFromTodayOnwards).length,
    }),
    [allHomeItems, favorites.length, catalog]
  );

  const sectionInfo = SECTION_TITLES[activeTab];
  const todayFormatted = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
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
        onRefresh={() => loadAllCategories(settings)}
        isLoading={isLoading}
        userName={settings.userName}
        notificationsEnabled={settings.notificationsEnabled}
      />

      {/* ÁREA DE CONTEÚDO DIREITA (APROVEITA 100% DA LARGURA DA TELA NO PC) */}
      <div className="relative z-10 flex-1 w-full min-w-0 px-5 sm:px-8 lg:px-10 xl:px-12 py-7">
        {/* DESTAQUE EXCLUSIVO DA HOME: ALINE ÍGENA + MÍDIAS MAIS HYPADAS DA SEMANA */}
        {activeTab === 'home' && (
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
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {activeTab === 'home' ? 'Próximos Lançamentos' : sectionInfo.title}
              </h1>
              <p className="text-xs sm:text-sm text-[#7c738f] mt-1">
                {sectionInfo.subtitle}
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
                onJumpToDate={handleJumpToDate}
                onJumpToToday={handleJumpToToday}
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
            MODO ESPECIAL NA PÁGINA DE ABDUZIDOS: LINHA DO TEMPO SIMPLIFICADA
            (Mostra todos os lançamentos abduzidos, passados e futuros, juntos)
           ==================================================================== */}
        {isShowingAbductedTimeline ? (
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
          <>
            {/* GATILHO COM RELOGINHO: "Ver mídias lançadas anteriormente" */}
            {pastItems.length > 0 && (
              <div className="mb-6">
                {remainingOlderCount > 0 ? (
                  <button
                    type="button"
                    onClick={handleLoadMorePast}
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
                      (Role para cima ou clique para carregar +{Math.min(PAST_BATCH_SIZE, remainingOlderCount)} de {remainingOlderCount} já lançadas)
                    </span>
                  </button>
                ) : (
                  <div className="w-full py-2.5 px-4 rounded-xl bg-[#130f1d]/60 border border-white/[0.06] flex items-center justify-between text-xs text-[#8e86a3]">
                    <span className="flex items-center gap-2">
                      <History className="w-4 h-4 text-[#a855f7]" />
                      <span>Início do arquivo histórico carregado ({pastItems.length} mídias anteriores exibidas)</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleJumpToToday}
                      className="text-[#c084fc] hover:text-[#4ade80] font-bold flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Ocultar anteriores</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* MÍDIAS JÁ LANÇADAS ANTERIORMENTE */}
            {visiblePastItems.length > 0 && (
              <section aria-label="Mídias lançadas anteriormente" className="mb-8 space-y-5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#a855f7]">
                    <History className="w-4 h-4" />
                    <span>Lançados Anteriormente ({visiblePastItems.length})</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleJumpToToday}
                    className="text-xs font-semibold text-[#8e86a3] hover:text-white flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Voltar apenas para Hoje em diante</span>
                  </button>
                </div>

                {viewMode === 'list' ? (
                  <div className="space-y-5 opacity-90">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 opacity-90">
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
