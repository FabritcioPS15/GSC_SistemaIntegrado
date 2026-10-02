import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LucideIcon, ChevronDown, Check, X } from 'lucide-react';

interface FilterSelectProps {
  icon?: LucideIcon;
  iconClassName?: string;
  wrapperClassName?: string;
  className?: string;
  children: React.ReactNode;
  /** Allows picking several options at once (e.g. varias sedes). Defaults to false (single select). */
  multiple?: boolean;
  /** string for single mode, string[] for multiple mode */
  value?: string | string[];
  onChange?: (e: { target: { value: string | string[] } }) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

interface OptionData {
  value: string;
  label: string;
}

export default function FilterSelect({
  icon: Icon,
  iconClassName = 'text-[#002855]',
  wrapperClassName = '',
  className = '',
  children,
  multiple = false,
  value,
  onChange,
  disabled = false,
  id,
  ...rest
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [align, setAlign] = useState<'left' | 'right'>('left');
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Pull {value, label} pairs out of <option> children so we can render
  // our own styled list while keeping the exact same call-site API.
  const options = useMemo<OptionData[]>(() => {
    const out: OptionData[] = [];
    React.Children.forEach(children, child => {
      if (React.isValidElement(child) && child.type === 'option') {
        out.push({
          value: String((child.props as any).value ?? ''),
          label: String((child.props as any).children ?? ''),
        });
      }
    });
    return out;
  }, [children]);

  // The first empty-value option ("TODAS LAS SEDES", etc.) acts as the "clear" row
  const placeholder = options.find(o => o.value === '');
  const selectableOptions = options.filter(o => o.value !== '');

  const selectedValues = multiple
    ? Array.isArray(value) ? value : []
    : value !== undefined && value !== null ? [String(value)] : [];

  const selectedIndex = !multiple ? options.findIndex(o => o.value === String(value ?? '')) : -1;
  const singleSelected = selectedIndex >= 0 ? options[selectedIndex] : options[0];

  const triggerLabel = useMemo(() => {
    if (!multiple) return singleSelected?.label ?? '';
    if (selectedValues.length === 0) return placeholder?.label ?? '';
    if (selectedValues.length === 1) {
      return selectableOptions.find(o => o.value === selectedValues[0])?.label ?? '';
    }
    return `${selectedValues.length} seleccionadas`;
  }, [multiple, selectedValues, selectableOptions, placeholder, singleSelected]);

  // Rows rendered inside the panel: "Todas" placeholder first (when present), then real options
  const rows: OptionData[] = placeholder ? [placeholder, ...selectableOptions] : selectableOptions;

  useEffect(() => {
    if (open) {
      const startIndex = !multiple
        ? Math.max(0, selectedIndex)
        : Math.max(0, rows.findIndex(r => r.value === (selectedValues[0] ?? '')));
      setHighlighted(startIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Decide whether the (wider) panel should hang from the left or right edge
  // of the trigger so it never spills off the viewport on desktop.
  useLayoutEffect(() => {
    if (!open || !listRef.current || window.innerWidth < 768) return;
    const rect = listRef.current.getBoundingClientRect();
    setAlign(rect.right > window.innerWidth - 12 ? 'right' : 'left');
  }, [open]);

  // Keep the highlighted row visible while navigating with arrow keys
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${highlighted}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  const commitSingle = (row: OptionData) => {
    onChange?.({ target: { value: row.value } });
    setOpen(false);
    buttonRef.current?.focus();
  };

  const toggleMultiple = (row: OptionData) => {
    if (row.value === '') {
      // "Todas" row clears the selection outright
      onChange?.({ target: { value: [] } });
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    const next = selectedValues.includes(row.value)
      ? selectedValues.filter(v => v !== row.value)
      : [...selectedValues, row.value];
    onChange?.({ target: { value: next } });
  };

  const commit = (index: number) => {
    const row = rows[index];
    if (!row || disabled) return;
    multiple ? toggleMultiple(row) : commitSingle(row);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlighted(i => Math.min(rows.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlighted(i => Math.max(0, i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setHighlighted(0);
        break;
      case 'End':
        e.preventDefault();
        setHighlighted(rows.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(highlighted);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className={`relative w-full md:w-[180px] ${wrapperClassName}`}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        {...rest}
        className={`
          group relative flex w-full items-center gap-2
          px-3.5 py-2.5 bg-white border transition-all duration-150
          min-w-[130px] md:min-w-[155px] max-w-full shadow-[0_1px_2px_rgba(0,0,0,0.04)]
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002855]/15
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-slate-200
          ${open ? 'border-[#002855]/50 bg-slate-50/80' : 'border-slate-200 hover:border-[#002855]/35 hover:bg-slate-50/80'}
        `}
      >
        {/* Left accent line — solid while open, reveals on hover otherwise */}
        <span
          className={`absolute left-0 top-0 h-full w-[2px] bg-[#002855] origin-center transition-transform duration-150 ${open ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100'
            }`}
        />

        {Icon && <Icon size={15} className={`shrink-0 ${iconClassName}`} />}

        <span className={`flex-1 text-left text-[12px] font-semibold text-[#002855] tracking-[0.03em] truncate ${className}`}>
          {triggerLabel}
        </span>

        {multiple && selectedValues.length > 0 && (
          <span className="shrink-0 flex items-center justify-center min-w-[20px] h-5 px-1 bg-[#002855] text-white text-[11px] font-semibold rounded-none">
            {selectedValues.length}
          </span>
        )}

        <ChevronDown
          size={12}
          strokeWidth={2.5}
          className={`shrink-0 text-slate-300 transition-transform duration-200 ${open ? 'rotate-180 text-[#002855]/60' : 'group-hover:text-[#002855]/60'
            }`}
        />
      </button>

      {open && (
        <div
          className={`
            absolute z-30 top-full mt-1.5
            w-full md:w-max md:min-w-[300px] md:max-w-[420px]
            ${align === 'right' ? 'md:left-auto md:right-0' : 'md:left-0'}
            left-0 right-0
          `}
        >
          <ul
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            aria-multiselectable={multiple}
            aria-activedescendant={`filter-option-${highlighted}`}
            className="bg-white border border-slate-200 shadow-[0_10px_28px_rgba(0,40,85,0.14)] max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150"
          >
            {rows.length === 0 && (
              <li className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-300">Sin opciones</li>
            )}
            {rows.map((row, i) => {
              const isPlaceholder = row.value === '';
              const isChecked = multiple
                ? isPlaceholder
                  ? selectedValues.length === 0
                  : selectedValues.includes(row.value)
                : i === selectedIndex;
              const isHighlighted = i === highlighted;

              return (
                <li
                  key={`${row.value}-${i}`}
                  id={`filter-option-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isChecked}
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => commit(i)}
                  className={`
                    relative flex items-center gap-2.5 pl-3 pr-3 py-2.5 cursor-pointer
                    text-[12px] font-semibold tracking-[0.02em]
                    transition-colors duration-100
                    ${isChecked ? 'text-[#002855]' : 'text-slate-500'}
                    ${isHighlighted ? 'bg-slate-50' : 'bg-white'}
                    ${isPlaceholder ? 'border-b border-slate-100' : ''}
                  `}
                >
                  {/* Checkbox cuadrado para todas las opciones no-placeholder */}
                  {!isPlaceholder && (
                    <span
                      className={`shrink-0 w-4 h-4 border-2 flex items-center justify-center transition-colors ${
                        isChecked ? 'bg-[#002855] border-[#002855]' : 'bg-white border-slate-300'
                      }`}
                    >
                      {isChecked && <Check size={10} strokeWidth={3.5} className="text-white" />}
                    </span>
                  )}

                  <span className="flex-1 leading-snug">{row.label}</span>
                </li>
              );
            })}
          </ul>

          {multiple && selectedValues.length > 0 && (
            <div className="flex items-center justify-between bg-slate-50 border border-t-0 border-slate-200 px-2.5 py-1.5">
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">
                {selectedValues.length} marcada{selectedValues.length > 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={() => onChange?.({ target: { value: [] } })}
                className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest text-rose-500 hover:text-rose-700 transition-colors"
              >
                <X size={11} strokeWidth={3} /> Limpiar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}