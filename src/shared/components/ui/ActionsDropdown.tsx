import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  SlidersHorizontal,
  CheckSquare,
  Square,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { RiFileExcel2Fill } from 'react-icons/ri';
import { FaFilePdf } from 'react-icons/fa6';

export interface ExtraAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  badge?: number | string;
  hidden?: boolean;
}

export interface SelectionModeConfig {
  active: boolean;
  onToggle: () => void;
  selectedCount?: number;
  disabled?: boolean;
  label?: string;
}

export interface ActionsDropdownProps {
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  align?: 'left' | 'right';
  disabled?: boolean;

  // Selección múltiple ("habilitar marcar")
  selectionMode?: SelectionModeConfig;

  // Exportaciones estándar
  onExportExcel?: () => void | Promise<void>;
  onExportPDF?: () => void | Promise<void>;

  // Plantilla e importación de datos
  onDownloadTemplate?: () => void | Promise<void>;
  onImportExcel?: () => void;

  // Acciones personalizadas adicionales
  extraActions?: ExtraAction[];

  // Contenido personalizado opcional al final
  children?: React.ReactNode;
}

export default function ActionsDropdown({
  label = 'Acciones',
  icon,
  className = '',
  align = 'right',
  disabled = false,
  selectionMode,
  onExportExcel,
  onExportPDF,
  onDownloadTemplate,
  onImportExcel,
  extraActions = [],
  children,
}: ActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera del componente o presionar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const hasExports = Boolean(onExportExcel || onExportPDF);
  const hasTemplateOrImport = Boolean(onDownloadTemplate || onImportExcel);
  const visibleExtraActions = extraActions.filter((action) => !action.hidden);
  const hasMultipleSections =
    [Boolean(selectionMode), hasExports, hasTemplateOrImport, visibleExtraActions.length > 0].filter(
      Boolean
    ).length > 1;

  const isSelectionActive = Boolean(selectionMode?.active);
  const selectedCount = selectionMode?.selectedCount ?? 0;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Botón Trigger Principal */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={
          isSelectionActive && selectedCount > 0
            ? `Acciones (${selectedCount} seleccionados)`
            : 'Menú de acciones'
        }
        className={`group relative flex items-center justify-center gap-2 h-10 px-3.5 bg-white border transition-all text-xs font-semibold shadow-sm focus:outline-none select-none ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-slate-200 text-slate-400'
            : isSelectionActive
            ? 'border-[#002855] text-[#002855] bg-blue-50/50 hover:bg-blue-50 shadow-blue-900/5'
            : isOpen
            ? 'border-[#002855] text-[#002855] bg-slate-50'
            : 'border-slate-200 text-slate-700 hover:text-[#002855] hover:border-[#002855]/40 hover:bg-slate-50/80'
        }`}
      >
        {/* Accent line on left */}
        <span
          className={`absolute left-0 top-0 h-full w-[2px] bg-[#002855] origin-center transition-transform duration-150 ${
            isOpen || isSelectionActive ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100'
          }`}
        />

        {/* Icono izquierdo */}
        {icon ? (
          <span className="shrink-0">{icon}</span>
        ) : (
          <SlidersHorizontal
            size={14}
            className={`shrink-0 transition-colors ${
              isSelectionActive || isOpen ? 'text-[#002855]' : 'text-slate-500 group-hover:text-[#002855]'
            }`}
          />
        )}

        {/* Texto del Botón */}
        <span className="tracking-wide uppercase text-[11px] font-medium">{label}</span>

        {/* Badge de Selección Activa si hay elementos seleccionados */}
        {isSelectionActive && selectedCount > 0 && (
          <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-3 shadow-xs">
            {selectedCount}
          </span>
        )}

        {/* Indicador de selección activa (sin elementos aún) */}
        {isSelectionActive && selectedCount === 0 && (
          <span className="w-2 h-2 rounded-full bg-[#002855] animate-pulse" />
        )}

        {/* Chevron desplegable */}
        <ChevronDown
          size={13}
          strokeWidth={2.5}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#002855]' : 'group-hover:text-[#002855]'
          }`}
        />
      </button>

      {/* Menú Desplegable */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className={`absolute z-50 top-full mt-1.5 w-64 bg-white border border-slate-200 shadow-[0_12px_32px_rgba(0,40,85,0.14)] py-1.5 animate-in fade-in slide-in-from-top-1 duration-150 ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          {/* SECCIÓN 1: MODO SELECCIÓN / HABILITAR MARCAR */}
          {selectionMode && (
            <div className="py-1">
              {hasMultipleSections && (
                <div className="px-3.5 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  Selección
                </div>
              )}
              <button
                type="button"
                role="menuitem"
                disabled={selectionMode.disabled}
                onClick={() => {
                  selectionMode.onToggle();
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-left transition-colors ${
                  selectionMode.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : isSelectionActive
                    ? 'bg-blue-50/70 text-[#002855] font-semibold hover:bg-blue-100/60'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-[#002855]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {isSelectionActive ? (
                    <CheckSquare size={16} className="text-[#002855] shrink-0" />
                  ) : (
                    <Square size={16} className="text-slate-400 shrink-0" />
                  )}
                  <span>
                    {isSelectionActive
                      ? 'Desactivar selección'
                      : selectionMode.label || 'Habilitar selección'}
                  </span>
                </div>
                {isSelectionActive && selectedCount > 0 && (
                  <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {selectedCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* DIVIDER */}
          {selectionMode && (hasExports || hasTemplateOrImport || visibleExtraActions.length > 0) && (
            <div className="my-1 border-t border-slate-100" />
          )}

          {/* SECCIÓN 2: EXPORTACIÓN (EXCEL / PDF) */}
          {hasExports && (
            <div className="py-1">
              {hasMultipleSections && (
                <div className="px-3.5 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  Exportar
                </div>
              )}

              {onExportExcel && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    setIsOpen(false);
                    await onExportExcel();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 text-left hover:bg-emerald-50/80 hover:text-emerald-800 transition-colors group"
                >
                  <RiFileExcel2Fill
                    size={16}
                    className="text-emerald-600 group-hover:scale-110 transition-transform shrink-0"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">Exportar a Excel</span>
                    <span className="text-[10px] text-slate-400 group-hover:text-emerald-600">
                      Archivo .xlsx
                    </span>
                  </div>
                </button>
              )}

              {onExportPDF && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    setIsOpen(false);
                    await onExportPDF();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 text-left hover:bg-rose-50/80 hover:text-rose-800 transition-colors group"
                >
                  <FaFilePdf
                    size={16}
                    className="text-rose-600 group-hover:scale-110 transition-transform shrink-0"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">Exportar a PDF</span>
                    <span className="text-[10px] text-slate-400 group-hover:text-rose-600">
                      Documento .pdf
                    </span>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* DIVIDER */}
          {hasExports && (hasTemplateOrImport || visibleExtraActions.length > 0) && (
            <div className="my-1 border-t border-slate-100" />
          )}

          {/* SECCIÓN 3: PLANTILLA Y CARGA MASIVA */}
          {hasTemplateOrImport && (
            <div className="py-1">
              {hasMultipleSections && (
                <div className="px-3.5 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  Datos & Plantillas
                </div>
              )}

              {onDownloadTemplate && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    setIsOpen(false);
                    await onDownloadTemplate();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 text-left hover:bg-indigo-50/80 hover:text-indigo-800 transition-colors group"
                >
                  <FileSpreadsheet
                    size={16}
                    className="text-indigo-600 group-hover:scale-110 transition-transform shrink-0"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">Descargar Plantilla</span>
                    <span className="text-[10px] text-slate-400 group-hover:text-indigo-600">
                      Plantilla oficial para carga
                    </span>
                  </div>
                </button>
              )}

              {onImportExcel && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOpen(false);
                    onImportExcel();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 text-left hover:bg-blue-50/80 hover:text-blue-800 transition-colors group"
                >
                  <Upload
                    size={16}
                    className="text-blue-600 group-hover:scale-110 transition-transform shrink-0"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">Cargar / Importar Excel</span>
                    <span className="text-[10px] text-slate-400 group-hover:text-blue-600">
                      Importar registros masivamente
                    </span>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* DIVIDER */}
          {hasTemplateOrImport && visibleExtraActions.length > 0 && (
            <div className="my-1 border-t border-slate-100" />
          )}

          {/* SECCIÓN 4: ACCIONES PERSONALIZADAS ADICIONALES */}
          {visibleExtraActions.length > 0 && (
            <div className="py-1">
              {visibleExtraActions.map((action, idx) => (
                <button
                  key={idx}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  onClick={() => {
                    setIsOpen(false);
                    action.onClick();
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition-colors ${
                    action.disabled
                      ? 'opacity-40 cursor-not-allowed text-slate-400'
                      : action.danger
                      ? 'text-rose-600 hover:bg-rose-50'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-[#002855]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {action.icon && <span className="shrink-0">{action.icon}</span>}
                    <span className="font-medium">{action.label}</span>
                  </div>
                  {action.badge !== undefined && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {action.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Children personalizados */}
          {children && <div className="pt-1">{children}</div>}
        </div>
      )}
    </div>
  );
}
