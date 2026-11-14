import React, { useMemo } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Film,
  Gamepad2,
  MonitorPlay,
  Sparkles,
  Tv,
} from 'lucide-react';
import { MediaItem } from '../types/media';
import {
  formatShortDate,
  getDaysUntil,
  getItemPrimaryDateString,
  getItemReleaseTimestamp,
  isFromTodayOnwards,
} from '../lib/dateUtils';
import { AbductButton } from './AbductButton';

interface AbductedTimelineViewProps {
  items: MediaItem[];
  onOpenModal: (item: MediaItem) => void;
  onToggleFavorite: (item: MediaItem, e: React.MouseEvent) => void;
}

const CATEGORY_BADGES: Record<
  MediaItem['category'],
  { label: string; icon: React.ReactNode }
> = {
  movie_cinema: { label: 'Cinema', icon: <Film className="w-3 h-3" /> },
  movie_digital: { label: 'Digital', icon: <MonitorPlay className="w-3 h-3" /> },
  tv: { label: 'Série', icon: <Tv className="w-3 h-3" /> },
  anime: { label: 'Anime', icon: <Sparkles className="w-3 h-3" /> },
  game: { label: 'Game', icon: <Gamepad2 className="w-3 h-3" /> },
};

function formatTimelineDateLabel(dateStr: string | null): {
  dayMonth: string;
  year: string;
  timeOrType: string;
} {
  if (!dateStr) {
    return { dayMonth: 'A DEFINIR', year: '----', timeOrType: '' };
  }
  try {
    const hasTime = dateStr.length > 10;
    const d = new Date(hasTime ? dateStr : `${dateStr}T18:00:00`);
    if (isNaN(d.getTime())) {
      return { dayMonth: 'A DEFINIR', year: '----', timeOrType: '' };
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = d
      .toLocaleDateString('pt-BR', { month: 'short' })
      .replace('.', '')
      .toUpperCase();
    const year = String(d.getFullYear());
    const timeOrType = hasTime
      ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '';
    return { dayMonth: `${day} ${month}`, year, timeOrType };
  } catch {
    return { dayMonth: 'A DEFINIR', year: '----', timeOrType: '' };
  }
}

function getQuickEventDetail(item: MediaItem): string {
  if (item.category === 'tv' || item.category === 'anime') {
    const ep = item.nextEpisodeNumber
      ? `Episódio ${String(item.nextEpisodeNumber).padStart(2, '0')}`
      : 'Novo Episódio';
    return `${ep} • ${item.studioOrNetwork || ''}`;
  }
  if (item.category === 'movie_digital') {
    return item.isDigitalAvailable
      ? 'Já disponível em VOD / Digital'
      : `Lançamento Digital • Dir. ${item.director || ''}`;
  }
  if (item.category === 'movie_cinema') {
    return `Estreia nos Cinemas • Dir. ${item.director || ''}`;
  }
  return `${item.hltbLabel || 'Estreia Game'} • ${(item.platforms || [])
    .slice(0, 3)
    .join(', ')}`;
}

export const AbductedTimelineView: React.FC<AbductedTimelineViewProps> = ({
  items,
  onOpenModal,
  onToggleFavorite,
}) => {
  // Ordena todos os abduzidos (passados e futuros) em ordem estritamente cronológica
  const sortedAll = useMemo(() => {
    return [...items].sort(
      (a, b) => getItemReleaseTimestamp(a) - getItemReleaseTimestamp(b)
    );
  }, [items]);

  // Índice do primeiro item que é de Hoje para frente (para posicionar o marcador "HOJE")
  const firstUpcomingIndex = useMemo(() => {
    return sortedAll.findIndex((item) => isFromTodayOnwards(item));
  }, [sortedAll]);

  const pastCount =
    firstUpcomingIndex === -1 ? sortedAll.length : firstUpcomingIndex;
  const futureCount =
    firstUpcomingIndex === -1 ? 0 : sortedAll.length - firstUpcomingIndex;

  const todayFormatted = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section
      aria-label="Linha do tempo simplificada de Abduzidos"
      className="space-y-6"
    >
      {/* Resumo Rápido no Topo da Linha do Tempo */}
      <div className="p-4 rounded-2xl bg-[#130f1d] border border-white/[0.07] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-2 font-bold text-[#c084fc]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7] shadow-[0_0_8px_#a855f7]" />
            <span>Passados / Já Lançados: {pastCount}</span>
          </span>

          <span className="inline-flex items-center gap-2 font-bold text-[#4ade80]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22ff55] shadow-[0_0_8px_#22ff55]" />
            <span>Hoje & Futuros: {futureCount}</span>
          </span>
        </div>

        <span className="text-[11px] text-[#7c738f]">
          Exibindo todos os {sortedAll.length} lançamentos abduzidos em ordem cronológica
        </span>
      </div>

      {/* Trilha Vertical da Linha do Tempo */}
      <div className="relative pl-4 sm:pl-6">
        {/* Linha vertical contínua conectando passado (roxo) e futuro (verde) */}
        <div className="absolute left-7 sm:left-9 top-3 bottom-3 w-[2px] bg-gradient-to-b from-[#a855f7]/60 via-[#22ff55] to-[#22ff55]/50" />

        <div className="space-y-3">
          {sortedAll.map((item, idx) => {
            const isUpcoming = isFromTodayOnwards(item);
            const rawDate = getItemPrimaryDateString(item);
            const daysDiff = getDaysUntil(rawDate);
            const dateParts = formatTimelineDateLabel(rawDate);
            const catMeta = CATEGORY_BADGES[item.category];
            const showTodayDividerHere = idx === firstUpcomingIndex;

            // Verifica mudança de Mês/Ano para exibir um pequeno cabeçalho de período
            const prevRawDate =
              idx > 0 ? getItemPrimaryDateString(sortedAll[idx - 1]) : null;
            const currentMonthYear = rawDate ? rawDate.slice(0, 7) : '';
            const prevMonthYear = prevRawDate ? prevRawDate.slice(0, 7) : '';
            const showMonthHeader =
              idx === 0 || currentMonthYear !== prevMonthYear;

            const monthTitle = rawDate
              ? new Date(
                  rawDate.length === 10 ? `${rawDate}T12:00:00` : rawDate
                ).toLocaleDateString('pt-BR', {
                  month: 'long',
                  year: 'numeric',
                })
              : 'Data a definir';

            return (
              <React.Fragment key={item.id}>
                {/* MARCADOR DE "HOJE" ENTRE OS PASSADOS E OS FUTUROS */}
                {showTodayDividerHere && (
                  <div className="relative py-3 pl-8 sm:pl-10 flex items-center gap-3 select-none">
                    <div className="absolute left-[9px] sm:left-[11px] w-4 h-4 rounded-full bg-[#22ff55] border-2 border-[#09070e] shadow-[0_0_14px_#22ff55] animate-pulse" />
                    <div className="px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-[#0d3320] text-[#4ade80] border border-[#22ff55]/60 shadow-[0_0_16px_rgba(34,255,85,0.25)]">
                      📍 Hoje • {todayFormatted}
                    </div>
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-[#22ff55]/50 to-transparent" />
                  </div>
                )}

                {/* Cabeçalho compacto de Mês/Ano */}
                {showMonthHeader && (
                  <div className="pt-2 pb-1 pl-8 sm:pl-10">
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#7c738f]">
                      {monthTitle}
                    </span>
                  </div>
                )}

                {/* Item Simplificado da Linha do Tempo */}
                <div
                  id={`media-item-${item.id}`}
                  onClick={() => onOpenModal(item)}
                  className="relative pl-8 sm:pl-10 group cursor-pointer"
                >
                  {/* Ponto (Node) na Linha Vertical */}
                  <div
                    className={`absolute left-[11px] sm:left-[13px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-[#09070e] transition-transform group-hover:scale-125 ${
                      isUpcoming
                        ? 'bg-[#22ff55] shadow-[0_0_10px_#22ff55]'
                        : 'bg-[#a855f7] shadow-[0_0_8px_#a855f7]'
                    }`}
                  />

                  {/* Linha / Card Compacto */}
                  <div
                    className={`rounded-xl px-3.5 py-2.5 bg-[#130f1d]/90 border transition-all flex items-center justify-between gap-3 sm:gap-4 ${
                      isUpcoming
                        ? 'border-white/[0.08] hover:border-[#22ff55]/60'
                        : 'border-white/[0.05] opacity-80 hover:opacity-100 hover:border-[#a855f7]/60'
                    }`}
                  >
                    {/* Bloco de Data à Esquerda */}
                    <div className="w-20 sm:w-24 shrink-0 text-left border-r border-white/[0.07] pr-2.5">
                      <div
                        className={`text-xs sm:text-sm font-mono font-extrabold leading-tight ${
                          isUpcoming ? 'text-white' : 'text-[#c4bcd6]'
                        }`}
                      >
                        {dateParts.dayMonth}
                      </div>
                      <div className="text-[10px] font-mono text-[#7c738f]">
                        {dateParts.year}
                        {dateParts.timeOrType ? ` • ${dateParts.timeOrType}` : ''}
                      </div>
                    </div>

                    {/* Miniatura da Capa */}
                    <div className="w-10 h-14 rounded-lg overflow-hidden xeno-cover-box shrink-0">
                      {item.posterUrl ? (
                        <img
                          src={item.posterUrl}
                          alt={item.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-[#8e86a3]">
                          CAPA
                        </div>
                      )}
                    </div>

                    {/* Título + Categoria + Resumo Simplificado */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-extrabold text-white truncate group-hover:text-[#c084fc] transition-colors">
                          {item.title}
                        </h3>

                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                            isUpcoming ? 'xeno-tag-green' : 'xeno-tag-purple'
                          }`}
                        >
                          {catMeta.icon}
                          <span>{catMeta.label}</span>
                        </span>
                      </div>

                      <p className="text-xs text-[#8e86a3] truncate mt-0.5">
                        {getQuickEventDetail(item)}
                      </p>
                    </div>

                    {/* Badge de Contagem Regressiva / Status Passado + Botão Ovnizinho */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      {daysDiff !== null && (
                        <span
                          className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold ${
                            daysDiff === 0
                              ? 'bg-[#0d3320] text-[#22ff55] border border-[#22ff55]/50'
                              : daysDiff > 0
                              ? 'bg-[#1c142e] text-[#c084fc] border border-[#a855f7]/35'
                              : 'bg-white/[0.04] text-[#8e86a3] border border-white/[0.06]'
                          }`}
                        >
                          {daysDiff === 0 ? (
                            <>
                              <Clock className="w-3 h-3 text-[#22ff55]" />
                              <span>Hoje!</span>
                            </>
                          ) : daysDiff > 0 ? (
                            <>
                              <Calendar className="w-3 h-3 text-[#a855f7]" />
                              <span>
                                {daysDiff === 1
                                  ? 'Amanhã'
                                  : `Em ${daysDiff} dias`}
                              </span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-[#a855f7]" />
                              <span>Há {Math.abs(daysDiff)}d</span>
                            </>
                          )}
                        </span>
                      )}

                      <AbductButton
                        isAbducted={true}
                        onToggle={(e) => onToggleFavorite(item, e)}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {/* Caso todos os itens abduzidos sejam passados, exibe o marcador de Hoje no final */}
          {firstUpcomingIndex === -1 && sortedAll.length > 0 && (
            <div className="relative py-3 pl-8 sm:pl-10 flex items-center gap-3 select-none">
              <div className="absolute left-[9px] sm:left-[11px] w-4 h-4 rounded-full bg-[#22ff55] border-2 border-[#09070e] shadow-[0_0_14px_#22ff55]" />
              <div className="px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-[#0d3320] text-[#4ade80] border border-[#22ff55]/60">
                📍 Hoje • {todayFormatted}
              </div>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-[#22ff55]/50 to-transparent" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
