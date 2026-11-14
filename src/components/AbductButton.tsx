import React, { useId, useState } from 'react';

interface UfoIconProps {
  active?: boolean;
  size?: number;
  className?: string;
}

/**
 * Ícone estático do Ovnizinho (usado na Sidebar e nos cabeçalhos)
 */
export const UfoIcon: React.FC<UfoIconProps> = ({
  active = false,
  size = 18,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${
        active ? 'drop-shadow-[0_0_8px_rgba(34,255,85,0.85)]' : ''
      } ${className}`}
    >
      {/* Cúpula da Nave */}
      <path
        d="M8.5 13C8.5 9.4 10.9 6.8 14 6.8C17.1 6.8 19.5 9.4 19.5 13H8.5Z"
        fill={active ? '#22ff55' : 'currentColor'}
        fillOpacity={active ? '0.35' : '0.2'}
        stroke={active ? '#22ff55' : 'currentColor'}
        strokeWidth="1.7"
      />
      {/* Disco Principal do OVNI */}
      <ellipse
        cx="14"
        cy="14.2"
        rx="11"
        ry="3.8"
        fill={active ? '#123824' : '#1b162a'}
        stroke={active ? '#22ff55' : 'currentColor'}
        strokeWidth="1.8"
      />
      {/* 3 Luzes da Nave */}
      <circle
        cx="8.5"
        cy="14.2"
        r="1.15"
        fill={active ? '#22ff55' : 'currentColor'}
      />
      <circle
        cx="14"
        cy="14.7"
        r="1.25"
        fill={active ? '#ffffff' : 'currentColor'}
      />
      <circle
        cx="19.5"
        cy="14.2"
        r="1.15"
        fill={active ? '#22ff55' : 'currentColor'}
      />
      {/* Base emissora do feixe */}
      <path
        d="M11.2 17.8C12 18.8 16 18.8 16.8 17.8"
        stroke={active ? '#22ff55' : 'currentColor'}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
};

interface AbductButtonProps {
  isAbducted: boolean;
  onToggle: (e: React.MouseEvent) => void;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

/**
 * Botão Interativo do Ovnizinho:
 * - Ao clicar para adicionar ("Abduzir"): anima a nave projetando o feixe e abduzindo
 *   uma partícula brilhante para dentro, ficando aceso em verde neon (#22ff55).
 * - Ao clicar de novo para remover: anima a nave cuspindo a partícula de volta para baixo
 *   e apagando.
 */
export const AbductButton: React.FC<AbductButtonProps> = ({
  isAbducted,
  onToggle,
  size = 'md',
  showLabel = false,
  className = '',
}) => {
  const gradId = useId();
  const [animState, setAnimState] = useState<'idle' | 'abducting' | 'spitting'>(
    'idle'
  );

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ( !isAbducted ) {
      setAnimState('abducting');
    } else {
      setAnimState('spitting');
    }
    onToggle(e);

    setTimeout(() => {
      setAnimState('idle');
    }, 740);
  };

  const isLit = isAbducted || animState === 'abducting';
  const svgDim = size === 'sm' ? 28 : size === 'lg' ? 38 : 34;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isAbducted ? 'Remover dos Abduzidos' : 'Abduzir mídia'}
      title={
        isAbducted
          ? 'Abduzido! (Clique para cuspir de volta)'
          : 'Clique para abduzir para sua lista'
      }
      className={`group/ufo relative inline-flex items-center justify-center gap-2 select-none transition-transform active:scale-95 ${className}`}
    >
      <div className="relative flex items-center justify-center overflow-visible">
        <svg
          width={svgDim}
          height={svgDim + 12}
          viewBox="0 0 36 46"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible"
        >
          <defs>
            {/* Gradiente do Feixe de Abdução (Verde Neon) */}
            <linearGradient
              id={`beam-abduct-${gradId}`}
              x1="18"
              y1="19"
              x2="18"
              y2="44"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#22ff55" stopOpacity="0.85" />
              <stop offset="55%" stopColor="#22ff55" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
            </linearGradient>

            {/* Gradiente do Feixe Reverso ao Cuspir (Roxo / Rosa) */}
            <linearGradient
              id={`beam-spit-${gradId}`}
              x1="18"
              y1="19"
              x2="18"
              y2="44"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#ec4899" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* 1. FEIXE DE LUZ (TRACTOR BEAM) DURANTE A ABDUÇÃO OU DEVOLUÇÃO */}
          {animState !== 'idle' && (
            <polygon
              points="14,19 22,19 31,44 5,44"
              fill={
                animState === 'abducting'
                  ? `url(#beam-abduct-${gradId})`
                  : `url(#beam-spit-${gradId})`
              }
              className="animate-tractor-beam"
            />
          )}

          {/* Feixe sutil permanente quando já está Abduzido (aceso) */}
          {isAbducted && animState === 'idle' && (
            <polygon
              points="15,19 21,19 26,31 10,31"
              fill={`url(#beam-abduct-${gradId})`}
              opacity="0.45"
            />
          )}

          {/* 2. PARTÍCULA SENDO ABDUZIDA (Sobe para dentro da nave) */}
          {animState === 'abducting' && (
            <g className="animate-particle-up">
              <circle
                cx="18"
                cy="22"
                r="3.4"
                fill="#ffffff"
                stroke="#22ff55"
                strokeWidth="1.5"
                className="drop-shadow-[0_0_10px_#22ff55]"
              />
              <circle cx="13.5" cy="25.5" r="1.3" fill="#22ff55" />
              <circle cx="22.5" cy="24.5" r="1.1" fill="#a855f7" />
            </g>
          )}

          {/* 3. PARTÍCULA SENDO CUSPIDA DE VOLTA (Desce ejetada da nave) */}
          {animState === 'spitting' && (
            <g className="animate-particle-down">
              <circle
                cx="18"
                cy="21"
                r="3.2"
                fill="#c084fc"
                stroke="#ffffff"
                strokeWidth="1.2"
                className="drop-shadow-[0_0_8px_#a855f7]"
              />
              <circle cx="14" cy="24" r="1.2" fill="#ec4899" />
              <circle cx="22" cy="23" r="1.2" fill="#a855f7" />
            </g>
          )}

          {/* 4. CORPO DO OVNIZINHO */}
          <g
            className={`${
              animState === 'abducting'
                ? 'animate-ufo-abduct'
                : animState === 'spitting'
                ? 'animate-ufo-spit'
                : 'transition-transform duration-200 group-hover/ufo:-translate-y-0.5'
            } ${
              isLit
                ? 'drop-shadow-[0_0_11px_rgba(34,255,85,0.9)]'
                : 'group-hover/ufo:drop-shadow-[0_0_8px_rgba(168,85,247,0.75)]'
            }`}
          >
            {/* Anteninha / Topo da Cúpula */}
            <line
              x1="18"
              y1="3.5"
              x2="18"
              y2="6"
              stroke={isLit ? '#22ff55' : '#6e6682'}
              strokeWidth="1.5"
              strokeLinecap="round"
              className="transition-colors group-hover/ufo:stroke-[#a855f7]"
            />
            <circle
              cx="18"
              cy="3"
              r="1.4"
              fill={isLit ? '#22ff55' : '#6e6682'}
              className="transition-colors group-hover/ufo:fill-[#a855f7]"
            />

            {/* Cúpula de Vidro Alienígena */}
            <path
              d="M10.5 13.5C10.5 9.2 13.8 6.2 18 6.2C22.2 6.2 25.5 9.2 25.5 13.5H10.5Z"
              fill={isLit ? 'rgba(34, 255, 85, 0.35)' : 'rgba(110, 102, 130, 0.2)'}
              stroke={isLit ? '#22ff55' : '#6e6682'}
              strokeWidth="1.8"
              className="transition-colors group-hover/ufo:stroke-[#a855f7]"
            />

            {/* Brilho na cúpula */}
            <path
              d="M13 11C14 8.8 16 8 18 8"
              stroke={isLit ? '#ffffff' : '#968da8'}
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity={isLit ? '0.9' : '0.45'}
            />

            {/* Disco Voador Principal */}
            <ellipse
              cx="18"
              cy="14.8"
              rx="14"
              ry="4.6"
              fill={isLit ? '#0d3320' : '#181326'}
              stroke={isLit ? '#22ff55' : '#6e6682'}
              strokeWidth="2"
              className="transition-colors group-hover/ufo:stroke-[#a855f7]"
            />

            {/* Luzes da Borda do Disco */}
            <circle
              cx="10.5"
              cy="14.8"
              r="1.4"
              fill={isLit ? '#22ff55' : '#58506b'}
              className="transition-colors group-hover/ufo:fill-[#c084fc]"
            />
            <circle
              cx="18"
              cy="15.5"
              r="1.6"
              fill={isLit ? '#ffffff' : '#58506b'}
              className="transition-colors group-hover/ufo:fill-[#c084fc]"
            />
            <circle
              cx="25.5"
              cy="14.8"
              r="1.4"
              fill={isLit ? '#22ff55' : '#58506b'}
              className="transition-colors group-hover/ufo:fill-[#c084fc]"
            />

            {/* Emissor Inferior do Feixe */}
            <path
              d="M14 19.1C15.5 20.5 20.5 20.5 22 19.1"
              stroke={isLit ? '#22ff55' : '#6e6682'}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>

      {showLabel && (
        <span
          className={`text-xs sm:text-sm font-bold transition-colors ${
            isLit ? 'text-[#4ade80]' : 'text-white group-hover/ufo:text-[#c084fc]'
          }`}
        >
          {animState === 'abducting'
            ? 'Abduzindo...'
            : animState === 'spitting'
            ? 'Devolvendo...'
            : isAbducted
            ? 'Abduzido'
            : 'Abduzir Mídia'}
        </span>
      )}
    </button>
  );
};
