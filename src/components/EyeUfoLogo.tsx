import React from 'react';

interface EyeUfoLogoProps {
  size?: number;
  className?: string;
}

/**
 * Logo Oficial "Só de Olho" — Fusão de um Olho Cósmico com um OVNI (Disco Voador)
 * Estética Dark Cosmic Neon (Roxo #a855f7 + Verde Alien #22ff55)
 */
export const EyeUfoLogo: React.FC<EyeUfoLogoProps> = ({
  size = 44,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
    >
      <defs>
        {/* Fundo Cósmico da Logo */}
        <radialGradient id="eyeUfoBg" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#1e1236" />
          <stop offset="65%" stopColor="#0e091a" />
          <stop offset="100%" stopColor="#07050c" />
        </radialGradient>

        {/* Gradiente Neon do Disco Voador / Pálpebra */}
        <linearGradient
          id="saucerRimGrad"
          x1="6"
          y1="28"
          x2="58"
          y2="36"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#22ff55" />
        </linearGradient>

        {/* Gradiente da Íris Alienígena (Olho dentro da Cúpula do OVNI) */}
        <radialGradient id="alienEyeIris" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="28%" stopColor="#22ff55" />
          <stop offset="72%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#064e3b" />
        </radialGradient>

        {/* Feixe de Abdução Inferior */}
        <linearGradient
          id="eyeUfoBeam"
          x1="32"
          y1="38"
          x2="32"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#22ff55" stopOpacity="0.78" />
          <stop offset="55%" stopColor="#a855f7" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Moldura Arredondada com Brilho */}
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="16"
        fill="url(#eyeUfoBg)"
        stroke="url(#saucerRimGrad)"
        strokeWidth="1.8"
      />

      {/* Feixe de Abdução Saindo do Olho-OVNI */}
      <polygon points="23,39 41,39 52,59 12,59" fill="url(#eyeUfoBeam)" />

      {/* Antena Cósmica no Topo da Cúpula */}
      <line
        x1="32"
        y1="7"
        x2="32"
        y2="12"
        stroke="#a855f7"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="32"
        cy="6.5"
        r="2.4"
        fill="#22ff55"
        stroke="#ffffff"
        strokeWidth="0.8"
      />

      {/* Cúpula Superior Transparente do OVNI */}
      <path
        d="M16 28C16 17.5 23.2 12 32 12C40.8 12 48 17.5 48 28"
        fill="rgba(168, 85, 247, 0.16)"
        stroke="#c084fc"
        strokeWidth="1.8"
      />

      {/* Anel do Disco Voador Formando o Contorno de um Olho */}
      <path
        d="M6 31C13.5 20.5 22.5 16.5 32 16.5C41.5 16.5 50.5 20.5 58 31C50.5 41.5 41.5 45.5 32 45.5C22.5 45.5 13.5 41.5 6 31Z"
        fill="#120b22"
        stroke="url(#saucerRimGrad)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />

      {/* Linha Equatorial do Disco Voador nas Extremidades do Olho */}
      <path
        d="M5 31C11 34 16 35 20 34.5"
        stroke="#a855f7"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M59 31C53 34 48 35 44 34.5"
        stroke="#22ff55"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Luzes Laterais do Disco Voador */}
      <circle cx="13" cy="31" r="2" fill="#a855f7" />
      <circle cx="51" cy="31" r="2" fill="#22ff55" />

      {/* Íris Central do Olho Alienígena */}
      <circle
        cx="32"
        cy="31"
        r="10.2"
        fill="url(#alienEyeIris)"
        stroke="#ffffff"
        strokeOpacity="0.8"
        strokeWidth="1.2"
      />

      {/* Pupila Vertical / Cósmica */}
      <ellipse cx="32" cy="31" rx="3.4" ry="6.8" fill="#05030a" />

      {/* Brilho Especular no Olho */}
      <circle cx="28.8" cy="27.5" r="2.2" fill="#ffffff" />
      <circle cx="35.2" cy="34.2" r="1.1" fill="#22ff55" />
    </svg>
  );
};
