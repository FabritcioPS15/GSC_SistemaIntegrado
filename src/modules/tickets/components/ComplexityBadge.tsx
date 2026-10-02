// =============================================================================
// ComplexityBadge.tsx — Badge visual del nivel de complejidad técnica
// Funcionalidades:
//   - Muestra el nivel de complejidad (N1/N2/N3) con la paleta propia del eje
//     de complejidad (verde/azul/violeta), diferenciada de la escala de
//     prioridad que usa rojo/naranja/ámbar
//   - Gestiona tickets aún no clasificados mostrando "Sin clasificar"
//   - Ignora de forma segura valores no reconocidos o nulos
// =============================================================================

import { COMPLEXITY_DESCRIPTIONS, COMPLEXITY_LABELS, normalizeComplexity, TicketComplexity } from '../tickets.types';

// Paleta propia del eje de complejidad
// N1 → verde (soporte básico), N2 → azul (soporte técnico), N3 → violeta (especializado)
// Se evita deliberadamente la escala de prioridad (rojo/naranja/ámbar) para que
// un ticket P1-N1 no se confunda visualmente con un P1-N3
const COMPLEXITY_COLORS: Record<TicketComplexity, string> = {
  N1: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  N2: 'bg-sky-100 text-sky-700 border-sky-200',
  N3: 'bg-violet-100 text-violet-700 border-violet-200',
};

type ComplexityBadgeProps = {
  // Valor persistido en tickets.complexity_level (puede venir nulo o sin clasificar)
  level?: string | null;
  // 'code' muestra solo N1/N2/N3, 'full' muestra la etiqueta completa
  variant?: 'code' | 'full';
  className?: string;
};

export default function ComplexityBadge({ level, variant = 'code', className = '' }: ComplexityBadgeProps) {
  const normalized = normalizeComplexity(level);

  // Ticket no clasificado todavía: el técnico lo definirá durante la atención
  if (!normalized) {
    return (
      <span
        title="El nivel de complejidad se define durante la atención"
        className={`inline-block text-[9px] font-normal uppercase tracking-widest text-slate-400 border border-dashed border-slate-300 px-2 py-0.5 ${className}`}
      >
        Sin clasificar
      </span>
    );
  }

  return (
    <span
      title={COMPLEXITY_DESCRIPTIONS[normalized]}
      className={`inline-block text-[9px] font-semibold uppercase tracking-widest border px-2 py-0.5 ${COMPLEXITY_COLORS[normalized]} ${className}`}
    >
      {variant === 'full' ? COMPLEXITY_LABELS[normalized] : normalized}
    </span>
  );
}
