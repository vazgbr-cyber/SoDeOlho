import React from 'react';
import { Tv, Film } from 'lucide-react';

interface StreamingBadgesProps {
  platforms?: string[];
  size?: 'xs' | 'sm';
}

const STREAMING_STYLE_MAP: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  Netflix: {
    bg: 'bg-[#e50914]/15',
    text: 'text-[#ff5a60]',
    border: 'border-[#e50914]/50',
    dot: 'bg-[#e50914]',
  },
  'Amazon Prime': {
    bg: 'bg-[#00a8e1]/15',
    text: 'text-[#38bdf8]',
    border: 'border-[#00a8e1]/50',
    dot: 'bg-[#00a8e1]',
  },
  'HBO Max': {
    bg: 'bg-[#7c3aed]/20',
    text: 'text-[#c4b5fd]',
    border: 'border-[#8b5cf6]/60',
    dot: 'bg-[#a855f7]',
  },
  Globoplay: {
    bg: 'bg-[#ff5500]/15',
    text: 'text-[#fb923c]',
    border: 'border-[#ff5500]/50',
    dot: 'bg-[#ff5500]',
  },
  'Disney+': {
    bg: 'bg-[#1d4ed8]/20',
    text: 'text-[#60a5fa]',
    border: 'border-[#3b82f6]/55',
    dot: 'bg-[#3b82f6]',
  },
  Telecine: {
    bg: 'bg-[#e11d48]/15',
    text: 'text-[#fb7185]',
    border: 'border-[#f43f5e]/50',
    dot: 'bg-[#f43f5e]',
  },
  'Cinema BR': {
    bg: 'bg-[#0d3320]/85',
    text: 'text-[#4ade80]',
    border: 'border-[#22ff55]/50',
    dot: 'bg-[#22ff55]',
  },
  'Digital BR': {
    bg: 'bg-[#2a174a]/80',
    text: 'text-[#c084fc]',
    border: 'border-[#a855f7]/50',
    dot: 'bg-[#a855f7]',
  },
};

export const StreamingBadges: React.FC<StreamingBadgesProps> = ({
  platforms,
  size = 'sm',
}) => {
  if (!platforms || platforms.length === 0) return null;

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      {platforms.map((platform) => {
        const style = STREAMING_STYLE_MAP[platform] || {
          bg: 'bg-[#1c142e]',
          text: 'text-[#c084fc]',
          border: 'border-[#a855f7]/45',
          dot: 'bg-[#22ff55]',
        };

        const isCinema = platform === 'Cinema BR';

        return (
          <span
            key={platform}
            className={`inline-flex items-center gap-1.5 rounded-full font-extrabold uppercase tracking-wider border shadow-sm ${
              style.bg
            } ${style.text} ${style.border} ${
              size === 'xs'
                ? 'px-2 py-0.5 text-[9px]'
                : 'px-2.5 py-0.5 text-[10px] sm:text-[11px]'
            }`}
            title={`Disponível no Brasil via ${platform}`}
          >
            {isCinema ? (
              <Film className="w-3 h-3 shrink-0" />
            ) : (
              <Tv className="w-3 h-3 shrink-0" />
            )}
            <span>{platform}</span>
          </span>
        );
      })}
    </div>
  );
};
