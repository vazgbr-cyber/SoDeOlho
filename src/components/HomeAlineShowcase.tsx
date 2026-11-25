import React, { useMemo } from 'react';
import { Flame, MessageSquareHeart, Star } from 'lucide-react';
import { MediaItem } from '../types/media';
import { AbductButton } from './AbductButton';

interface HomeAlineShowcaseProps {
  allItems: MediaItem[];
  isItemFavorite: (item: MediaItem) => boolean;
  onToggleFavorite: (item: MediaItem, e: React.MouseEvent) => void;
  onOpenModal: (item: MediaItem) => void;
}

function formatCompactReviews(count?: number): string {
  if (!count || count <= 0) return 'Em alta';
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace('.0', '')}k reviews`;
  }
  return `${count} reviews`;
}

export const HomeAlineShowcase: React.FC<HomeAlineShowcaseProps> = ({
  allItems,
  isItemFavorite,
  onToggleFavorite,
  onOpenModal,
}) => {
  // Filtra e ordena as mídias mais hypadas da semana com base no número de pessoas avaliando/dando review nas APIs
  const weeklyHypedItems = useMemo(() => {
    const now = Date.now();
    const dayMs = 86400000;

    const uniqueByExternal = new Map<string, MediaItem>();
    for (const item of allItems) {
      if (!uniqueByExternal.has(item.externalId)) {
        uniqueByExternal.set(item.externalId, item);
      }
    }

    const pool = Array.from(uniqueByExternal.values());

    const scored = pool.map((item) => {
      const rawDate =
        item.nextEpisodeDate ||
        item.cinemaReleaseDate ||
        item.digitalReleaseDate ||
        item.releaseDate;
      const itemMs = rawDate ? new Date(rawDate).getTime() : now;
      const diffDays = Math.abs(itemMs - now) / dayMs;

      const isNearCurrentWeek = diffDays <= 28;
      const baseReviews =
        item.reviewsCount || (item.rating ? Math.round(item.rating * 3500) : 2500);
      const hypeScore = isNearCurrentWeek
        ? baseReviews * 1.6
        : baseReviews * 0.65;

      return { item, hypeScore, baseReviews };
    });

    scored.sort((a, b) => b.hypeScore - a.hypeScore);
    return scored.slice(0, 6);
  }, [allItems]);

  return (
    <section
      aria-label="Mídias em Alta na Semana"
      className="relative mb-9 rounded-3xl bg-gradient-to-r from-[#130e22]/90 via-[#100b1c]/80 to-[#150f26]/90 border border-white/[0.08] px-6 sm:px-9 xl:px-11 pt-6 pb-7 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
    >
      {/* Luzes atmosféricas de fundo */}
      <div className="pointer-events-none absolute right-6 -top-12 w-[480px] h-[480px] rounded-full bg-[#a855f7]/22 blur-[120px]" />
      <div className="pointer-events-none absolute right-36 bottom-0 w-[380px] h-[380px] rounded-full bg-[#22ff55]/14 blur-[110px]" />
      <div className="pointer-events-none absolute -left-16 -top-16 w-[320px] h-[320px] rounded-full bg-[#a855f7]/10 blur-[100px]" />

      <div className="relative z-10 space-y-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#1c1233] border border-[#a855f7]/45 text-xs font-bold uppercase tracking-widest text-[#c084fc]">
            <Flame className="w-3.5 h-3.5 text-[#22ff55]" />
            <span>Radar Intergaláctico • Destaques da Semana</span>
          </div>

          <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black tracking-tight text-white leading-none">
            SÓ DE{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#22ff55] via-[#4ade80] to-[#a855f7] drop-shadow-[0_0_24px_rgba(34,255,85,0.35)]">
              OLHO
            </span>
          </h1>

          <p className="text-base sm:text-lg xl:text-xl font-semibold text-[#e6dff5] max-w-3xl leading-relaxed">
            Acompanhe os lançamentos mais aguardados de filmes, séries, animes e games no Brasil!
          </p>
        </div>

        {/* BLOCO MINIMALISTA: "Veja o que está em alta nessa semana:" + CAPAS EM TODA A LARGURA */}
        <div className="space-y-3.5 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-[#4ade80] flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22ff55] shadow-[0_0_10px_#22ff55]" />
              <span>Veja o que está em alta nessa semana:</span>
            </h2>
            <span className="text-xs text-[#968da8] inline-flex items-center gap-1.5 bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.06]">
              <MessageSquareHeart className="w-3.5 h-3.5 text-[#a855f7]" />
              <span>Ranking por volume de reviews nas APIs</span>
            </span>
          </div>

          {/* Grade Minimalista de Capas aproveitando toda a largura */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {weeklyHypedItems.map(({ item, baseReviews }, index) => {
              const fav = isItemFavorite(item);
              return (
                <div
                  key={`hype-${item.id}`}
                  onClick={() => onOpenModal(item)}
                  title={`${item.title} • ${formatCompactReviews(baseReviews)}`}
                  className="group relative cursor-pointer"
                >
                  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-[#161124] border border-white/10 group-hover:border-[#22ff55]/85 transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_12px_30px_rgba(34,255,85,0.28)]">
                    <img
                      src={item.posterUrl}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent opacity-70 group-hover:opacity-90 transition-opacity" />

                    {/* Posição no Hype da Semana */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-[#a855f7]/50 text-[10px] font-mono font-black text-[#c084fc]">
                      #{index + 1}
                    </div>

                    {/* Botão rápido de abduzir no canto superior direito */}
                    <div
                      className={`absolute top-1.5 right-1.5 z-10 transition-opacity ${
                        fav ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="rounded-full bg-black/75 backdrop-blur-md p-0.5 border border-white/15">
                        <AbductButton
                          isAbducted={fav}
                          onToggle={(e) => onToggleFavorite(item, e)}
                          size="sm"
                        />
                      </div>
                    </div>

                    {/* Contador minimalista de reviews + nota na base da capa */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1 text-[10px] font-mono font-bold">
                      <span className="truncate px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-sm border border-white/10 text-[#4ade80]">
                        {formatCompactReviews(baseReviews)}
                      </span>
                      {item.rating && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded bg-black/75 text-[#fbbf24] inline-flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-[#fbbf24]" />
                          {item.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mt-2 text-xs font-bold text-[#d8d0eb] group-hover:text-white truncate text-center transition-colors">
                    {item.title}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
