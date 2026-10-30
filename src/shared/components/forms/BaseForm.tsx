

import { ReactNode, Children, isValidElement, useRef, useState, useEffect, useMemo } from 'react';
import { X, AlertCircle, ChevronDown } from 'lucide-react';
import ModalOverlay from '../ui/ModalOverlay';
import Loader from '../ui/Loader';
import { DetailModalHeader, DetailModalBody } from '../ui/DetailModal';

type BaseFormProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  loading?: boolean;
  children: ReactNode;
  error?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
  icon?: ReactNode;
  showChangesWarning?: boolean;
  headerActions?: ReactNode;
};

export default function BaseForm({
  title,
  subtitle,
  onClose,
  onSubmit,
  loading = false,
  children,
  error,
  maxWidth = '6xl',
  icon,
  showChangesWarning = false,
  headerActions,
}: BaseFormProps) {
  const maxWidthClass = {
    sm: 'max-w-full sm:max-w-sm',
    md: 'max-w-full sm:max-w-md',
    lg: 'max-w-full sm:max-w-lg',
    xl: 'max-w-full sm:max-w-xl',
    '2xl': 'max-w-full sm:max-w-2xl',
    '3xl': 'max-w-full sm:max-w-3xl',
    '4xl': 'max-w-full sm:max-w-4xl',
    '5xl': 'max-w-full sm:max-w-5xl',
    // Updated width for modern SaaS modal (approx 1000px)
    '6xl': 'max-w-full sm:max-w-[1000px]',
    '7xl': 'max-w-full sm:max-w-7xl',
  }[maxWidth];

  return (
    <ModalOverlay className="bg-slate-900/40 backdrop-blur-sm">
      <div
        className={`bg-white w-full sm:max-h-[90vh] ${maxWidthClass} rounded-none shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <DetailModalHeader>
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 pr-1">
            {icon && (
              <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 bg-white/10 border border-white/20 flex items-center justify-center text-white">
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-xs sm:text-base md:text-[18px] font-normal text-white tracking-tight leading-snug line-clamp-2 sm:line-clamp-1">{title}</h2>
              {subtitle && (
                <p className="text-[9px] sm:text-[10px] font-normal text-blue-200 tracking-wide mt-1 flex items-start sm:items-center gap-1.5">
                  <span className="line-clamp-2 sm:truncate">{subtitle}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 text-white/50 hover:text-white hover:bg-white/10 transition-all -mr-1 rounded-none"
              disabled={loading}
              aria-label="Cerrar detalle"
            >
              <X size={22} />
            </button>
          </div>
        </DetailModalHeader>

        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto flex flex-col min-h-0">
          <DetailModalBody>
            {error && (
              <div className="bg-rose-50 border border-rose-100 p-4 flex items-center gap-3 text-rose-800">
                <AlertCircle size={20} />
                <p className="text-[11px] font-normal tracking-wide">{error}</p>
              </div>
            )}
            {children}
          </DetailModalBody>

          <div className="bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-3 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {showChangesWarning && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle size={14} />
                <span className="text-[10px] font-normal tracking-wide">Cambios sin guardar</span>
              </div>
            )}
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-3 sm:py-2.5 min-h-[44px] text-[10px] font-normal uppercase tracking-wide text-slate-700 bg-slate-200 hover:bg-slate-300 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 sm:py-2.5 min-h-[44px] text-[10px] font-normal uppercase tracking-wide text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg"
              >
                {loading && <Loader size={14} />}
                {loading ? 'Procesando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

// ─── FormGrid ─────────────────────────────────────────────────────────────────
// Componente de cuadrícula reutilizable. Úsalo dentro de FormSection para
// distribuir campos en 1, 2, 3 o 4 columnas de manera responsiva.
export function FormGrid({
  children,
  columns = 3,
  className = '',
}: {
  children: ReactNode;
  /** Número de columnas en pantallas grandes (≥ lg). Responsivo automático. */
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const gridClass: Record<1 | 2 | 3 | 4, string> = {
    1: 'grid grid-cols-1 gap-3',
    2: 'grid grid-cols-1 sm:grid-cols-2 gap-3',
    3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3',
    4: 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3',
  };
  return <div className={`${gridClass[columns]} ${className}`}>{children}</div>;
}

// ─── FormSection ──────────────────────────────────────────────────────────────
// Form Section Component
export function FormSection({
  title,
  children,
  color = 'blue',
  className = '',
  titleRight,
  icon,
  columns,
}: {
  title: string;
  children: ReactNode;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'indigo';
  className?: string;
  titleRight?: ReactNode;
  icon?: ReactNode;
  /** Si se indica, los hijos se envuelven automáticamente en un FormGrid con ese número de columnas.
   *  Útil para no tener que escribir <div className="grid ..."> en cada sección. */
  columns?: 1 | 2 | 3 | 4;
}) {
  const colorClasses = {
    blue: 'bg-blue-600',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500',
  };

  return (
    <section className={`bg-white rounded-lg border border-slate-100 p-4 space-y-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-50 pb-3">
        <div className="flex items-center gap-3">
          <div className={`w-1 h-5 ${colorClasses[color]}`}></div>
          {icon && <span className="text-slate-400">{icon}</span>}
          <h3 className="text-[11px] font-normal text-blue-900 tracking-wide uppercase">{title}</h3>
        </div>
        {titleRight && (
          <div className="flex items-center">
            {titleRight}
          </div>
        )}
      </div>
      {columns !== undefined ? (
        <FormGrid columns={columns}>{children}</FormGrid>
      ) : (
        children
      )}
    </section>
  );
}

// ─── FormField ────────────────────────────────────────────────────────────────
// Form Field Component
export function FormField({
  label,
  required = false,
  error,
  children,
  className = '',
  gridCols = 1,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
  gridCols?: number;
}) {
  const gridClass = gridCols > 1 ? `md:col-span-${gridCols}` : '';

  return (
    <div data-label={label} className={`flex flex-col ${className} ${gridClass}`}>
      <label className="flex items-end text-[10px] font-normal text-slate-600 mb-1.5 min-h-[24px]">
        <span className="line-clamp-2 leading-tight">
          {label} {required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
      </label>
      <div className="relative w-full">
        {children}
      </div>
      {error && (
        <p className="text-red-500 text-[10px] font-normal mt-1.5">{error}</p>
      )}
    </div>
  );
}

// ─── FormInput ────────────────────────────────────────────────────────────────
// Input Component
export function FormInput({
  className = '',
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  const baseClasses = 'w-full px-3 py-2 h-10 bg-white border border-slate-300 rounded-md shadow-sm hover:border-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white outline-none transition-all text-[11px] font-normal text-[#002855] tracking-normal placeholder:text-slate-300';
  const errorClasses = error ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : '';
  return (
    <input
      className={`${baseClasses} ${errorClasses} ${className}`}
      {...props}
    />
  );
}

// ─── FormSelect ───────────────────────────────────────────────────────────────
// Custom dropdown select with styled options panel
export function FormSelect({
  className = '',
  error,
  children,
  onChange,
  value,
  defaultValue,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => {
    return Children.toArray(children)
      .filter(isValidElement)
      .filter((el) => (el as React.ReactElement).type === 'option')
      .map((el) => {
        const option = el as React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>>;
        return {
          value: String(option.props.value ?? ''),
          label: option.props.children
            ? String(option.props.children)
            : String(option.props.label ?? ''),
          disabled: !!option.props.disabled,
        };
      });
  }, [children]);

  const currentValue = value ?? defaultValue ?? '';
  const selected = options.find((o) => o.value === String(currentValue));
  const hasValue = String(currentValue) !== '';
  const displayValue = selected?.label ?? (hasValue ? String(currentValue) : 'Seleccionar...');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    setIsOpen(false);
    if (onChange) {
      onChange({
        target: { name: props.name, value: optionValue },
      } as React.ChangeEvent<HTMLSelectElement>);
    }
  };

  const baseClasses = 'w-full px-3 py-2 h-10 bg-white border border-slate-300 rounded-md shadow-sm hover:border-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-[11px] font-normal text-[#002855] tracking-normal cursor-pointer flex items-center justify-between text-left disabled:opacity-50 disabled:cursor-not-allowed';
  const errorClasses = error ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : '';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !props.disabled && setIsOpen(o => !o)}
        {...props}
        className={`${baseClasses} ${errorClasses} ${isOpen ? 'border-blue-600 ring-2 ring-blue-500/20' : ''} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`truncate ${hasValue ? 'text-[#002855]' : 'text-slate-400'}`}>
          {displayValue}
        </span>
        <div className={`h-6 w-6 flex items-center justify-center rounded-md shrink-0 transition-colors ${isOpen ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
          <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-2 w-full bg-white border border-slate-200 rounded-md shadow-2xl overflow-hidden animate-fadeIn origin-top">
          <div className="max-h-[260px] overflow-y-auto py-1.5 custom-scrollbar">
            {options.length === 0 && (
              <p className="px-4 py-6 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Sin opciones</p>
            )}
            {options.map((option, index) => {
              const isSelected = option.value === String(currentValue);
              const isPlaceholder = option.value === '';
              return (
                <button
                  key={`${option.value}-${index}`}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => handleSelect(option.value)}
                  className={`
                    w-full px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide truncate transition-colors
                    ${option.disabled
                      ? 'text-slate-300 cursor-not-allowed'
                      : isSelected
                        ? 'bg-blue-600 text-white'
                        : isPlaceholder
                          ? 'text-slate-400 hover:bg-blue-50'
                          : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'}
                  `}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FormTextarea ─────────────────────────────────────────────────────────────
// Textarea Component
export function FormTextarea({
  className = '',
  error,
  rows = 3,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  const baseClasses = 'w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm hover:border-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white outline-none transition-all text-[11px] font-normal text-[#002855] tracking-normal placeholder:text-slate-300 resize-none';
  const errorClasses = error ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : '';

  return (
    <textarea
      rows={rows}
      className={`${baseClasses} ${errorClasses} ${className}`}
      {...props}
    />
  );
}
