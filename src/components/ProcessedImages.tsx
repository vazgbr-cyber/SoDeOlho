import React from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 44,
  className = '',
}) => {
  return (
    <img
      src="./logo-clean.png?v=2"
      alt="Só de Olho Logo"
      style={{ width: size, height: size }}
      className={`object-contain select-none ${className}`}
    />
  );
};

interface AlineIgenaCutoutProps {
  className?: string;
}

export const AlineIgenaCutout: React.FC<AlineIgenaCutoutProps> = ({
  className = '',
}) => {
  return (
    <img
      src="./aline-cutout.png"
      alt="Aline ígena — Mascote Só de Olho"
      className={`object-contain select-none pointer-events-none ${className}`}
    />
  );
};
