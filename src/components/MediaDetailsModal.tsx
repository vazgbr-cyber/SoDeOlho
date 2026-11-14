import React, { useEffect, useState } from 'react';
import {
  X,
  Film,
  MonitorPlay,
  Calendar,
  User,
  Gamepad2,
  Clock,
  Tv,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Star,
  Layers,
} from 'lucide-react';
import { AppSettings, MediaItem } from '../types/media';
import {
  formatDateTime,
  formatEpisodeCountdown,
  formatFullDate,
} from '../lib/dateUtils';
import {
  resolveHltbForGame,
  resolveMovieReleaseDatesInBrazil,
} from '../services/apiService';
import { AbductButton } from './AbductButton';
import { BrandLogo } from './ProcessedImages';
import { StreamingBadges } from './StreamingBadges';

interface MediaDetailsModalProps {
  item: MediaItem | null;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: (item: MediaItem, e: React.MouseEvent) => void;
  settings: AppSettings;
  onUpdateItem?: (updated: MediaItem) => void;
}

export const MediaDetailsModal: React.FC<MediaDetailsModalProps> = ({
  item,
  isFavorite,
  onClose,
  onToggleFavorite,
  settings,
  onUpdateItem,
}) => {
  const [checkingHltb, setCheckingHltb] = useState(false);

  useEffect(() => {
    if (!item) return;
    const isMovieItem =
      item.category === 'movie_cinema' || item.category === 'movie_digital';
    if (!isMovieItem) return;

    // Se faltar uma das duas datas (ou se por acaso vieram iguais) ou se o diretor ainda for genérico, consulta o endpoint detalhado da TMDB
    const hasGenericDirector =
      !item.director ||
      item.director.includes('Circuito Brasil') ||
      item.director.includes('Disponível no Brasil') ||
      item.director.includes('Direção & Estúdio');

    const needsLookup =
      !item.cinemaReleaseDate ||
      !item.digitalReleaseDate ||
      item.cinemaReleaseDate === item.digitalReleaseDate ||
      hasGenericDirector;

    if (!needsLookup) return;

    let cancelled = false;
    resolveMovieReleaseDatesInBrazil(item.externalId, settings).then((res) => {
      if (cancelled) return;
      const nextCinema =
        item.category === 'movie_cinema'
          ? res.cinemaDate || item.cinemaReleaseDate || null
          : res.cinemaDate && res.cinemaDate !== item.digitalReleaseDate
          ? res.cinemaDate
          : null;

      const nextDigital =
        item.category === 'movie_digital'
          ? res.digitalDate || item.digitalReleaseDate || null
          : res.digitalDate && res.digitalDate !== item.cinemaReleaseDate
          ? res.digitalDate
          : null;

      const nextDirector = res.directorAndCompany || item.director;

      if (
        nextCinema !== item.cinemaReleaseDate ||
        nextDigital !== item.digitalReleaseDate ||
        nextDirector !== item.director ||
        (res.runtimeMinutes && res.runtimeMinutes !== item.runtimeMinutes)
      ) {
        onUpdateItem?.({
          ...item,
          director: nextDirector,
          cinemaReleaseDate: nextCinema,
          digitalReleaseDate: nextDigital,
          runtimeMinutes: res.runtimeMinutes || item.runtimeMinutes,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [item, settings, onUpdateItem]);

  if (!item) return null;

  const isMovie =
    item.category === 'movie_cinema' || item.category === 'movie_digital';
  const isSeriesOrAnime = item.category === 'tv' || item.category === 'anime';
  const isGame = item.category === 'game';

  const handleRefreshHltb = async () => {
    setCheckingHltb(true);
    try {
      const res = await resolveHltbForGame(item.title, item.externalId, settings);
      const updated: MediaItem = {
        ...item,
        hltbMainHours: res.mainHours ?? item.hltbMainHours,
        hltbExtraHours: res.extraHours ?? item.hltbExtraHours,
        completionistHours: res.completionistHours ?? item.hltbCompletionistHours,
        hltbLabel: res.mainHours ? res.label : item.hltbLabel || res.label,
      } as MediaItem;
      onUpdateItem?.(updated);
    } finally {
      setCheckingHltb(false);
    }
  };

  const hasDistinctCinemaDate =
    item.cinemaReleaseDate &&
    (item.category === 'movie_cinema' ||
      item.cinemaReleaseDate !== item.digitalReleaseDate);

  const cinemaDateFormatted = hasDistinctCinemaDate
    ? formatFullDate(item.cinemaReleaseDate)
    : item.category === 'movie_digital'
    ? 'Lançamento direto em Streaming / VOD'
    : 'Data nos cinemas não divulgada';

  const hasDistinctDigitalDate =
    item.digitalReleaseDate &&
    (item.category === 'movie_digital' ||
      item.digitalReleaseDate !== item.cinemaReleaseDate);

  const digitalDateFormatted = hasDistinctDigitalDate
    ? item.isDigitalAvailable
      ? `${formatFullDate(item.digitalReleaseDate)} (Disponível no Digital)`
      : formatFullDate(item.digitalReleaseDate)
    : 'Previsão Digital: Ainda não divulgada';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="xeno-modal w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Barra Superior do Modal */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#161124] border-b border-white/[0.07]">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo size={28} />
            <span className="text-sm font-bold text-white truncate">
              {item.title}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-[#a855f7]/20 text-[#968da8] hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Topo: Capa + Título + Tags + Abduzir */}
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            <div className="w-36 sm:w-40 aspect-[3/4] xeno-cover-box overflow-hidden shrink-0 shadow-xl">
              <img
                src={item.posterUrl}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 text-center sm:text-left space-y-3">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <StreamingBadges platforms={item.streamingPlatforms} size="sm" />

                {item.genres.map((genre, idx) => (
                  <span
                    key={genre}
                    className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                      idx % 2 === 0 ? 'xeno-tag-purple' : 'xeno-tag-green'
                    }`}
                  >
                    {genre}
                  </span>
                ))}

                {item.rating && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-white/[0.06] text-[#fbbf24] flex items-center gap-1">
                    <Star className="w-3 h-3 fill-[#fbbf24]" />
                    {item.rating.toFixed(1)}
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {item.title}
                </h2>
                <p className="text-sm font-semibold text-[#c4bcd6] mt-1">
                  {item.director || item.studioOrNetwork || item.developer}
                </p>
              </div>

              <p className="text-sm text-[#968da8] leading-relaxed">
                {item.synopsis}
              </p>

              <div className="pt-2">
                <div
                  className={`inline-flex rounded-xl px-4 py-1 border transition-all ${
                    isFavorite
                      ? 'bg-[#0d3320]/80 border-[#22ff55]/60 shadow-[0_0_16px_rgba(34,255,85,0.2)]'
                      : 'bg-[#1c142e] border-[#a855f7]/40 hover:border-[#a855f7]'
                  }`}
                >
                  <AbductButton
                    isAbducted={isFavorite}
                    onToggle={(e) => onToggleFavorite(item, e)}
                    size="sm"
                    showLabel
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Ficha Técnica Dinâmica */}
          <div className="rounded-2xl p-5 bg-[#0c0914] border border-white/[0.07] space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[#a855f7] flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>Ficha Técnica Completa</span>
            </h3>

            {isMovie && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-3.5 rounded-xl bg-[#130f1d] border border-white/[0.05]">
                  <div className="flex items-center gap-1.5 text-xs text-[#8e86a3]">
                    <User className="w-3.5 h-3.5 text-[#a855f7]" />
                    <span>Direção / Estúdio</span>
                  </div>
                  <p className="text-sm font-bold text-white mt-1">
                    {item.director || 'Não informado'}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#130f1d] border border-white/[0.05]">
                  <div className="flex items-center gap-1.5 text-xs text-[#8e86a3]">
                    <Film className="w-3.5 h-3.5 text-[#a855f7]" />
                    <span>Estreia nos Cinemas</span>
                  </div>
                  <p className="text-sm font-mono font-bold text-white mt-1">
                    {cinemaDateFormatted}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#130f1d] border border-white/[0.05]">
                  <div className="flex items-center gap-1.5 text-xs text-[#8e86a3]">
                    <MonitorPlay className="w-3.5 h-3.5 text-[#22ff55]" />
                    <span>Lançamento Digital / VOD</span>
                  </div>
                  <p className="text-sm font-mono font-bold text-[#4ade80] mt-1">
                    {digitalDateFormatted}
                  </p>
                </div>
              </div>
            )}

            {isGame && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-3.5 rounded-xl bg-[#130f1d] border border-white/[0.05]">
                  <div className="flex items-center gap-1.5 text-xs text-[#8e86a3]">
                    <Gamepad2 className="w-3.5 h-3.5 text-[#a855f7]" />
                    <span>Plataformas</span>
                  </div>
                  <p className="text-sm font-bold text-white mt-1">
                    {(item.platforms || ['PC', 'PS5', 'Xbox Series']).join(', ')}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#130f1d] border border-white/[0.05]">
                  <div className="flex items-center gap-1.5 text-xs text-[#8e86a3]">
                    <Calendar className="w-3.5 h-3.5 text-[#a855f7]" />
                    <span>Data de Lançamento</span>
                  </div>
                  <p className="text-sm font-mono font-bold text-white mt-1">
                    {formatFullDate(item.releaseDate)}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#130f1d] border border-white/[0.05]">
                  <div className="flex items-center justify-between text-xs text-[#8e86a3]">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#22ff55]" />
                      <span>HowLongToBeat</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleRefreshHltb}
                      disabled={checkingHltb}
                      className="text-[10px] text-[#a855f7] hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${checkingHltb ? 'animate-spin' : ''}`} />
                      Atualizar
                    </button>
                  </div>
                  <p className="text-sm font-mono font-bold text-[#4ade80] mt-1">
                    {item.hltbLabel || 'Tempo: Aguardando dados'}
                  </p>
                </div>
              </div>
            )}

            {isSeriesOrAnime && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-3.5 rounded-xl bg-[#130f1d] border border-white/[0.05]">
                  <div className="flex items-center gap-1.5 text-xs text-[#8e86a3]">
                    {item.category === 'anime' ? (
                      <Sparkles className="w-3.5 h-3.5 text-[#a855f7]" />
                    ) : (
                      <Tv className="w-3.5 h-3.5 text-[#a855f7]" />
                    )}
                    <span>Episódios & Duração</span>
                  </div>
                  <p className="text-sm font-bold text-white mt-1">
                    {item.totalEpisodes ? `${item.totalEpisodes} Episódios` : 'Em exibição'} •{' '}
                    {item.episodeDurationMinutes || 24} min/ep
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#130f1d] border border-white/[0.05]">
                  <div className="flex items-center gap-1.5 text-xs text-[#8e86a3]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#a855f7]" />
                    <span>Status da Temporada</span>
                  </div>
                  <p className="text-sm font-bold text-white mt-1">
                    {item.seasonStatus || 'Em Exibição Semanal'}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#130f1d] border border-white/[0.05]">
                  <div className="flex items-center gap-1.5 text-xs text-[#8e86a3]">
                    <Clock className="w-3.5 h-3.5 text-[#22ff55]" />
                    <span>Próximo Episódio</span>
                  </div>
                  <p className="text-sm font-mono font-bold text-[#4ade80] mt-1">
                    {formatEpisodeCountdown(item.nextEpisodeNumber, item.nextEpisodeDate)}
                  </p>
                  <p className="text-[11px] text-[#8e86a3] mt-0.5">
                    {formatDateTime(item.nextEpisodeDate)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
