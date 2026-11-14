import React, { useState } from 'react';
import {
  Clock,
  Calendar,
} from 'lucide-react';
import { MediaItem } from '../types/media';
import {
  formatEpisodeCountdown,
  formatShortDate,
} from '../lib/dateUtils';
import { AbductButton } from './AbductButton';
import { StreamingBadges } from './StreamingBadges';

interface MediaCardProps {
  item: MediaItem;
  isFavorite: boolean;
  onToggleFavorite: (item: MediaItem, e: React.MouseEvent) => void;
  onOpenModal: (item: MediaItem) => void;
  showCategoryBadge?: boolean;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  isFavorite,
  onToggleFavorite,
  onOpenModal,
}) => {
  const [imgError, setImgError] = useState(false);

  const getStatusText = () => {
    if (item.category === 'tv' || item.category === 'anime') {
      return formatEpisodeCountdown(item.nextEpisodeNumber, item.nextEpisodeDate);
    }
    if (item.category === 'movie_digital') {
      return item.isDigitalAvailable
        ? 'Disponível no Digital'
        : `Digital: ${formatShortDate(item.digitalReleaseDate)}`;
    }
    if (item.category === 'movie_cinema') {
      return `Cinema: ${formatShortDate(item.cinemaReleaseDate)}`;
    }
    return item.hltbLabel || `Estreia: ${formatShortDate(item.releaseDate)}`;
  };

  return (
    <article
      onClick={() => onOpenModal(item)}
      className="xeno-card p-4 cursor-pointer flex flex-col justify-between group"
    >
      <div>
        {/* Capa */}
        <div className="relative aspect-[3/4] w-full xeno-cover-box overflow-hidden mb-3.5">
          {!imgError && item.posterUrl ? (
            <img
              src={item.posterUrl}
              alt={item.title}
              loading="lazy"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-xs font-bold tracking-[0.22em] text-[#8e86a3] uppercase">
                CAPA
              </span>
            </div>
          )}

          {/* Ovnizinho no topo direito */}
          <div className="absolute top-2 right-2 w-11 h-11 rounded-full bg-[#0c0914]/90 border border-white/15 flex items-center justify-center shadow-lg">
            <AbductButton
              isAbducted={isFavorite}
              onToggle={(e) => onToggleFavorite(item, e)}
              size="sm"
            />
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          <StreamingBadges platforms={item.streamingPlatforms} size="xs" />
          {item.genres.slice(0, 2).map((genre, idx) => (
            <span
              key={genre}
              className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                idx % 2 === 0 ? 'xeno-tag-purple' : 'xeno-tag-green'
              }`}
            >
              {genre}
            </span>
          ))}
        </div>

        {/* Título */}
        <h3 className="text-base font-extrabold text-white line-clamp-1 group-hover:text-[#c084fc] transition-colors">
          {item.title}
        </h3>

        <p className="text-xs text-[#8e86a3] mt-0.5 line-clamp-1">
          {(item.director &&
          !item.director.includes('Circuito Brasil') &&
          !item.director.includes('Disponível no Brasil') &&
          !item.director.includes('Cinema BR')
            ? item.director
            : null) ||
            item.studioOrNetwork ||
            item.developer ||
            'Direção & Estúdio Oficial'}
        </p>
      </div>

      {/* Rodapé do Card */}
      <div className="pt-3 mt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#a39bb5]">
        <span className="inline-flex items-center gap-1.5 font-medium">
          {item.category === 'tv' || item.category === 'anime' || item.category === 'game' ? (
            <Clock className="w-3.5 h-3.5 text-[#22ff55]" />
          ) : (
            <Calendar className="w-3.5 h-3.5 text-[#a855f7]" />
          )}
          <span className="truncate">{getStatusText()}</span>
        </span>
      </div>
    </article>
  );
};
