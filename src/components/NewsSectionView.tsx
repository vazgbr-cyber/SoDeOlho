import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ExternalLink,
  Film,
  Gamepad2,
  Loader2,
  Newspaper,
  Play,
  RefreshCw,
  Sparkles,
  Tv,
  X,
} from 'lucide-react';
import { MediaItem } from '../types/media';
import {
  NewsArticleItem,
  NewsMediaFilter,
} from '../services/newsAndDiscoverService';
import { AbductButton } from './AbductButton';

interface NewsSectionViewProps {
  newsItems: NewsArticleItem[];
  isLoading: boolean;
  onRefresh: () => void;
  isItemFavorite: (item: MediaItem) => boolean;
  onToggleFavorite: (item: MediaItem, e: React.MouseEvent) => void;
  onOpenModal: (item: MediaItem) => void;
}

const FILTER_TABS: Array<{ id: NewsMediaFilter; label: string }> = [
  { id: 'all', label: 'Tudo' },
  { id: 'trailer', label: '🎬 Lançamentos de Trailers' },
  { id: 'release_date', label: '📅 Novas Datas Confirmadas' },
  { id: 'movie', label: 'Filmes' },
  { id: 'tv_anime', label: 'Séries & Animes' },
  { id: 'game', label: 'Games' },
];

export const NewsSectionView: React.FC<NewsSectionViewProps> = ({
  newsItems,
  isLoading,
  onRefresh,
  isItemFavorite,
  onToggleFavorite,
  onOpenModal,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<NewsMediaFilter>('all');
  const [activeTrailer, setActiveTrailer] = useState<{
    youtubeKey: string;
    title: string;
    linkedItem?: MediaItem;
  } | null>(null);

  const filteredNews = useMemo(() => {
    return newsItems.filter((item) => {
      if (selectedFilter === 'all') return true;
      if (selectedFilter === 'trailer') return Boolean(item.youtubeKey) || item.kind === 'trailer';
      if (selectedFilter === 'release_date') return item.kind === 'release_date' || Boolean(item.releaseDateLabel);
      return item.mediaGroup === selectedFilter;
    });
  }, [newsItems, selectedFilter]);

  const featuredNews = useMemo(() => {
    return (
      filteredNews.find((n) => Boolean(n.youtubeKey && n.imageUrl)) ||
      filteredNews[0] ||
      null
    );
  }, [filteredNews]);

  const gridNews = useMemo(() => {
    if (!featuredNews) return filteredNews;
    return filteredNews.filter((n) => n.id !== featuredNews.id);
  }, [filteredNews, featuredNews]);

  return (
    <div className="space-y-7">
      {/* BARRA DE FILTROS DA ABA DE NOTÍCIAS & TRAILERS */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_TABS.map((tab) => {
            const active = selectedFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedFilter(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all ${
                  active
                    ? 'bg-[#0d3320] text-[#4ade80] border border-[#22ff55]/60 shadow-[0_0_16px_rgba(34,255,85,0.2)]'
                    : 'bg-[#130f1d] text-[#968da8] hover:text-white border border-white/[0.07]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="px-3.5 py-2 rounded-xl bg-[#2a174a]/80 hover:bg-[#381f63] text-[#c084fc] hover:text-white border border-[#a855f7]/45 text-xs font-extrabold flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Atualizar Radar de Notícias</span>
        </button>
      </div>

      {isLoading && newsItems.length === 0 ? (
        <div className="xeno-card p-14 text-center max-w-md mx-auto my-8 space-y-3">
          <Loader2 className="w-8 h-8 text-[#22ff55] mx-auto animate-spin" />
          <h3 className="text-base font-bold text-white">
            Sintonizando transmissões de trailers e novas datas...
          </h3>
          <p className="text-xs text-[#8e86a3]">
            Consultando novos trailers oficiais e anúncios de datas de filmes, séries, animes e games.
          </p>
        </div>
      ) : featuredNews ? (
        <>
          {/* DESTAQUE PRINCIPAL (HERO DE NOTÍCIA / TRAILER) */}
          <div className="xeno-card overflow-hidden border border-[#a855f7]/45 shadow-[0_0_32px_rgba(168,85,247,0.16)]">
            <div className="grid grid-cols-1 lg:grid-cols-12">
              <div className="lg:col-span-7 relative min-h-[260px] sm:min-h-[340px] bg-[#0c0914] overflow-hidden group">
                <img
                  src={featuredNews.imageUrl}
                  alt={featuredNews.title}
                  className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#09070e] via-[#09070e]/35 to-transparent" />

                {featuredNews.youtubeKey && (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveTrailer({
                        youtubeKey: featuredNews.youtubeKey!,
                        title: featuredNews.title,
                        linkedItem: featuredNews.linkedMediaItem,
                      })
                    }
                    className="absolute inset-0 flex items-center justify-center group/play"
                    title="Assistir Trailer Oficial"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#0d3320]/90 border-2 border-[#22ff55] flex items-center justify-center shadow-[0_0_30px_rgba(34,255,85,0.6)] group-hover/play:scale-110 transition-transform">
                      <Play className="w-8 h-8 text-[#22ff55] fill-[#22ff55] ml-1" />
                    </div>
                  </button>
                )}

                <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-[#0d3320] text-[#4ade80] border border-[#22ff55]/60 shadow-lg">
                    Destaque • {featuredNews.categoryLabel}
                  </span>
                  {featuredNews.releaseDateLabel && (
                    <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-[#2a174a]/95 text-[#e9d5ff] border border-[#a855f7]/60 shadow-lg flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#22ff55]" />
                      <span>{featuredNews.releaseDateLabel}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between bg-[#130f1d]/95">
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-[#8e86a3] font-mono">
                    <span>{featuredNews.sourceName}</span>
                    {featuredNews.linkedMediaItem && (
                      <AbductButton
                        isAbducted={isItemFavorite(featuredNews.linkedMediaItem)}
                        onToggle={(e) =>
                          onToggleFavorite(featuredNews.linkedMediaItem!, e)
                        }
                        size="sm"
                        showLabel
                      />
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-extrabold text-white leading-snug">
                    {featuredNews.title}
                  </h2>

                  <p className="text-sm text-[#a69ec0] leading-relaxed line-clamp-5">
                    {featuredNews.summary}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-white/[0.07] flex flex-wrap items-center gap-3">
                  {featuredNews.youtubeKey && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTrailer({
                          youtubeKey: featuredNews.youtubeKey!,
                          title: featuredNews.title,
                          linkedItem: featuredNews.linkedMediaItem,
                        })
                      }
                      className="px-4 py-2.5 rounded-xl bg-[#0d3320] hover:bg-[#144d30] text-[#4ade80] border border-[#22ff55]/60 text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_20px_rgba(34,255,85,0.2)] transition"
                    >
                      <Play className="w-4 h-4 fill-[#4ade80]" />
                      <span>Assistir Trailer Agora</span>
                    </button>
                  )}

                  {featuredNews.linkedMediaItem && (
                    <button
                      type="button"
                      onClick={() => onOpenModal(featuredNews.linkedMediaItem!)}
                      className="px-4 py-2.5 rounded-xl bg-[#2a174a] hover:bg-[#3b2166] text-[#c084fc] hover:text-white border border-[#a855f7]/50 text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition"
                    >
                      <Sparkles className="w-4 h-4 text-[#22ff55]" />
                      <span>Ver Ficha da Mídia</span>
                    </button>
                  )}

                  {featuredNews.externalUrl && (
                    <a
                      href={featuredNews.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-bold flex items-center gap-2 transition"
                    >
                      <span>Ler Matéria Completa</span>
                      <ExternalLink className="w-3.5 h-3.5 text-[#a855f7]" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* GRADE DE NOTÍCIAS, NOVAS DATAS E TRAILERS */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {gridNews.map((news) => {
              const MediaIcon =
                news.mediaGroup === 'game'
                  ? Gamepad2
                  : news.mediaGroup === 'tv_anime'
                  ? Tv
                  : Film;

              return (
                <article
                  key={news.id}
                  className="xeno-card overflow-hidden flex flex-col justify-between group border border-white/[0.07] hover:border-[#a855f7]/50 transition-all"
                >
                  <div>
                    {/* Imagem / Thumbnail com botão de Play se tiver trailer */}
                    <div className="relative aspect-video w-full bg-[#0c0914] overflow-hidden">
                      <img
                        src={news.imageUrl}
                        alt={news.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#09070e] via-transparent to-black/30" />

                      {news.youtubeKey && (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveTrailer({
                              youtubeKey: news.youtubeKey!,
                              title: news.title,
                              linkedItem: news.linkedMediaItem,
                            })
                          }
                          className="absolute inset-0 flex items-center justify-center"
                          title="Assistir Trailer Oficial"
                        >
                          <div className="w-12 h-12 rounded-full bg-[#0d3320]/90 border border-[#22ff55] flex items-center justify-center shadow-[0_0_20px_rgba(34,255,85,0.5)] group-hover:scale-110 transition-transform">
                            <Play className="w-5 h-5 text-[#22ff55] fill-[#22ff55] ml-0.5" />
                          </div>
                        </button>
                      )}

                      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                            news.youtubeKey
                              ? 'bg-[#0d3320]/95 text-[#4ade80] border border-[#22ff55]/50'
                              : 'bg-[#2a174a]/95 text-[#c084fc] border border-[#a855f7]/50'
                          }`}
                        >
                          <MediaIcon className="w-3 h-3" />
                          <span>{news.categoryLabel}</span>
                        </span>
                      </div>

                      {news.linkedMediaItem && (
                        <div className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-[#0c0914]/90 border border-white/15 flex items-center justify-center shadow-lg">
                          <AbductButton
                            isAbducted={isItemFavorite(news.linkedMediaItem)}
                            onToggle={(e) =>
                              onToggleFavorite(news.linkedMediaItem!, e)
                            }
                            size="sm"
                          />
                        </div>
                      )}

                      {news.releaseDateLabel && (
                        <div className="absolute bottom-2.5 left-3">
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#0c0914]/90 text-[#4ade80] border border-[#22ff55]/35 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#22ff55]" />
                            <span>{news.releaseDateLabel}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Conteúdo textual */}
                    <div className="p-5 space-y-2.5">
                      <div className="text-[11px] font-mono text-[#7c738f]">
                        {news.sourceName}
                      </div>

                      <h3 className="text-base font-extrabold text-white leading-snug group-hover:text-[#c084fc] transition-colors line-clamp-2">
                        {news.title}
                      </h3>

                      <p className="text-xs text-[#968da8] leading-relaxed line-clamp-3">
                        {news.summary}
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="px-5 pb-5 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                    {news.youtubeKey ? (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveTrailer({
                            youtubeKey: news.youtubeKey!,
                            title: news.title,
                            linkedItem: news.linkedMediaItem,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-[#0d3320] hover:bg-[#144d30] text-[#4ade80] border border-[#22ff55]/45 text-xs font-extrabold flex items-center gap-1.5 transition"
                      >
                        <Play className="w-3.5 h-3.5 fill-[#4ade80]" />
                        <span>Assistir Trailer</span>
                      </button>
                    ) : news.externalUrl ? (
                      <a
                        href={news.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-[#d8d0ec] text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <span>Ler Notícia</span>
                        <ExternalLink className="w-3.5 h-3.5 text-[#a855f7]" />
                      </a>
                    ) : (
                      <span className="text-[11px] font-mono text-[#4ade80]">
                        ● Data Confirmada
                      </span>
                    )}

                    {news.linkedMediaItem && (
                      <button
                        type="button"
                        onClick={() => onOpenModal(news.linkedMediaItem!)}
                        className="text-xs font-bold text-[#c084fc] hover:text-white transition"
                      >
                        Ver Ficha →
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="xeno-card p-12 text-center max-w-md mx-auto my-8 space-y-3">
          <Newspaper className="w-8 h-8 text-[#a855f7] mx-auto" />
          <h3 className="text-lg font-bold text-white">
            Nenhuma notícia encontrada neste filtro
          </h3>
          <p className="text-xs text-[#8e86a3]">
            Experimente selecionar "Tudo" acima ou clique em "Atualizar Radar de Notícias".
          </p>
        </div>
      )}

      {/* MODAL EMBUTIDO PARA ASSISTIR AO TRAILER OFICIAL NO YOUTUBE */}
      {activeTrailer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={() => setActiveTrailer(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="xeno-modal w-full max-w-4xl overflow-hidden border border-[#22ff55]/50 shadow-[0_0_40px_rgba(34,255,85,0.25)]"
          >
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#140e24] border-b border-white/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <Play className="w-4 h-4 text-[#22ff55] fill-[#22ff55] shrink-0" />
                <h3 className="text-sm font-extrabold text-white truncate">
                  {activeTrailer.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setActiveTrailer(null)}
                className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.15] text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${activeTrailer.youtubeKey}?autoplay=1&rel=0`}
                title={activeTrailer.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>

            {activeTrailer.linkedItem && (
              <div className="px-5 py-3.5 bg-[#130f1d] flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-[#c4bcd6]">
                  Curtiu o trailer de{' '}
                  <strong className="text-white">
                    {activeTrailer.linkedItem.title}
                  </strong>
                  ? Abduza para o seu cronograma!
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const it = activeTrailer.linkedItem!;
                      setActiveTrailer(null);
                      onOpenModal(it);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[#2a174a] text-[#c084fc] hover:text-white border border-[#a855f7]/50 text-xs font-bold transition"
                  >
                    Abrir Ficha Técnica
                  </button>
                  <AbductButton
                    isAbducted={isItemFavorite(activeTrailer.linkedItem)}
                    onToggle={(e) =>
                      onToggleFavorite(activeTrailer.linkedItem!, e)
                    }
                    size="sm"
                    showLabel
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
