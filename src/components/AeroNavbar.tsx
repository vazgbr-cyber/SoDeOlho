import React from 'react';
import {
  Film,
  Tv,
  Sparkles,
  Gamepad2,
  Heart,
  Search,
  RefreshCw,
  MonitorPlay,
  Radio,
} from 'lucide-react';
import { TabId } from '../types/media';
import { AeroEyeLogo, AeroGearIcon } from './AeroEyeLogo';

interface AeroNavbarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  counts: Record<TabId, number>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedGenre: string;
  availableGenres: string[];
  onSelectGenre: (genre: string) => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  liveStatus: {
    tmdb: boolean;
    anilist: boolean;
    rawg: boolean;
    supabase: boolean;
  };
}

interface NavTabConfig {
  id: TabId;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  isHeart?: boolean;
}

export const AeroNavbar: React.FC<AeroNavbarProps> = ({
  activeTab,
  onSelectTab,
  counts,
  searchQuery,
  onSearchChange,
  selectedGenre,
  availableGenres,
  onSelectGenre,
  onOpenSettings,
  onRefresh,
  isLoading,
  liveStatus,
}) => {
  const tabs: NavTabConfig[] = [
    {
      id: 'movie_cinema',
      label: 'Filmes (Cinema)',
      subtitle: 'Em cartaz & Type 3',
      icon: <Film className="w-4 h-4" />,
    },
    {
      id: 'movie_digital',
      label: 'Filmes (Digital)',
      subtitle: 'VOD & Type 4',
      icon: <MonitorPlay className="w-4 h-4" />,
    },
    {
      id: 'tv',
      label: 'Séries',
      subtitle: 'Episódios Semanais',
      icon: <Tv className="w-4 h-4" />,
    },
    {
      id: 'anime',
      label: 'Animes',
      subtitle: 'Temporada & Simulcast',
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: 'game',
      label: 'Jogos',
      subtitle: 'Releases + HLTB',
      icon: <Gamepad2 className="w-4 h-4" />,
    },
    {
      id: 'favorites',
      label: 'Meus Favoritos',
      subtitle: 'Ordem Cronológica',
      icon: <Heart className="w-4 h-4 fill-current" />,
      isHeart: true,
    },
  ];

  const activeLiveCount = [
    liveStatus.tmdb,
    liveStatus.anilist,
    liveStatus.rawg,
    liveStatus.supabase,
  ].filter(Boolean).length;

  return (
    <header className="sticky top-0 z-30 pt-3 px-3 sm:px-6">
      <div className="max-w-[1440px] mx-auto aero-glass aero-sheen rounded-2xl px-4 py-3.5 sm:px-6 sm:py-4 transition-all">
        {/* Linha Superior: Identidade Visual + Busca + Botão de Configurações Vista/7 */}
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-3.5 border-b border-white/15">
          {/* Logo Olho Cristalino Aero + Título + Subtítulo Irônico */}
          <div className="flex items-center gap-3.5">
            <div className="relative group cursor-pointer" onClick={() => onSelectTab('movie_cinema')}>
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#00d2ff]/40 via-[#0051ff]/40 to-[#00ff9d]/40 blur-md opacity-75 group-hover:opacity-100 transition" />
              <AeroEyeLogo size={52} className="relative transform group-hover:scale-105 transition" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white aero-title-shadow">
                  Só de Olho
                </h1>
                <span className="aero-badge-emerald px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse" />
                  Aero Glass v7.1
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#9bb8dc] italic font-medium drop-shadow">
                “Acompanhando lançamentos... estritamente para fins informativos”
              </p>
            </div>
          </div>

          {/* Controles Direita: Busca, Status de APIs, Atualizar e Engrenagem Vista/7 */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Campo de Busca Aero */}
            <div className="relative flex-1 sm:flex-initial sm:w-64">
              <Search className="w-4 h-4 text-[#00d2ff] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Filtrar títulos, diretor, estúdio..."
                className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl bg-[#050d1c]/80 text-white placeholder-[#7a99be] border border-white/20 border-t-white/10 focus:outline-none focus:border-[#00d2ff] focus:ring-2 focus:ring-[#00d2ff]/30 shadow-inner transition"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#9bb8dc] hover:text-white px-1.5 py-0.5 rounded bg-white/10"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Botão Atualizar Dados */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Sincronizar lançamentos agora"
              className="aero-pill px-3 py-2 text-xs sm:text-sm font-semibold text-[#e6f3ff] flex items-center gap-1.5 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 text-[#00d2ff] ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            {/* Botão de Configurações / Chaves (Engrenagem estilo Vista/7) */}
            <button
              onClick={onOpenSettings}
              className="aero-pill px-3.5 py-2 text-xs sm:text-sm font-bold text-white flex items-center gap-2 border-[#00d2ff]/50"
              title="Configurações / Chaves de API, Supabase & Notificações"
            >
              <AeroGearIcon size={20} />
              <span>Configurações / Chaves</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  activeLiveCount >= 2
                    ? 'bg-[#00ff9d] shadow-[0_0_8px_#00ff9d]'
                    : 'bg-[#00d2ff] shadow-[0_0_8px_#00d2ff]'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Linha Central: Abas Principais Estilo Barra de Tarefas / Media Center (Pílulas Cristalinas) */}
        <nav
          aria-label="Categorias principais"
          className="relative z-10 pt-3.5 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const count = counts[tab.id] ?? 0;

            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`group relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left shrink-0 transition-all ${
                  isActive
                    ? tab.isHeart
                      ? 'aero-heart-orb-active !rounded-xl text-white'
                      : 'aero-pill-active'
                    : 'aero-pill text-[#d8ecff] hover:text-white'
                }`}
              >
                <span
                  className={`p-1.5 rounded-lg transition ${
                    isActive
                      ? 'bg-white/25 text-white shadow-inner'
                      : tab.isHeart
                      ? 'bg-[#ff1e56]/25 text-[#ff5c8a] group-hover:text-white'
                      : 'bg-[#00d2ff]/15 text-[#00d2ff] group-hover:text-white'
                  }`}
                >
                  {tab.icon}
                </span>

                <div className="leading-tight">
                  <div className="text-xs sm:text-sm font-bold tracking-tight flex items-center gap-1.5">
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold ${
                        isActive
                          ? 'bg-black/35 text-white border border-white/30'
                          : 'bg-black/40 text-[#9bb8dc] border border-white/10'
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                  <div
                    className={`text-[10px] hidden md:block ${
                      isActive ? 'text-white/90' : 'text-[#8cb0d9]'
                    }`}
                  >
                    {tab.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Linha Inferior: Filtros Rápidos de Gênero (Badges Glossy Anos 2000/2010) */}
        {availableGenres.length > 0 && (
          <div className="relative z-10 pt-3 mt-2.5 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8cb0d9] mr-1 shrink-0">
              Gêneros:
            </span>
            <button
              onClick={() => onSelectGenre('TODOS')}
              className={`px-2.5 py-1 text-xs font-bold shrink-0 transition ${
                selectedGenre === 'TODOS'
                  ? 'aero-badge-cyan text-white'
                  : 'aero-genre-tag text-[#cfe6ff] hover:text-white'
              }`}
            >
              Todos
            </button>
            {availableGenres.map((genre) => (
              <button
                key={genre}
                onClick={() =>
                  onSelectGenre(selectedGenre === genre ? 'TODOS' : genre)
                }
                className={`px-2.5 py-1 text-xs font-semibold shrink-0 transition ${
                  selectedGenre === genre
                    ? 'aero-badge-emerald text-white'
                    : 'aero-genre-tag text-[#cfe6ff] hover:text-white'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
};
