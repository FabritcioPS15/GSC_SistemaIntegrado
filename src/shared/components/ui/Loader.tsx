import type { CSSProperties } from 'react';

interface LoaderProps {
  /** Tamaño del loader en px. Default: 48 */
  size?: number;
  /** Color del anillo exterior. Default: 20% del color de texto actual */
  color1?: string;
  /** Color del anillo interior. Default: color de texto actual */
  color2?: string;
  /** Clases adicionales */
  className?: string;
}

export default function Loader({ size = 48, color1, color2, className = '' }: LoaderProps) {
  const style = {
    '--size': `${size / 48}px`,
    ...(color1 ? { '--color-1': color1 } : {}),
    ...(color2 ? { '--color-2': color2 } : {}),
  } as CSSProperties;

  return <span role="status" aria-label="Cargando" className={`gs-loader inline-block ${className}`} style={style} />;
}
