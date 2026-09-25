import React from 'react';
import IconeLogo from './novo-icone.png';


interface NoxLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  layout?: 'horizontal' | 'vertical' | 'emblem';
  theme?: 'dark' | 'light';
  showSubtitle?: boolean;
  className?: string;
  onClick?: () => void;
}

export const NoxLogo: React.FC<NoxLogoProps> = ({
  size = 'md',
  layout = 'horizontal',
  theme = 'dark',
  showSubtitle = true,
  className = '',
  onClick,
}) => {
  // Dimensions & scaling
  const emblemSizes = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const textSizes = {
    xs: 'text-base',
    sm: 'text-lg',
    md: 'text-xl tracking-tight',
    lg: 'text-3xl tracking-tight',
    xl: 'text-4xl tracking-tight',
  };

  const subSizes = {
    xs: 'text-[6px] tracking-[0.2em]',
    sm: 'text-[7px] tracking-[0.22em]',
    md: 'text-[8.5px] tracking-[0.24em]',
    lg: 'text-[11px] tracking-[0.28em]',
    xl: 'text-[14px] tracking-[0.3em]',
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  // Emblem Vector
  const renderEmblem = () => (
    <div
      id="nox-logo-emblem-container"
      className={`relative ${emblemSizes[size]} shrink-0 flex items-center justify-center`}
    >
      <img
      src={IconeLogo}
      alt="Logo"
      className="w-full h-full object-contain drop-shadow-sm transition-transform group-hover:scale-105"
    />
    </div>
  );

  const interactiveClasses = onClick
    ? 'cursor-pointer select-none group'
    : '';

  if (layout === 'emblem') {
    return (
      <div
        id="nox-logo-emblem-wrapper"
        onClick={onClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label="Logo NOX4"
        className={`inline-flex items-center ${interactiveClasses} ${className}`}
      >
        {renderEmblem()}
      </div>
    );
  }

  if (layout === 'vertical') {
    return (
      <div
        id="nox-logo-vertical-wrapper"
        onClick={onClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label="NOX4 Aceleradora de Resultados"
        className={`flex flex-col items-center text-center ${interactiveClasses} ${className}`}
      >
        {renderEmblem()}
        
        {/* NOX4 Text */}
        <div className={`font-black leading-none mt-3 ${textSizes[size]} font-heading flex items-center justify-center tracking-wide`}>
          <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>
            NOX
          </span>
          <span className="text-[#1040FF] font-extrabold ml-1">4</span>
        </div>

        {/* Tagline */}
        {showSubtitle && (
          <span
            className={`font-bold uppercase mt-1.5 font-heading ${subSizes[size]} whitespace-nowrap ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-900'
            }`}
          >
            Aceleradora de Resultados
          </span>
        )}
      </div>
    );
  }

  // Horizontal layout (default for sidebar & headers)
  return (
    <div
      id="nox-logo-horizontal-wrapper"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label="Ir para o Dashboard - NOX4 Aceleradora de Resultados"
      className={`flex items-center gap-3 ${interactiveClasses} ${className}`}
    >
      {renderEmblem()}

      <div className="flex flex-col justify-center select-none">
        {/* NOX 4 Logo Title */}
        <div className={`font-black leading-none ${textSizes[size]} font-heading flex items-center`}>
          <span className={`${theme === 'dark' ? 'text-slate-300 group-hover:text-white' : 'text-slate-700'} font-extrabold tracking-wider transition-colors`}>
            NOX
          </span>
          <span className="text-[#1040FF] font-black ml-0.5 group-hover:brightness-110 transition-all">4</span>
        </div>

        {/* Tagline: ACELERADORA DE RESULTADOS */}
        {showSubtitle && (
          <span
            className={`font-bold uppercase font-heading mt-1 ${subSizes[size]} whitespace-nowrap transition-colors ${
              theme === 'dark' ? 'text-slate-400/90 group-hover:text-slate-300' : 'text-slate-600'
            }`}
          >
            Aceleradora de Resultados
          </span>
        )}
      </div>
    </div>
  );
};
