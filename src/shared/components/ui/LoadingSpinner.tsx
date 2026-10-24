import Loader from './Loader';

interface LoadingSpinnerProps {
  /** Altura mínima del contenedor. Default: '60vh' */
  minHeight?: string;
  /** Tamaño del spinner en px. Default: 64 */
  size?: number;
  /** Clases adicionales para el contenedor */
  className?: string;
  /** Color del anillo exterior. Default: #fff */
  color1?: string;
  /** Color del anillo interior. Default: #ff3d00 */
  color2?: string;
  /** Texto opcional debajo del loader */
  label?: string;
  /** Clases adicionales para el texto */
  labelClassName?: string;
}

/**
 * Loader de carga unificado.
 * Usa el anillo animado definido en index.css (.gs-loader).
 */
export default function LoadingSpinner({
  minHeight = '60vh',
  size = 64,
  className = '',
  color1,
  color2,
  label,
  labelClassName = 'mt-4 text-sm text-slate-600',
}: LoadingSpinnerProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center w-full ${className}`}
      style={{ minHeight }}
    >
      <Loader size={size} color1={color1} color2={color2} />
      {label && <p className={labelClassName}>{label}</p>}
    </div>
  );
}
