import { ReactNode } from 'react';
import ModalOverlay from './ModalOverlay';

type MaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '7xl';

const maxWidthClass: Record<MaxWidth, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
  '5xl': 'sm:max-w-5xl',
  '7xl': 'sm:max-w-7xl',
};

type DetailModalProps = {
  children: ReactNode;
  maxWidth?: MaxWidth;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  overlayStyle?: React.CSSProperties;
};

/**
 * Shell responsivo para modales de detalle.
 * Móvil: pantalla completa bajo el header. Desktop: caja centrada con scroll interno.
 */
export default function DetailModal({
  children,
  maxWidth = '5xl',
  onClose,
  closeOnBackdrop = false,
  overlayStyle,
}: DetailModalProps) {
  return (
    <ModalOverlay onClose={onClose} closeOnBackdrop={closeOnBackdrop} style={overlayStyle}>
      <div
        className={`bg-white border border-slate-200 shadow-2xl w-full min-w-0 ${maxWidthClass[maxWidth]} sm:max-h-[min(92vh,calc(100dvh-3.5rem-1.5rem))] max-h-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 mx-auto sm:rounded-sm`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </ModalOverlay>
  );
}

export function DetailModalHeader({
  children,
  className = 'bg-[#002855]',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${className} px-3 py-3 sm:px-5 sm:py-4 md:px-6 md:py-5 flex items-start sm:items-center justify-between gap-2 sm:gap-3 shrink-0 relative`}
    >
      {children}
    </div>
  );
}

export function DetailModalBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 sm:px-5 sm:py-5 md:px-6 md:py-6 lg:px-8 lg:py-8 min-h-0 ${className}`}
    >
      {children}
    </div>
  );
}

export function DetailModalFooter({ children }: { children: ReactNode }) {
  return (
    <div className="bg-slate-50 border-t border-slate-200 px-3 py-3 sm:px-5 sm:py-4 md:px-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4">
      {children}
    </div>
  );
}

type GridLayout = 'default' | 'stack-until-xl';

/** Grilla de columnas: por defecto 1→2→3; stack-until-xl mantiene 1 columna hasta pantallas anchas */
export function DetailModalGrid({
  children,
  layout = 'default',
}: {
  children: ReactNode;
  layout?: GridLayout;
}) {
  const gridClass =
    layout === 'stack-until-xl'
      ? 'grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-5 md:gap-6 min-w-0'
      : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5 md:gap-6 lg:gap-8 min-w-0';

  return <div className={gridClass}>{children}</div>;
}

/** Título de sección dentro del modal */
export function DetailModalSection({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-3 sm:space-y-4 min-w-0 ${className}`}>
      <div className="border-b border-slate-100 pb-1.5 sm:pb-2 flex items-center gap-2">
        <div className="w-1 h-3.5 sm:h-4 bg-blue-600 shrink-0" />
        <h3 className="text-[10px] sm:text-[12px] font-normal text-[#002855] uppercase tracking-wide sm:tracking-widest">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

/** Tarjeta interna con padding responsivo */
export function DetailModalCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-3 sm:p-4 bg-slate-50 border border-slate-100 min-w-0 ${className}`}>
      {children}
    </div>
  );
}

/** Fila etiqueta / valor apilada en móvil */
export function DetailModalRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-center sm:gap-2">
      <span className="text-[9px] sm:text-[10px] font-normal text-slate-400 uppercase tracking-wide shrink-0">
        {label}
      </span>
      <div className="min-w-0 sm:text-right">{children}</div>
    </div>
  );
}

// --- NUEVOS COMPONENTES ESTANDARIZADOS PARA UNIFICACIÓN DE DISEÑO --- //

export function StandardModalHeader({
  title,
  subtitle,
  icon: Icon,
  onClose,
}: {
  title: string;
  subtitle: string;
  icon: any;
  onClose: () => void;
}) {
  return (
    <div className="bg-[#002855] px-3 py-3 sm:px-5 sm:py-4 md:px-6 md:py-5 flex items-start sm:items-center justify-between gap-2 sm:gap-3 shrink-0 relative">
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 pr-1">
        <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 bg-white/10 border border-white/20 flex items-center justify-center text-white">
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xs sm:text-base md:text-[18px] font-normal text-white uppercase tracking-tight leading-snug line-clamp-2 sm:line-clamp-1">{title}</h2>
          <p className="text-[9px] sm:text-[10px] font-normal text-blue-200 uppercase tracking-wide mt-1 flex items-start sm:items-center gap-1.5">
            <span className="line-clamp-2 sm:truncate">{subtitle}</span>
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 text-white/50 hover:text-white hover:bg-white/10 transition-all -mr-1"
        aria-label="Cerrar detalle"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
  );
}

export function StandardModalBanner({
  title,
  icon: Icon,
  badges,
  rightLabel,
  rightValue,
}: {
  title: string;
  icon: any;
  badges?: ReactNode;
  rightLabel?: string;
  rightValue?: ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 shadow-sm min-w-0">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
          <Icon size={32} className="text-slate-300" strokeWidth={1} />
        </div>
        <div>
          <h1 className="text-xl font-normal text-[#002855] uppercase tracking-tight leading-none mb-2 line-clamp-2">
            {title}
          </h1>
          {badges && <div className="flex flex-wrap gap-2">{badges}</div>}
        </div>
      </div>
      {rightLabel && rightValue && (
        <div className="text-right shrink-0">
          <p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mb-1">{rightLabel}</p>
          <p className="text-lg font-normal text-blue-700 font-mono">{rightValue}</p>
        </div>
      )}
    </div>
  );
}

export function StandardModalFooter({
  onClose,
  onEdit,
  editLabel = 'Editar',
}: {
  onClose: () => void;
  onEdit?: () => void;
  editLabel?: string;
}) {
  return (
    <DetailModalFooter>
      <button
        onClick={onClose}
        className="w-full sm:w-auto order-1 sm:order-2 px-6 py-3 sm:py-2.5 min-h-[44px] bg-[#002855] sm:bg-slate-200 text-white sm:text-slate-700 text-[10px] font-normal uppercase tracking-widest hover:bg-blue-800 sm:hover:bg-slate-300 transition-all"
      >
        Cerrar
      </button>
      {onEdit && (
        <button
          onClick={onEdit}
          className="w-full sm:w-auto order-3 sm:order-3 px-6 py-3 sm:py-2.5 min-h-[44px] bg-emerald-600 text-white text-[10px] font-normal uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          {editLabel}
        </button>
      )}
      <div className="hidden sm:flex items-center gap-2 order-2 sm:order-1 mr-auto">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">Sistema GS</span>
      </div>
    </DetailModalFooter>
  );
}
