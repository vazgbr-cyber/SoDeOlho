import React, { useEffect, useState } from 'react';
import {
  Bot,
  Film,
  Flame,
  Gamepad2,
  Loader2,
  Send,
  Sparkles,
  Star,
  Tv,
  Wand2,
} from 'lucide-react';
import { AppSettings, MediaCategory, MediaItem } from '../types/media';
import {
  AiRecommendationResult,
  generateAiRecommendations,
} from '../services/newsAndDiscoverService';
import { AlineIgenaCutout } from './ProcessedImages';
import { AbductButton } from './AbductButton';
import { StreamingBadges } from './StreamingBadges';
import { formatShortDate } from '../lib/dateUtils';

interface DiscoverAiSectionViewProps {
  settings: AppSettings;
  catalog: Record<MediaCategory, MediaItem[]>;
  favorites: MediaItem[];
  isItemFavorite: (item: MediaItem) => boolean;
  onToggleFavorite: (item: MediaItem, e: React.MouseEvent) => void;
  onOpenModal: (item: MediaItem) => void;
}

const QUICK_PROMPTS = [
  {
    label: '🛸 Baseado nos meus Abduzidos',
    prompt: 'Me recomende mídias baseadas no meu gosto e nos meus abduzidos',
    filter: 'all' as const,
  },
  {
    label: '🌌 Sci-Fi espacial tipo Interestelar / Duna',
    prompt: 'Quero um filme ou série de ficção científica espacial épico parecido com Duna e Interestelar',
    filter: 'all' as const,
  },
  {
    label: '🕵️ Série de suspense na Netflix ou HBO Max',
    prompt: 'Quero uma série de suspense, investigação e mistério na Netflix ou HBO Max para maratonar',
    filter: 'tv' as const,
  },
  {
    label: '⚔️ Jogo de RPG e aventura com história forte',
    prompt: 'Quero um jogo de RPG e aventura em mundo aberto com história épica para zerar',
    filter: 'game' as const,
  },
  {
    label: '🔥 Anime sombrio de ação frenética',
    prompt: 'Me recomende um anime de ação sombrio e fantasia com lutas incríveis',
    filter: 'anime' as const,
  },
  {
    label: '👻 Terror psicológico tenso',
    prompt: 'Quero um filme de terror psicológico e mistério assustador',
    filter: 'movie' as const,
  },
];

export const DiscoverAiSectionView: React.FC<DiscoverAiSectionViewProps> = ({
  settings,
  catalog,
  favorites,
  isItemFavorite,
  onToggleFavorite,
  onOpenModal,
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'movie' | 'tv' | 'anime' | 'game'>('all');
  const [isThinking, setIsThinking] = useState(false);
  const [aiResult, setAiResult] = useState<AiRecommendationResult | null>(null);
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState<string>('');

  const handleRunRecommendation = async (
    customPrompt?: string,
    customFilter?: 'all' | 'movie' | 'tv' | 'anime' | 'game'
  ) => {
    const queryToUse = (customPrompt ?? promptInput).trim();
    const filterToUse = customFilter ?? mediaFilter;
    if (!queryToUse) return;

    setIsThinking(true);
    setLastSubmittedPrompt(queryToUse);
    try {
      const res = await generateAiRecommendations(
        queryToUse,
        filterToUse,
        settings,
        catalog,
        favorites
      );
      setAiResult(res);
    } finally {
      setIsThinking(false);
    }
  };

  // Gera uma recomendação inicial inteligente baseada nos Abduzidos assim que abre a aba
  useEffect(() => {
    if (!aiResult && !isThinking) {
      handleRunRecommendation(
        'Me recomende filmes, séries, animes e games baseados nos meus abduzidos e nos destaques mais aguardados',
        'all'
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getCategoryBadgeLabel = (cat: MediaCategory) => {
    if (cat === 'movie_cinema') return 'Filme • Cinema';
    if (cat === 'movie_digital') return 'Filme • Streaming';
    if (cat === 'tv') return 'Série';
    if (cat === 'anime') return 'Anime';
    return 'Game';
  };

  const getReleaseLabel = (item: MediaItem) => {
    if (item.category === 'movie_cinema') {
      return `Cinema: ${formatShortDate(item.cinemaReleaseDate)}`;
    }
    if (item.category === 'movie_digital') {
      return `Streaming: ${formatShortDate(item.digitalReleaseDate || item.cinemaReleaseDate)}`;
    }
    if (item.category === 'tv' || item.category === 'anime') {
      return `Estreia/Ep: ${formatShortDate(item.nextEpisodeDate)}`;
    }
    return item.hltbLabel || `Lançamento: ${formatShortDate(item.releaseDate)}`;
  };

  return (
    <div className="space-y-7">
      {/* PAINEL DE COMANDO DA IA (ALINE ÍGENA • ORÁCULO DE RECOMENDAÇÃO) */}
      <div className="xeno-card p-6 sm:p-8 border border-[#a855f7]/50 shadow-[0_0_35px_rgba(168,85,247,0.18)] relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Mascote Aline Ígena */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#1a112c] border border-[#22ff55]/50 flex items-center justify-center shadow-[0_0_25px_rgba(34,255,85,0.25)]">
              <AlineIgenaCutout className="w-20 h-20 sm:w-22 sm:h-22" />
              <span className="absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase bg-[#0d3320] text-[#4ade80] border border-[#22ff55]">
                IA Online
              </span>
            </div>
            <div className="lg:hidden">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#4ade80] flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5" />
                <span>Oráculo Intergaláctico</span>
              </span>
              <h2 className="text-xl font-extrabold text-white">
                Aline Ígena • IA de Recomendação
              </h2>
            </div>
          </div>

          {/* Caixa de Diálogo & Input do Usuário */}
          <div className="flex-1 w-full space-y-4">
            <div className="hidden lg:block">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#4ade80] flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Inteligência Artificial • Descubra o que assistir ou jogar</span>
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
                Diga para a Aline o que você está com vontade de consumir hoje:
              </h2>
            </div>

            {/* Filtros de Tipo de Mídia para a IA */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'all', label: 'Qualquer Mídia', icon: Sparkles },
                { id: 'movie', label: 'Filmes', icon: Film },
                { id: 'tv', label: 'Séries', icon: Tv },
                { id: 'anime', label: 'Animes', icon: Flame },
                { id: 'game', label: 'Games', icon: Gamepad2 },
              ].map((t) => {
                const Icon = t.icon;
                const active = mediaFilter === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      const nextFilter = t.id as 'all' | 'movie' | 'tv' | 'anime' | 'game';
                      setMediaFilter(nextFilter);
                      if (promptInput.trim() || lastSubmittedPrompt) {
                        handleRunRecommendation(
                          promptInput.trim() || lastSubmittedPrompt,
                          nextFilter
                        );
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all ${
                      active
                        ? 'bg-[#2a174a] text-[#c084fc] border-[#a855f7] shadow-[0_0_14px_rgba(168,85,247,0.3)]'
                        : 'bg-[#0c0914] text-[#8e86a3] border-white/[0.07] hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-[#22ff55]" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Formulário de Prompt */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRunRecommendation();
              }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder='Ex: "Quero uma série de suspense na Netflix", "Filme sci-fi parecido com Duna", "Jogo de RPG com história épica"...'
                className="flex-1 px-4 py-3.5 rounded-2xl bg-[#0c0914] text-white placeholder-[#6e6682] border border-[#a855f7]/45 focus:outline-none focus:border-[#22ff55] text-sm shadow-inner transition"
              />
              <button
                type="submit"
                disabled={isThinking || !promptInput.trim()}
                className="px-6 py-3.5 rounded-2xl bg-[#0d3320] hover:bg-[#144d30] disabled:opacity-50 text-[#4ade80] border border-[#22ff55] font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(34,255,85,0.28)] transition shrink-0"
              >
                {isThinking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#22ff55]" />
                    <span>Analisando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-[#22ff55]" />
                    <span>Pedir Recomendação</span>
                  </>
                )}
              </button>
            </form>

            {/* Sugestões Rápidas em Pílulas */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7c738f]">
                Sugestões rápidas para testar:
              </span>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.label}
                    type="button"
                    onClick={() => {
                      setPromptInput(qp.prompt);
                      setMediaFilter(qp.filter);
                      handleRunRecommendation(qp.prompt, qp.filter);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-[#2a174a]/70 text-[#d8d0ec] hover:text-white border border-white/[0.08] hover:border-[#a855f7]/50 text-xs font-semibold transition"
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RESPOSTA DA IA + GRADE DE RECOMENDAÇÕES PERSONALIZADAS */}
      {isThinking ? (
        <div className="xeno-card p-14 text-center max-w-lg mx-auto my-8 space-y-3 border border-[#22ff55]/40">
          <Loader2 className="w-9 h-9 text-[#22ff55] mx-auto animate-spin" />
          <h3 className="text-base font-extrabold text-white">
            Aline Ígena está cruzando dados de Filmes, Séries, Animes e Games...
          </h3>
          <p className="text-xs text-[#8e86a3]">
            Analisando compatibilidade temática, plataformas no Brasil e avaliações para "{lastSubmittedPrompt}".
          </p>
        </div>
      ) : aiResult && aiResult.recommendations.length > 0 ? (
        <div className="space-y-6">
          {/* Balão de Resposta da Aline Ígena */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#130f1d] border border-[#22ff55]/45 shadow-[0_0_24px_rgba(34,255,85,0.12)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-[#0d3320] border border-[#22ff55]/50 text-[#4ade80] shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-[#4ade80]">
                    Diagnóstico da IA • {aiResult.detectedIntentSummary}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#e9e4f5] leading-relaxed">
                  Para o seu pedido{' '}
                  <span className="text-[#4ade80] font-bold">
                    "{lastSubmittedPrompt}"
                  </span>
                  , selecionei{' '}
                  <strong className="text-[#c084fc]">
                    {aiResult.recommendations.length} recomendações certeiras
                  </strong>{' '}
                  com justificativa personalizada abaixo:
                </p>
              </div>
            </div>
          </div>

          {/* Lista de Cards de Recomendação da IA */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {aiResult.recommendations.map(({ item, matchScore, aiReason }) => {
              const cleanSubtitle =
                (item.director &&
                !item.director.includes('Circuito Brasil') &&
                !item.director.includes('Disponível no Brasil') &&
                !item.director.includes('Cinema BR')
                  ? item.director
                  : null) ||
                item.studioOrNetwork ||
                item.developer ||
                'Produção Oficial';

              return (
                <article
                  key={`ai-rec-${item.category}-${item.externalId}`}
                  onClick={() => onOpenModal(item)}
                  className="xeno-card p-5 cursor-pointer flex flex-col sm:flex-row gap-5 border border-white/[0.08] hover:border-[#22ff55]/55 transition-all group"
                >
                  {/* Pôster */}
                  <div className="w-28 sm:w-32 shrink-0 flex flex-col justify-between">
                    <div className="aspect-[3/4] w-full xeno-cover-box overflow-hidden relative shadow-lg">
                      <img
                        src={item.posterUrl}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>

                    <div className="mt-2.5 px-2.5 py-1.5 rounded-xl bg-[#0d3320] border border-[#22ff55]/50 text-center">
                      <div className="text-xs font-mono font-black text-[#4ade80]">
                        {matchScore}% Match
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-[#bbf7d0]">
                        Compatível
                      </div>
                    </div>
                  </div>

                  {/* Informações + Justificativa da IA */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#2a174a] text-[#c084fc] border border-[#a855f7]/50">
                            {getCategoryBadgeLabel(item.category)}
                          </span>
                          <StreamingBadges
                            platforms={item.streamingPlatforms}
                            size="xs"
                          />
                          {item.rating && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/[0.06] text-[#fbbf24] inline-flex items-center gap-1">
                              <Star className="w-2.5 h-2.5 fill-[#fbbf24]" />
                              <span>{item.rating.toFixed(1)}</span>
                            </span>
                          )}
                        </div>

                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                        >
                          <AbductButton
                            isAbducted={isItemFavorite(item)}
                            onToggle={(e) => onToggleFavorite(item, e)}
                            size="sm"
                          />
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-extrabold text-white group-hover:text-[#c084fc] transition-colors leading-snug">
                          {item.title}
                        </h3>
                        <p className="text-xs font-semibold text-[#b9b0cc] mt-0.5">
                          {cleanSubtitle}
                        </p>
                      </div>

                      {/* Explicação personalizada da IA */}
                      <div className="p-3 rounded-xl bg-[#191229] border border-[#a855f7]/35 space-y-1">
                        <div className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-[#4ade80] flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-[#22ff55]" />
                          <span>Por que a IA recomenda para você:</span>
                        </div>
                        <p className="text-xs text-[#e2dbf0] leading-relaxed">
                          {aiReason}
                        </p>
                      </div>

                      <p className="text-xs text-[#8e86a3] line-clamp-2 leading-relaxed">
                        {item.synopsis}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-xs">
                      <span className="font-mono text-[#a39bb5]">
                        {getReleaseLabel(item)}
                      </span>
                      <span className="font-bold text-[#c084fc] group-hover:text-[#4ade80] transition-colors">
                        Abrir Ficha Técnica →
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};
