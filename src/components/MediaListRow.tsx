import React, { useState } from 'react';
import {
  Clock,
  Film,
  ListFilter,
  Gamepad2,
  Star,
  MessageSquareHeart,
  ChevronRight,
  MonitorPlay,
} from 'lucide-react';
import { MediaItem } from '../types/media';
import { formatEpisodeCountdown, formatShortDate } from '../lib/dateUtils';
import { AbductButton } from './AbductButton';
import { StreamingBadges } from './StreamingBadges';

interface MediaListRowProps {
  item: MediaItem;
  isFavorite: boolean;
  isHighlighted?: boolean;
  onToggleFavorite: (item: MediaItem, e: React.MouseEvent) => void;
  onOpenModal: (item: MediaItem) => void;
}

const MONTHS_PT = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
];

function formatXenoDateAndTime(item: MediaItem): {
  dateLine: string;
  timeLine: string;
} {
  const rawDate =
    item.category === 'tv' || item.category === 'anime'
      ? item.nextEpisodeDate
      : item.category === 'movie_digital'
      ? item.digitalReleaseDate || item.cinemaReleaseDate
      : item.category === 'movie_cinema'
      ? item.cinemaReleaseDate
      : item.releaseDate;

  if (!rawDate) {
    return {
      dateLine: 'EM BREVE',
      timeLine: 'A CONFIRMAR',
    };
  }

  try {
    const hasTime = rawDate.length > 10;
    const d = new Date(hasTime ? rawDate : `${rawDate}T18:00:00`);
    if (isNaN(d.getTime())) {
      return { dateLine: 'EM BREVE', timeLine: 'GMT-3' };
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTHS_PT[d.getMonth()];
    const year = d.getFullYear();

    const hours = hasTime ? String(d.getHours()).padStart(2, '0') : '18';
    const mins = hasTime ? String(d.getMinutes()).padStart(2, '0') : '00';

    if (item.category === 'movie_digital' && item.isDigitalAvailable) {
      return {
        dateLine: `${day} ${month} ${year}`,
        timeLine: 'DISPONÍVEL VOD',
      };
    }

    return {
      dateLine: `${day} ${month} ${year}`,
      timeLine: `${hours}:${mins} GMT-3`,
    };
  } catch {
    return { dateLine: 'EM BREVE', timeLine: 'GMT-3' };
  }
}

function formatMovieDuration(mins?: number | null): string {
  if (!mins || mins <= 0) return '2h 15m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatCompactReviews(count?: number): string | null {
  if (!count || count <= 0) return null;
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace('.0', '')}k reviews`;
  }
  return `${count} reviews`;
}

export const MediaListRow: React.FC<MediaListRowProps> = ({
  item,
  isFavorite,
  isHighlighted = false,
  onToggleFavorite,
  onOpenModal,
}) => {
  const [imgError, setImgError] = useState(false);

  const { dateLine, timeLine } = formatXenoDateAndTime(item);
  const reviewsLabel = formatCompactReviews(item.reviewsCount);

  const cleanDirector =
    item.director &&
    !item.director.includes('Circuito Brasil') &&
    !item.director.includes('Disponível no Brasil') &&
    !item.director.includes('Cinema BR')
      ? item.director
      : 'Direção & Estúdio Oficial';

  const studioOrAuthor =
    item.category === 'movie_cinema' || item.category === 'movie_digital'
      ? cleanDirector
      : item.category === 'game'
      ? item.developer || 'Estúdio Oficial'
      : item.studioOrNetwork || 'Estúdio Oficial';

  const getRightHighlightBadge = () => {
    if (item.category === 'tv' || item.category === 'anime') {
      return formatEpisodeCountdown(item.nextEpisodeNumber, item.nextEpisodeDate);
    }
    if (item.category === 'movie_digital') {
      return item.isDigitalAvailable
        ? 'Disponível no Digital'
        : `VOD: ${formatShortDate(item.digitalReleaseDate)}`;
    }
    if (item.category === 'movie_cinema') {
      return `Cinema: ${formatShortDate(item.cinemaReleaseDate)}`;
    }
    return item.hltbLabel || `Lançamento: ${formatShortDate(item.releaseDate)}`;
  };

  const renderBottomMetadata = () => {
    if (item.category === 'tv' || item.category === 'anime') {
      const epText = item.totalEpisodes
        ? `${item.totalEpisodes} Episódios`
        : formatEpisodeCountdown(item.nextEpisodeNumber, item.nextEpisodeDate);
      const durText = `${item.episodeDurationMinutes || 24} min / ep`;

      return (
        <div className="flex flex-wrap items-center gap-5 text-xs sm:text-sm font-medium text-[#968da8]">
          <span className="inline-flex items-center gap-1.5">
            <ListFilter className="w-4 h-4 text-[#a855f7]" />
            <span>{epText}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#22ff55]" />
            <span>{durText}</span>
          </span>
          {item.seasonStatus && (
            <span className="text-[#c084fc] font-semibold">
              • {item.seasonStatus}
            </span>
          )}
        </div>
      );
    }

    if (item.category === 'movie_cinema' || item.category === 'movie_digital') {
      const typeLabel =
        item.category === 'movie_digital'
          ? item.isDigitalAvailable
            ? 'Filme • Disponível no Digital'
            : 'Filme • Digital / VOD'
          : 'Filme • Cinema';

      const crossDateInfo =
        item.category === 'movie_cinema'
          ? item.digitalReleaseDate &&
            item.digitalReleaseDate !== item.cinemaReleaseDate
            ? `Lançamento Digital: ${formatShortDate(item.digitalReleaseDate)}`
            : 'Previsão Digital: A confirmar'
          : item.cinemaReleaseDate &&
            item.cinemaReleaseDate !== item.digitalReleaseDate
          ? `Estreou nos Cinemas: ${formatShortDate(item.cinemaReleaseDate)}`
          : 'Lançamento direto em Streaming / VOD';

      return (
        <div className="flex flex-wrap items-center gap-5 text-xs sm:text-sm font-medium text-[#968da8]">
          <span className="inline-flex items-center gap-1.5">
            <Film className="w-4 h-4 text-[#a855f7]" />
            <span>{typeLabel}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#22ff55]" />
            <span>{formatMovieDuration(item.runtimeMinutes)}</span>
          </span>
          {crossDateInfo && (
            <span className="inline-flex items-center gap-1.5 text-[#c084fc]">
              <MonitorPlay className="w-3.5 h-3.5" />
              <span>{crossDateInfo}</span>
            </span>
          )}
        </div>
      );
    }

    // Games
    const platText =
      item.platforms && item.platforms.length > 0
        ? item.platforms.slice(0, 4).join(', ')
        : 'PC, PS5, Xbox Series';

    return (
      <div className="flex flex-wrap items-center gap-5 text-xs sm:text-sm font-medium text-[#968da8]">
        <span className="inline-flex items-center gap-1.5">
          <Gamepad2 className="w-4 h-4 text-[#a855f7]" />
          <span>{platText}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-[#22ff55]" />
          <span>{item.hltbLabel || 'Tempo: Aguardando dados'}</span>
        </span>
      </div>
    );
  };

  return (
    <article
      onClick={() => onOpenModal(item)}
      className={`xeno-card ${
        isHighlighted ? 'xeno-card-highlighted' : ''
      } p-5 sm:p-6 cursor-pointer flex flex-col sm:flex-row gap-6 items-stretch relative group`}
    >
      {/* COLUNA ESQUERDA: CAPA MAIOR + DATA E HORÁRIO EMBAIXO */}
      <div className="w-32 sm:w-36 lg:w-40 shrink-0 flex flex-col justify-between">
        <div className="w-full aspect-[3/4] xeno-cover-box overflow-hidden relative flex items-center justify-center shadow-lg">
          {!imgError && item.posterUrl ? (
            <img
              src={item.posterUrl}
              alt={item.title}
              loading="lazy"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <span className="text-xs font-bold tracking-[0.22em] text-[#8e86a3] uppercase">
              CAPA
            </span>
          )}
        </div>

        {/* DATA E HORÁRIO ABAIXO DA CAPA */}
        <div className="mt-3 leading-tight bg-[#0c0914]/80 border border-white/[0.05] rounded-xl px-3 py-2 text-center sm:text-left">
          <div className="text-xs font-extrabold tracking-wider text-[#e2dbf0] uppercase font-mono">
            {dateLine}
          </div>
          <div className="text-[11px] text-[#4ade80] font-mono mt-0.5">
            {timeLine}
          </div>
        </div>
      </div>

      {/* COLUNA CENTRAL: TÍTULO + TAGS, ESTÚDIO, SINOPSE AMPLA E METADADOS */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div className="space-y-2.5">
          {/* Linha 1: Título + Tags de Gênero + Nota/Reviews */}
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-white tracking-tight group-hover:text-[#c084fc] transition-colors leading-tight">
              {item.title}
            </h3>

            <div className="flex flex-wrap items-center gap-1.5">
              <StreamingBadges platforms={item.streamingPlatforms} size="sm" />

              {item.genres.slice(0, 3).map((genre, idx) => (
                <span
                  key={genre}
                  className={`px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${
                    idx % 2 === 0 ? 'xeno-tag-purple' : 'xeno-tag-green'
                  }`}
                >
                  {genre}
                </span>
              ))}

              {item.rating && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-white/[0.05] text-[#fbbf24] border border-white/[0.08] inline-flex items-center gap-1">
                  <Star className="w-3 h-3 fill-[#fbbf24]" />
                  <span>{item.rating.toFixed(1)}</span>
                </span>
              )}

              {reviewsLabel && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#1c1330] text-[#c084fc] border border-[#a855f7]/30 inline-flex items-center gap-1">
                  <MessageSquareHeart className="w-3 h-3 text-[#22ff55]" />
                  <span>{reviewsLabel}</span>
                </span>
              )}
            </div>
          </div>

          {/* Linha 2: Estúdio / Autor / Diretor */}
          <p className="text-sm sm:text-base font-semibold text-[#d8d0e8]">
            {studioOrAuthor}
          </p>

          {/* Linha 3: Sinopse ocupando o espaço central sem limite estreito */}
          <p className="text-xs sm:text-sm lg:text-[15px] text-[#968da8] leading-relaxed pt-1 line-clamp-3">
            {item.synopsis}
          </p>
        </div>

        {/* Linha 4: Metadados inferiores */}
        <div className="pt-4 mt-3 border-t border-white/[0.05]">
          {renderBottomMetadata()}
        </div>
      </div>

      {/* COLUNA DIREITA DE STATUS & ABDUÇÃO (PREENCHE O CANTO DIREITO DO CARD NO PC) */}
      <div className="sm:w-48 lg:w-56 shrink-0 sm:border-l sm:border-white/[0.06] sm:pl-5 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/[0.06] flex flex-row sm:flex-col items-center sm:items-end justify-between gap-3">
        {/* Botão de Abduzir com Cápsula */}
        <div
          onClick={(e) => e.stopPropagation()}
          className={`rounded-2xl px-3.5 py-1.5 border transition-all ${
            isFavorite
              ? 'bg-[#0d3320]/80 border-[#22ff55]/60 shadow-[0_0_16px_rgba(34,255,85,0.2)]'
              : 'bg-[#161124] border-white/10 hover:border-[#a855f7]/60'
          }`}
        >
          <AbductButton
            isAbducted={isFavorite}
            onToggle={(e) => onToggleFavorite(item, e)}
            size="sm"
            showLabel
          />
        </div>

        {/* Status Rápido & Call-to-action */}
        <div className="text-right space-y-1.5">
          <div className="inline-block px-3 py-1.5 rounded-xl bg-[#0c0914] border border-[#a855f7]/35 text-xs font-mono font-bold text-[#4ade80]">
            {getRightHighlightBadge()}
          </div>
          <div className="hidden sm:flex items-center justify-end gap-1 text-[11px] font-bold text-[#8e86a3] group-hover:text-[#c084fc] transition-colors">
            <span>Ficha completa</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </article>
  );
};
