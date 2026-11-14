import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

/**
 * Ícone estilo Windows 7 / Vista Aero de um Olho Cristalino/Translúcido
 * com brilho especular no topo, íris em ciano/cobalto/esmeralda e reflexo vítreo.
 */
export const AeroEyeLogo: React.FC<IconProps> = ({ className = '', size = 46 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none drop-shadow-[0_0_14px_rgba(0,210,255,0.55)] ${className}`}
    >
      <defs>
        {/* Fundo da Esfera de Vidro */}
        <radialGradient id="aeroOrbBase" cx="50%" cy="65%" r="55%">
          <stop offset="0%" stopColor="#00d2ff" stopOpacity="0.45" />
          <stop offset="55%" stopColor="#0051ff" stopOpacity="0.68" />
          <stop offset="100%" stopColor="#051026" stopOpacity="0.96" />
        </radialGradient>

        {/* Brilho Especular Superior Estilo Vista/7 */}
        <linearGradient id="aeroSpecularTop" x1="32" y1="5" x2="32" y2="33" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
          <stop offset="48%" stopColor="#b8f2ff" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#00d2ff" stopOpacity="0.0" />
        </linearGradient>

        {/* Contorno Externo do Olho */}
        <linearGradient id="eyeShellGrad" x1="8" y1="18" x2="56" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#00d2ff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#00ff9d" stopOpacity="0.9" />
        </linearGradient>

        {/* Íris Cristalina */}
        <radialGradient id="aeroIrisGrad" cx="50%" cy="55%" r="50%">
          <stop offset="0%" stopColor="#00ff9d" />
          <stop offset="45%" stopColor="#00d2ff" />
          <stop offset="82%" stopColor="#0051ff" />
          <stop offset="100%" stopColor="#021b4a" />
        </radialGradient>
      </defs>

      {/* Orbe Externo de Vidro Aero */}
      <circle
        cx="32"
        cy="32"
        r="29"
        fill="url(#aeroOrbBase)"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="1.5"
      />

      {/* Anel Interno Luminescente */}
      <circle
        cx="32"
        cy="32"
        r="26.5"
        stroke="url(#eyeShellGrad)"
        strokeOpacity="0.45"
        strokeWidth="1"
      />

      {/* Sclera Translúcida do Olho */}
      <path
        d="M8 32C13.8 20.8 22.2 16 32 16C41.8 16 50.2 20.8 56 32C50.2 43.2 41.8 48 32 48C22.2 48 13.8 43.2 8 32Z"
        fill="rgba(7, 20, 42, 0.78)"
        stroke="url(#eyeShellGrad)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {/* Íris Cristalina */}
      <circle
        cx="32"
        cy="32"
        r="11.5"
        fill="url(#aeroIrisGrad)"
        stroke="#ffffff"
        strokeOpacity="0.7"
        strokeWidth="1.2"
      />

      {/* Pupila Profunda */}
      <circle cx="32" cy="32" r="5.2" fill="#030710" />

      {/* Reflexo Especular na Íris (Brilho Duplo estilo Frutiger Aero) */}
      <ellipse
        cx="28.2"
        cy="27.2"
        rx="4.2"
        ry="2.6"
        transform="rotate(-22 28.2 27.2)"
        fill="#ffffff"
        fillOpacity="0.92"
      />
      <circle cx="36.2" cy="35.8" r="1.8" fill="#00ff9d" fillOpacity="0.9" />

      {/* Cúpula de Brilho Especular Superior no Topo do Orbe (Assinatura Windows 7/Vista) */}
      <ellipse
        cx="32"
        cy="17.5"
        rx="22"
        ry="11.5"
        fill="url(#aeroSpecularTop)"
      />
    </svg>
  );
};

/**
 * Ícone de Engrenagem Estilo Windows Vista / 7 Control Panel (Metal + Safira Translúcida)
 */
export const AeroGearIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none drop-shadow-[0_1px_4px_rgba(0,210,255,0.5)] ${className}`}
    >
      <defs>
        <linearGradient id="vistaGearMetal" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#9adfff" />
          <stop offset="52%" stopColor="#2a6ca8" />
          <stop offset="100%" stopColor="#00d2ff" />
        </linearGradient>
        <radialGradient id="vistaGearCenter" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#00d2ff" />
          <stop offset="100%" stopColor="#003699" />
        </radialGradient>
      </defs>
      <path
        d="M13.8 3.2H18.2L19.1 6.5C20.1 6.9 21 7.4 21.8 8.1L25.1 7.2L27.3 11L24.8 13.4C25 14.3 25.1 15.1 25.1 16C25.1 16.9 25 17.7 24.8 18.6L27.3 21L25.1 24.8L21.8 23.9C21 24.6 20.1 25.1 19.1 25.5L18.2 28.8H13.8L12.9 25.5C11.9 25.1 11 24.6 10.2 23.9L6.9 24.8L4.7 21L7.2 18.6C7 17.7 6.9 16.9 6.9 16C6.9 15.1 7 14.3 7.2 13.4L4.7 11L6.9 7.2L10.2 8.1C11 7.4 11.9 6.9 12.9 6.5L13.8 3.2Z"
        fill="url(#vistaGearMetal)"
        stroke="rgba(255,255,255,0.8)"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle
        cx="16"
        cy="16"
        r="5.2"
        fill="url(#vistaGearCenter)"
        stroke="#051329"
        strokeWidth="1.4"
      />
      <ellipse cx="16" cy="13.8" rx="3" ry="1.4" fill="#ffffff" fillOpacity="0.75" />
    </svg>
  );
};
