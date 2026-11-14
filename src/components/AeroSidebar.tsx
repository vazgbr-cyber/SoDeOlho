import React from 'react';
import {
  Home,
  Film,
  Tv,
  Flame,
  Gamepad2,
  SlidersHorizontal,
  RefreshCw,
  Radar,
} from 'lucide-react';
import { TabId } from '../types/media';
import { UfoIcon } from './AbductButton';
import { BrandLogo } from './ProcessedImages';

interface AeroSidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  counts: Record<TabId, number>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  userName: string;
  notificationsEnabled: boolean;
}

export const AeroSidebar: React.FC<AeroSidebarProps> = ({
  activeTab,
  onSelectTab,
  counts,
  onOpenSettings,
  onRefresh,
  isLoading,
  userName,
  notificationsEnabled,
}) => {
  const isMovieActive =
    activeTab === 'movie_cinema' || activeTab === 'movie_digital';

  return (
    <aside className="w-full md:w-72 xl:w-80 shrink-0 md:min-h-screen md:sticky md:top-0 z-30 flex flex-col justify-between bg-[#0c0914] border-b md:border-b-0 md:border-r border-white/[0.07] px-5 py-6 select-none">
      <div className="space-y-6">
        {/* TOPO: LOGO GRANDE EM DESTAQUE + SÓ DE OLHO */}
        <div
          onClick={() => onSelectTab('home')}
          className="px-2 pt-1 pb-3 flex items-center gap-4 cursor-pointer group border-b border-white/[0.06]"
        >
          <div className="relative shrink-0 transform group-hover:scale-105 transition-transform drop-shadow-[0_0_24px_rgba(34,255,85,0.45)]">
            <BrandLogo size={86} />
          </div>

          <div className="leading-none space-y-1">
            <div className="text-2xl xl:text-[26px] font-black tracking-wider text-white">
              SÓ DE
            </div>
            <div className="text-2xl xl:text-[26px] font-black tracking-wider text-[#a855f7] drop-shadow-[0_0_14px_rgba(168,85,247,0.65)]">
              OLHO
            </div>
            <div className="inline-flex items-center gap-1.5 pt-1 text-[10px] font-mono uppercase tracking-widest text-[#4ade80]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22ff55] animate-pulse" />
              <span>Radar Ativo</span>
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO PRINCIPAL: HOME, ABDUZIDOS, CATEGORIAS E MENU DE USUÁRIO LOGO ABAIXO DE GAMES */}
        <nav aria-label="Menu principal" className="space-y-2">
          <button
            type="button"
            onClick={() => onSelectTab('home')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-[15px] font-bold transition-all ${
              activeTab === 'home'
                ? 'xeno-nav-active'
                : 'text-[#968da8] hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <Home
                className={`w-5 h-5 ${
                  activeTab === 'home' ? 'text-[#a855f7]' : 'text-[#847b96]'
                }`}
              />
              <span>Home</span>
            </div>
            <span className="text-[11px] font-mono text-[#6e6682]">
              {counts.home}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('favorites')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-[15px] font-bold transition-all ${
              activeTab === 'favorites'
                ? 'xeno-nav-active'
                : 'text-[#968da8] hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <UfoIcon
                active={activeTab === 'favorites'}
                size={20}
                className={
                  activeTab === 'favorites' ? 'text-[#22ff55]' : 'text-[#847b96]'
                }
              />
              <span>Abduzidos</span>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#22ff55]/15 text-[#4ade80] border border-[#22ff55]/30">
              {counts.favorites}
            </span>
          </button>

          {/* SEÇÃO: CATEGORIAS */}
          <div className="pt-4 pb-1 px-4 flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#6e6682]">
              CATEGORIAS
            </span>
            <span className="text-[10px] font-mono text-[#5e5673]">
              ESTREIAS
            </span>
          </div>

          {/* FILMES + PÍLULAS CINEMA / DIGITAL */}
          <div
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[15px] font-bold transition-all ${
              isMovieActive
                ? 'xeno-nav-active'
                : 'text-[#968da8] hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            <button
              type="button"
              onClick={() =>
                onSelectTab(
                  activeTab === 'movie_cinema' ? 'movie_digital' : 'movie_cinema'
                )
              }
              className="flex items-center gap-3.5 text-left flex-1"
            >
              <Film
                className={`w-5 h-5 ${
                  isMovieActive ? 'text-[#a855f7]' : 'text-[#847b96]'
                }`}
              />
              <span>Filmes</span>
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSelectTab('movie_cinema')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                  activeTab === 'movie_cinema'
                    ? 'bg-[#2a174a] text-[#c084fc] border border-[#a855f7]/60 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                    : 'bg-white/[0.04] text-[#7c738f] hover:text-white'
                }`}
              >
                Cinema
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('movie_digital')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                  activeTab === 'movie_digital'
                    ? 'bg-[#2a174a] text-[#c084fc] border border-[#a855f7]/60 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                    : 'bg-white/[0.04] text-[#7c738f] hover:text-white'
                }`}
              >
                Digital
              </button>
            </div>
          </div>

          {/* SÉRIES */}
          <button
            type="button"
            onClick={() => onSelectTab('tv')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-[15px] font-bold transition-all ${
              activeTab === 'tv'
                ? 'xeno-nav-active'
                : 'text-[#968da8] hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <Tv
                className={`w-5 h-5 ${
                  activeTab === 'tv' ? 'text-[#a855f7]' : 'text-[#847b96]'
                }`}
              />
              <span>Séries</span>
            </div>
            <span className="text-[11px] font-mono text-[#6e6682]">
              {counts.tv}
            </span>
          </button>

          {/* ANIMES */}
          <button
            type="button"
            onClick={() => onSelectTab('anime')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-[15px] font-bold transition-all ${
              activeTab === 'anime'
                ? 'xeno-nav-active'
                : 'text-[#968da8] hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <Flame
                className={`w-5 h-5 ${
                  activeTab === 'anime' ? 'text-[#a855f7]' : 'text-[#847b96]'
                }`}
              />
              <span>Animes</span>
            </div>
            <span className="text-[11px] font-mono text-[#6e6682]">
              {counts.anime}
            </span>
          </button>

          {/* GAMES */}
          <button
            type="button"
            onClick={() => onSelectTab('game')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-[15px] font-bold transition-all ${
              activeTab === 'game'
                ? 'xeno-nav-active'
                : 'text-[#968da8] hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <Gamepad2
                className={`w-5 h-5 ${
                  activeTab === 'game' ? 'text-[#a855f7]' : 'text-[#847b96]'
                }`}
              />
              <span>Games</span>
            </div>
            <span className="text-[11px] font-mono text-[#6e6682]">
              {counts.game}
            </span>
          </button>

          {/* MENU DE USUÁRIO E CUSTOMIZAÇÃO LOGO ABAIXO DA ABA "GAMES" */}
          <div className="pt-4 mt-2 border-t border-white/[0.07]">
            <button
              type="button"
              onClick={onOpenSettings}
              title="Customizar Webapp • Exportar/Importar Abduzidos & Notificações"
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-[#140e24] border border-[#a855f7]/40 hover:border-[#22ff55]/75 shadow-[0_0_24px_rgba(147,51,234,0.2)] transition-all group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <BrandLogo size={38} />
                  <span
                    title={
                      notificationsEnabled
                        ? 'Notificações Ativas'
                        : 'Notificações Desativadas'
                    }
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#140e24] ${
                      notificationsEnabled
                        ? 'bg-[#22ff55] shadow-[0_0_6px_#22ff55]'
                        : 'bg-[#6e6682]'
                    }`}
                  />
                </div>

                <div className="text-left min-w-0">
                  <div className="text-sm font-extrabold text-white truncate group-hover:text-[#c084fc] transition-colors">
                    {userName || 'Nebula_99'}
                  </div>
                  <div className="text-[11px] text-[#8e86a3] truncate">
                    Backup & Notificações
                  </div>
                </div>
              </div>

              <SlidersHorizontal className="w-4 h-4 text-[#8e86a3] group-hover:text-[#22ff55] transition-colors shrink-0" />
            </button>
          </div>
        </nav>
      </div>

      {/* PAINEL INFERIOR DE TELEMETRIA / RESUMO PARA PREENCHER O ESPAÇO DA SIDEBAR NO PC */}
      <div className="hidden md:block pt-6">
        <div className="p-4 rounded-2xl bg-[#120d1d]/90 border border-white/[0.06] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#c084fc] flex items-center gap-1.5">
              <Radar className="w-3.5 h-3.5 text-[#22ff55]" />
              <span>Telemetria da Nave</span>
            </span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              title="Atualizar catálogo"
              className="text-[11px] text-[#8e86a3] hover:text-[#4ade80] flex items-center gap-1 transition"
            >
              <RefreshCw
                className={`w-3 h-3 ${isLoading ? 'animate-spin text-[#22ff55]' : ''}`}
              />
              <span>Sincronizar</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="px-2.5 py-2 rounded-xl bg-[#09070e]/80 border border-white/[0.04]">
              <div className="text-[#7c738f]">Próximos</div>
              <div className="text-sm font-mono font-extrabold text-white">
                {counts.home} títulos
              </div>
            </div>
            <div className="px-2.5 py-2 rounded-xl bg-[#09070e]/80 border border-white/[0.04]">
              <div className="text-[#7c738f]">Na Nave</div>
              <div className="text-sm font-mono font-extrabold text-[#4ade80]">
                {counts.favorites} abduzidos
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
