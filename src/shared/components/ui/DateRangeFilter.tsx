import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LucideIcon, ChevronDown, CalendarDays, X } from 'lucide-react';

/**
 * Filtro de rango de fechas para las barras de filtro.
 *
 * Complementa a `FilterSelect`, que solo sabe de `<select>` y por lo tanto no
 * puede representar "desde X hasta Y". Vive aparte justamente para no meter un
 * caso especial dentro de `FilterBar`, que comparten todas las tablas.
 *
 * El disparador replica el botón de `FilterSelect` (mismo borde, misma línea de
 * acento a la izquierda, mismos tamaños) para que la fila de filtros se vea
 * como una sola pieza y no como controles pegados.
 *
 * Sin fechas cargadas se muestra el atajo "Todo" y los inputs quedan en
 * min/max, para no dejar elegir un rango que no puede traer nada.
 */

export interface DateRange {
  from: string;
  to: string;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  wrapperClassName?: string;
  /** Acota los <input> al rango real de los datos. */
  min?: string;
  max?: string;
  /** Texto del atajo que limpia el rango. */
  clearLabel?: string;
}

const vacio: DateRange = { from: '', to: '' };

/** '2026-09-25' -> '25/09'. */
const corto = (iso: string) => {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return d && m && a ? `${d}/${m}` : iso;
};

/** Suma días a un 'YYYY-MM-DD'. Se hace en UTC a propósito: con el constructor
 *  local, un día de diferencia puede cruzarse el cambio de horario y devolver
 *  la fecha anterior. */
const sumarDias = (iso: string, dias: number) => {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
};

export default function DateRangeFilter({
  value,
  onChange,
  placeholder = 'TODAS LAS FECHAS',
  icon: Icon = CalendarDays,
  iconClassName = 'text-blue-500',
  wrapperClassName = '',
  min,
  max,
  clearLabel = 'Todo',
}: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<'left' | 'right'>('left');
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { from, to } = value;
  const hayRango = Boolean(from || to);

  const etiqueta = useMemo(() => {
    if (from && to) return `${corto(from)} → ${corto(to)}`;
    if (from) return `Desde ${corto(from)}`;
    if (to) return `Hasta ${corto(to)}`;
    return placeholder;
  }, [from, to, placeholder]);

  useEffect(() => {
    if (!open) return;
    const onClickFuera = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !listRef.current || window.innerWidth < 768) return;
    const rect = listRef.current.getBoundingClientRect();
    setAlign(rect.right > window.innerWidth - 12 ? 'right' : 'left');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onTecla);
    return () => document.removeEventListener('keydown', onTecla);
  }, [open]);

  /** Si el usuario pone una fecha invertida, se corrige en vez de no filtrar. */
  const setCampo = (campo: 'from' | 'to', valor: string) => {
    const siguiente = { ...value, [campo]: valor };
    if (siguiente.from && siguiente.to && siguiente.from > siguiente.to) {
      if (campo === 'from') siguiente.to = valor;
      else siguiente.from = valor;
    }
    onChange(siguiente);
  };

  const aplicarAtajo = (rango: DateRange) => onChange(rango);

  const presets = useMemo(() => {
    if (!max) return [];
    const hoy = max;
    return [
      { etiqueta: 'Hoy', rango: { from: hoy, to: hoy } },
      { etiqueta: 'Últimos 7 días', rango: { from: sumarDias(hoy, -6), to: hoy } },
      { etiqueta: 'Últimos 30 días', rango: { from: sumarDias(hoy, -29), to: hoy } },
      { etiqueta: 'Este mes', rango: { from: `${hoy.slice(0, 7)}-01`, to: hoy } },
    ];
  }, [max]);

  const atajoActivo = (rango: DateRange) => Boolean(rango.from && rango.to && rango.from === from && rango.to === to);

  return (
    <div ref={rootRef} className={`relative w-full md:w-auto ${wrapperClassName}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`
          group relative flex w-full md:w-auto items-center gap-2
          px-3.5 py-2.5 bg-white border transition-all duration-150
          min-w-[130px] md:min-w-[155px] max-w-full shadow-[0_1px_2px_rgba(0,0,0,0.04)]
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002855]/15
          ${open ? 'border-[#002855]/50 bg-slate-50/80' : 'border-slate-200 hover:border-[#002855]/35 hover:bg-slate-50/80'}
        `}
      >
        <span
          className={`absolute left-0 top-0 h-full w-[2px] bg-[#002855] origin-center transition-transform duration-150 ${
            open ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100'
          }`}
        />

        <Icon size={15} className={`shrink-0 ${iconClassName}`} />

        <span
          className={`flex-1 text-left text-[12px] font-semibold tracking-[0.03em] truncate whitespace-nowrap ${
            hayRango ? 'text-[#002855]' : 'text-slate-400'
          }`}
        >
          {etiqueta}
        </span>

        <ChevronDown
          size={12}
          strokeWidth={2.5}
          className={`shrink-0 text-slate-300 transition-transform duration-200 ${
            open ? 'rotate-180 text-[#002855]/60' : 'group-hover:text-[#002855]/60'
          }`}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="dialog"
          aria-label="Filtrar por rango de fechas"
          className={`
            absolute z-30 top-full mt-1.5
            w-full md:w-[300px]
            ${align === 'right' ? 'md:left-auto md:right-0' : 'md:left-0'}
            left-0 right-0
          `}
        >
          <div className="bg-white border border-slate-200 shadow-[0_10px_28px_rgba(0,40,85,0.14)]">
            <div className="grid grid-cols-2 gap-2 p-2.5 border-b border-slate-100">
              {presets.map((p) => (
                <button
                  key={p.etiqueta}
                  type="button"
                  onClick={() => aplicarAtajo(p.rango)}
                  className={`px-2 py-2 text-[10px] font-semibold uppercase tracking-widest border transition-colors ${
                    atajoActivo(p.rango)
                      ? 'bg-[#002855] border-[#002855] text-white'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-[#002855]/35 hover:text-[#002855]'
                  }`}
                >
                  {p.etiqueta}
                </button>
              ))}
            </div>

            <div className="p-2.5 space-y-2">
              <label className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
                  Desde
                </span>
                <input
                  type="date"
                  value={from}
                  min={min}
                  max={to || max}
                  onChange={(e) => setCampo('from', e.target.value)}
                  className="flex-1 min-w-0 px-2 py-2 bg-white border border-slate-200 text-[12px] text-[#002855] focus:border-[#002855]/40 focus:outline-none focus:ring-2 focus:ring-[#002855]/10"
                />
              </label>

              <label className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
                  Hasta
                </span>
                <input
                  type="date"
                  value={to}
                  min={from || min}
                  max={max}
                  onChange={(e) => setCampo('to', e.target.value)}
                  className="flex-1 min-w-0 px-2 py-2 bg-white border border-slate-200 text-[12px] text-[#002855] focus:border-[#002855]/40 focus:outline-none focus:ring-2 focus:ring-[#002855]/10"
                />
              </label>
            </div>

            <div className="flex items-center justify-between bg-slate-50 border-t border-slate-200 px-2.5 py-2">
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">
                {hayRango ? 'Rango activo' : 'Sin filtro'}
              </span>
              {hayRango && (
                <button
                  type="button"
                  onClick={() => onChange(vacio)}
                  className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest text-rose-500 hover:text-rose-700 transition-colors"
                >
                  <X size={11} strokeWidth={3} /> {clearLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
