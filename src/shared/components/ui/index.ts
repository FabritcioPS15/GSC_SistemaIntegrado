/**
 * Librería de componentes de UI compartidos.
 * Importa desde aquí para garantizar consistencia en toda la aplicación.
 *
 * Ejemplo:
 *   import { ActionToolbar, FilterSelect, LoadingSpinner } from '../../../shared/components/ui';
 */

export { default as ActionToolbar } from './ActionToolbar';
export { default as ActionsDropdown } from './ActionsDropdown';
export type { ActionsDropdownProps, ExtraAction, SelectionModeConfig } from './ActionsDropdown';
export { default as Breadcrumbs } from './Breadcrumbs';
export { default as DateRangeFilter } from './DateRangeFilter';
export type { DateRange } from './DateRangeFilter';
export { default as DetailModal } from './DetailModal';
export { default as EmptyState } from './EmptyState';
export { default as ExportButtons } from './ExportButtons';
export * from './Table';
export { default as FilterBar } from './FilterBar';
export { default as FilterSelect } from './FilterSelect';
export { default as Loader } from './Loader';
export { default as LoadingSpinner } from './LoadingSpinner';
export { default as ModalOverlay } from './ModalOverlay';
export { default as Pagination } from './Pagination';
export { default as PrimaryButton } from './PrimaryButton';
export { default as RowActions } from './RowActions';
export { default as SearchBar } from './SearchBar';
export { default as SortableTableHeader } from './SortableTableHeader';
export { default as StatusBadge } from './StatusBadge';
export { default as ViewToggle } from './ViewToggle';

// Re-exports nombrados de DetailModal
export {
  DetailModalHeader,
  DetailModalBody,
  StandardModalFooter,
  DetailModalGrid,
  DetailModalSection,
  DetailModalCard,
  DetailModalRow,
} from './DetailModal';
