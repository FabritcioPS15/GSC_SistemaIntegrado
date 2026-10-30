import React from 'react';

// ============================================================
// Componente de Tabla Unificado - Sistema GSC
// FUENTE DE VERDAD de estilos: usa los sub-componentes
// TableCellPrimary, TableCellSecondary, TableCellIcon,
// TableCellBadge y TableActionButton para contenido uniforme.
// ============================================================

export function Table({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto relative group/table">
      <table className={`gsc-table w-full text-left border-collapse border-spacing-0 ${className}`}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <thead className={`bg-slate-50 border-b border-slate-200 ${className}`}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <tbody className={`divide-y divide-slate-100 ${className}`}>
      {children}
    </tbody>
  );
}

export function TableRow({
  children,
  className = '',
  onClick,
  onDoubleClick
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <tr
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`hover:bg-blue-50/70 transition-colors duration-200 group/row relative border-b border-slate-50 last:border-0 ${className}`}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  children,
  className = '',
  sortable,
  isSorted,
  sortDirection,
  onClick
}: {
  children: React.ReactNode;
  className?: string;
  sortable?: boolean;
  isSorted?: boolean;
  sortDirection?: 'asc' | 'desc';
  onClick?: () => void;
}) {
  return (
    <th className={`px-4 py-5 text-left whitespace-nowrap ${className}`}>
      {sortable ? (
        <button onClick={onClick} className="flex items-center gap-1.5 hover:text-[#002855] transition-colors">
          <span className="text-[12px] font-semibold text-[#002855] uppercase tracking-[0.2em]">{children}</span>
          {isSorted ? (
            <span className="text-[#002855] text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
          ) : (
            <span className="text-slate-300 text-[10px] opacity-50">▲▼</span>
          )}
        </button>
      ) : (
        <span className="text-[12px] font-semibold text-[#002855] uppercase tracking-[0.2em]">{children}</span>
      )}
    </th>
  );
}

/**
 * Celda de datos. Contenedor limpio sin estilos de texto —
 * el estilo lo definen los sub-componentes hijos.
 */
export function TableCell({
  children,
  className = '',
  colSpan,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <td colSpan={colSpan} onClick={onClick} className={`px-4 py-4 text-left align-middle ${className}`}>
      {children}
    </td>
  );
}

// ============================================================
// Sub-componentes de contenido — fuente única de verdad CSS
// ============================================================

/** Icono cuadrado 9×9, hover azul al pasar sobre la fila */
export function TableCellIcon({
  icon,
  className = ''
}: {
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-9 h-9 rounded-none flex items-center justify-center shadow-sm transition-all duration-300 bg-slate-100 text-slate-400 group-hover/row:bg-[#002855] group-hover/row:text-white group-hover/row:shadow-md shrink-0 ${className}`}>
      {icon}
    </div>
  );
}

/** Texto principal: 13px font-semibold #002855 uppercase */
export function TableCellPrimary({
  children,
  className = ''
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`text-[13px] font-semibold text-[#002855] uppercase leading-tight tracking-tight ${className}`}>
      {children}
    </span>
  );
}

/** Texto secundario/subtítulo: 10px font-semibold slate-400 uppercase */
export function TableCellSecondary({
  children,
  className = ''
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`text-[10px] font-semibold text-slate-400 uppercase tracking-widest ${className}`}>
      {children}
    </span>
  );
}

/** Etiqueta de texto — sin borde ni fondo */
export function TableCellBadge({
  children,
  className = ''
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`text-[14px] font-semibold text-slate-800 ${className}`}>
      {children}
    </span>
  );
}

/** Botón de acción cuadrado, sin bordes redondeados */
export function TableActionButton({
  icon,
  onClick,
  title,
  variant = 'default'
}: {
  icon: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  variant?: 'default' | 'danger';
}) {
  const colorClasses = variant === 'danger'
    ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
    : 'text-slate-500 hover:text-[#002855] hover:bg-slate-100';
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 flex items-center justify-center ${colorClasses} bg-white rounded-none border border-slate-200 transition-all shadow-sm`}
    >
      {icon}
    </button>
  );
}
