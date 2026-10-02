import React, { useState, useRef, useEffect } from 'react';
import { Calendar, X, Check, RotateCcw } from 'lucide-react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { ThemeProvider } from '@mui/material/styles';
import { muiTheme } from '../../theme/muiTheme';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

export interface DateRangePickerProps {
  startDate: string; // 'YYYY-MM-DD' o ''
  endDate: string;   // 'YYYY-MM-DD' o ''
  onChange: (startDate: string, endDate: string) => void;
  className?: string;
  disabled?: boolean;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  className = '',
  disabled = false,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [tempStart, setTempStart] = useState<string>(startDate);
  const [tempEnd, setTempEnd] = useState<string>(endDate);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sincronizar temporal con los props cuando se abre o cambian externamente
  useEffect(() => {
    setTempStart(startDate);
    setTempEnd(endDate);
  }, [startDate, endDate, open]);

  // Cerrar al hacer clic fuera (ignorando clics en portales emergentes de MUI)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const isInsideMuiPortal = Boolean(
        target.closest?.('.MuiPopover-root, .MuiPickersPopper-root, .MuiDialog-root, .MuiModal-root')
      );

      if (containerRef.current && !containerRef.current.contains(target) && !isInsideMuiPortal) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const hasDates = Boolean(startDate || endDate);

  const formatShort = (dateStr: string) => {
    if (!dateStr) return '---';
    const d = dayjs(dateStr);
    return d.isValid() ? d.format('DD/MM/YYYY') : dateStr;
  };

  const handleApply = () => {
    onChange(tempStart, tempEnd);
    setOpen(false);
  };

  const handleClear = () => {
    setTempStart('');
    setTempEnd('');
    onChange('', '');
    setOpen(false);
  };

  const setPreset = (preset: 'today' | '7days' | 'thisMonth') => {
    const today = dayjs();
    let start = '';
    let end = today.format('YYYY-MM-DD');

    if (preset === 'today') {
      start = today.format('YYYY-MM-DD');
    } else if (preset === '7days') {
      start = today.subtract(6, 'day').format('YYYY-MM-DD');
    } else if (preset === 'thisMonth') {
      start = today.startOf('month').format('YYYY-MM-DD');
      end = today.endOf('month').format('YYYY-MM-DD');
    }

    setTempStart(start);
    setTempEnd(end);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button: Solo ícono y rango compacto */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        className={`group flex items-center gap-2 px-3 h-10 border transition-all shadow-sm ${
          hasDates
            ? 'bg-blue-50/60 border-blue-300 text-[#002855]'
            : 'bg-white border-slate-200 text-slate-500 hover:border-[#002855]/30 hover:bg-slate-50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title="Filtrar por fechas"
      >
        <Calendar size={16} className={hasDates ? 'text-blue-600' : 'text-slate-400 group-hover:text-[#002855]'} />
        <span className="text-[11px] font-semibold tracking-tight">
          {hasDates ? `${formatShort(startDate)} - ${formatShort(endDate)}` : 'Fechas'}
        </span>

        {hasDates && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            title="Limpiar fechas"
            className="ml-1 p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 shadow-2xl p-4 w-[340px] sm:w-[540px] animate-in fade-in slide-in-from-top-2 duration-150">
          <ThemeProvider theme={muiTheme}>
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-blue-600" />
                  <h4 className="text-[12px] font-bold text-[#002855] uppercase tracking-wider">
                    Rango de Fechas
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Botones Rápidos (Presets) */}
              <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPreset('today')}
                  className="px-2.5 py-1 text-[10px] font-semibold bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => setPreset('7days')}
                  className="px-2.5 py-1 text-[10px] font-semibold bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  Últimos 7 días
                </button>
                <button
                  type="button"
                  onClick={() => setPreset('thisMonth')}
                  className="px-2.5 py-1 text-[10px] font-semibold bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  Este mes
                </button>
              </div>

              {/* Calendarios Desplegados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Fecha Inicial (Desde)
                  </label>
                  <DatePicker
                    value={tempStart ? dayjs(tempStart) : null}
                    onChange={(val) => setTempStart(val && val.isValid() ? val.format('YYYY-MM-DD') : '')}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        placeholder: 'Seleccionar...',
                        variant: 'outlined',
                        sx: {
                          '& .MuiInputBase-root': { height: '38px', fontSize: '12px' },
                        }
                      },
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Fecha Final (Hasta)
                  </label>
                  <DatePicker
                    value={tempEnd ? dayjs(tempEnd) : null}
                    minDate={tempStart ? dayjs(tempStart) : undefined}
                    onChange={(val) => setTempEnd(val && val.isValid() ? val.format('YYYY-MM-DD') : '')}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        placeholder: 'Seleccionar...',
                        variant: 'outlined',
                        sx: {
                          '& .MuiInputBase-root': { height: '38px', fontSize: '12px' },
                        }
                      },
                    }}
                  />
                </div>
              </div>

              {/* Footer Acciones */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-500 hover:text-rose-700 transition-colors"
                >
                  <RotateCcw size={12} /> Limpiar
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    className="flex items-center gap-1 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-[#002855] text-white hover:bg-blue-800 transition-colors shadow-sm"
                  >
                    <Check size={12} /> Aplicar
                  </button>
                </div>
              </div>
            </LocalizationProvider>
          </ThemeProvider>
        </div>
      )}
    </div>
  );
}
